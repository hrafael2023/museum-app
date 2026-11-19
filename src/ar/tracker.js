import { Emitter } from '../core/events.js';
import { createOverlays } from './overlays/index.js';

// Rastreador de imagens: liga a câmera, reconhece os alvos (cartazes, obras)
// e mantém, para cada alvo, um "anchor" do three.js posicionado sobre ele.
//
// Eventos:
//   'found'  { item }  um alvo apareceu na câmera
//   'lost'   { item }  o alvo saiu da câmera
//   'select' { item }  o visitante tocou no hotspot do alvo
//
// Desempenho: rastrear muitos cartazes ao mesmo tempo pesa em cada quadro.
// O limite de cartazes simultâneos começa conforme o aparelho e se ajusta
// sozinho: cai se as análises por segundo ficarem baixas e sobe se sobrar
// folga, até `maxTrack`. Sem cartaz na câmera por alguns segundos, o
// rastreador analisa menos quadros (economiza bateria). `stats` traz os
// números para o modo de diagnóstico (?debug=1).
//
// A implementação usa MindAR (reconhecimento de imagens no navegador) e three.js
// (camada 3D). Para trocar de motor (ex.: WebXR, 8th Wall), basta outra classe
// com a mesma interface: start(), stop(), pause(), resume() e os eventos acima.
export class ImageTracker extends Emitter {
  constructor({ container, overlayLayer, targetsSrc, items, maxTrack = 1, minTrackPoints = 10 }) {
    super();
    this.container = container;
    this.overlayLayer = overlayLayer;
    this.targetsSrc = targetsSrc;
    this.items = items;
    this.maxTrack = maxTrack;
    this.minTrackPoints = minTrackPoints;
    this.mindar = null;
    this.entries = []; // { item, anchor, overlays, visible }
    this.running = false;
    this.paused = false;
    this.ceiling = Math.max(1, maxTrack); // teto do limite adaptativo
    this.limit = Math.min(this.ceiling, deviceLimit());
    this.stats = {
      renderFps: 0, analysesPerSec: 0, msPerAnalysis: 0,
      tracking: 0, limit: this.limit, ceiling: this.ceiling, saving: false,
    };
    this.perf = { frames: 0, loops: 0, loopMs: 0, last: 0, slow: 0, fast: 0, idleSince: 0, timer: null };
  }

  async start() {
    const THREE = await import('three');
    const { MindARThree } = await import('../../vendor/mind-ar/mindar-image-three.prod.js');
    this.THREE = THREE;

    this.mindar = new MindARThree({
      container: this.container,
      imageTargetSrc: this.targetsSrc,
      maxTrack: this.limit,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      // Filtro de suavização (one-euro): minCF baixo = estável parado; beta
      // alto = acompanha rápido o movimento. Os valores do MindAR (0.001 e 1000)
      // funcionam bem; um beta baixo fazia o círculo "ficar para trás" ao mover.
      filterMinCF: 0.001,
      filterBeta: 1000,
      missTolerance: 5,
      warmupTolerance: 3,
    });

    const { renderer, scene, camera } = this.mindar;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));

    this.entries = this.items.map((item) => {
      const anchor = this.mindar.addAnchor(item.targetIndex);
      const entry = { item, anchor, overlays: [], visible: false };
      const ctx = {
        THREE,
        anchor,
        item,
        camera,
        renderer,
        layer: this.overlayLayer,
        select: () => this.emit('select', { item }),
      };
      entry.overlays = createOverlays(item.overlays ?? [{ type: 'hotspot' }], ctx);
      anchor.onTargetFound = () => {
        // Um quadro que ainda estava sendo processado quando o rastreamento foi
        // pausado (conteúdo aberto) pode chegar depois: ignora e esquece.
        if (this.paused) {
          anchor.visible = false;
          anchor.group.visible = false;
          this.#resetTracking(entry);
          return;
        }
        entry.visible = true;
        entry.foundAt = performance.now();
        entry.overlays.forEach((o) => o.show?.());
        this.emit('found', { item });
      };
      anchor.onTargetLost = () => {
        entry.visible = false;
        entry.overlays.forEach((o) => o.hide?.());
        this.emit('lost', { item });
      };
      return entry;
    });

    await this.mindar.start();
    // Pontos rastreados mínimos para continuar seguindo um alvo. Com cartaz na
    // câmera são ~35-45; quando ele sai, caem para poucos. O padrão do MindAR (4)
    // às vezes mantinha o alvo "preso" na textura ao redor.
    this.mindar.controller.minTrackPoints = this.minTrackPoints;
    this.running = true;
    this.#watchPerformance();

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      this.perf.frames += 1;
      const size = { width: this.container.clientWidth, height: this.container.clientHeight };
      for (const entry of this.entries) {
        if (!entry.visible) continue;
        entry.anchor.group.updateMatrixWorld();
        if (!this.#plausible(entry, size)) {
          entry.badFrames = (entry.badFrames ?? 0) + 1;
          if (entry.badFrames >= 3) this.#forceLost(entry);
          continue;
        }
        entry.badFrames = 0;
        entry.overlays.forEach((o) => o.update?.(dt, size));
      }
      renderer.render(scene, camera);
    });
  }

  // Mede o ritmo das análises (cada quadro processado pelo MindAR) e ajusta o
  // limite de cartazes simultâneos e a economia sem cartaz na tela.
  #watchPerformance() {
    const controller = this.mindar.controller;
    const original = controller.onUpdate;
    const perf = this.perf;
    perf.last = performance.now();
    perf.idleSince = perf.last;
    controller.onUpdate = (data) => {
      if (data.type === 'processDone') {
        const now = performance.now();
        perf.loops += 1;
        perf.loopMs += now - perf.last;
        perf.last = now;
      }
      original?.(data);
    };

    const LOW = 10;  // análises/s abaixo disso: aparelho no limite
    const HIGH = 20; // acima disso: há folga para mais um cartaz
    let windowStart = performance.now();
    perf.timer = setInterval(() => {
      const now = performance.now();
      const seconds = (now - windowStart) / 1000;
      windowStart = now;
      const tracking = (controller.trackingStates ?? []).filter((s) => s.isTracking).length;
      const rate = perf.loops / seconds;
      Object.assign(this.stats, {
        renderFps: Math.round(perf.frames / seconds),
        analysesPerSec: Math.round(rate * 10) / 10,
        msPerAnalysis: perf.loops ? Math.round(perf.loopMs / perf.loops) : 0,
        tracking,
      });
      perf.frames = 0;
      perf.loops = 0;
      perf.loopMs = 0;
      if (this.paused) return;

      // Economia: sem nenhum cartaz por 8 s, uma pausa curta entre análises.
      if (tracking > 0) perf.idleSince = now;
      const saving = now - perf.idleSince > 8000;
      controller.idleDelay = saving ? 80 : 0;
      this.stats.saving = saving;

      // Limite adaptativo (só avalia com cartaz na tela; parado, o ritmo cai
      // de propósito por causa da economia).
      if (tracking === 0 || saving) { perf.slow = 0; perf.fast = 0; return; }
      perf.slow = rate < LOW ? perf.slow + 1 : 0;
      perf.fast = rate > HIGH && tracking >= this.limit ? perf.fast + 1 : 0;
      if (perf.slow >= 2 && this.limit > 1) {
        // Baixa o limite para um a menos do que está sendo rastreado e solta os
        // cartazes encontrados por último, que passarem do novo limite.
        this.limit = Math.max(1, Math.min(this.limit, tracking) - 1);
        perf.slow = 0;
        this.entries
          .filter((e) => e.visible)
          .sort((a, b) => a.foundAt - b.foundAt)
          .slice(this.limit)
          .forEach((e) => this.#forceLost(e));
      }
      if (perf.fast >= 4 && this.limit < this.ceiling) { this.limit += 1; perf.fast = 0; }
      controller.maxTrack = this.limit;
      this.stats.limit = this.limit;
    }, 1000);
  }

  // A posição estimada do alvo faz sentido? Projeta os 4 cantos na tela e
  // recusa quadriláteros torcidos, minúsculos ou enormes: é o que acontece
  // quando o rastreamento escorrega para fora do cartaz.
  #plausible(entry, { width, height }) {
    const { THREE } = this;
    const aspect = entry.item.target?.aspect ?? 1.4;
    const m = entry.anchor.group.matrixWorld;
    const pts = [[-0.5, -aspect / 2], [0.5, -aspect / 2], [0.5, aspect / 2], [-0.5, aspect / 2]].map(([x, y]) => {
      const v = new THREE.Vector3(x, y, 0).applyMatrix4(m);
      if (v.z > 0) return null; // atrás da câmera
      v.project(this.mindar.camera);
      return [(v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height];
    });
    if (pts.some((p) => !p)) return false;
    // Convexo: todos os produtos vetoriais com o mesmo sinal.
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [a, b, c] = [pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (cross === 0) return false;
      if (sign === 0) sign = Math.sign(cross);
      else if (Math.sign(cross) !== sign) return false;
    }
    let area = 0;
    for (let i = 0; i < 4; i++) area += pts[i][0] * pts[(i + 1) % 4][1] - pts[(i + 1) % 4][0] * pts[i][1];
    area = Math.abs(area) / 2;
    const screen = width * height;
    if (area < screen * 0.003 || area > screen * 6) return false;
    // Lados opostos muito diferentes = perspectiva impossível.
    const len = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const ratio = (a, b) => Math.max(a, b) / Math.max(1e-6, Math.min(a, b));
    if (ratio(len(pts[0], pts[1]), len(pts[3], pts[2])) > 3.5) return false;
    if (ratio(len(pts[1], pts[2]), len(pts[0], pts[3])) > 3.5) return false;
    return true;
  }

  // Zera o rastreamento de um alvo no MindAR: ele só volta a aparecer depois
  // de ser detectado de novo na imagem da câmera.
  #resetTracking(entry) {
    const state = this.mindar?.controller?.trackingStates?.[entry.item.targetIndex];
    entry.badFrames = 0;
    if (state) {
      state.isTracking = false;
      state.showing = false;
      state.trackCount = 0;
      state.trackMiss = 0;
      state.trackingMatrix = null;
    }
  }

  // Encerra o rastreamento de um alvo no MindAR e dispara o 'lost'.
  #forceLost(entry) {
    this.#resetTracking(entry);
    this.mindar?.controller?.onUpdate?.({ type: 'updateMatrix', targetIndex: entry.item.targetIndex, worldMatrix: null });
  }

  // Para o processamento (economiza bateria) sem desligar a câmera. Usado ao
  // abrir um conteúdo: some com todos os marcadores na hora e esquece onde os
  // cartazes estavam, para que, ao voltar, só apareçam os que estiverem de
  // fato na câmera.
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.mindar.controller.stopProcessVideo();
    for (const entry of this.entries) {
      if (entry.visible) this.emit('lost', { item: entry.item });
      entry.visible = false;
      entry.anchor.group.visible = false;
      entry.anchor.visible = false;
      this.#resetTracking(entry);
      entry.overlays.forEach((o) => o.hide?.({ immediate: true }));
    }
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.perf.last = performance.now();
    this.mindar.controller.processVideo(this.mindar.video);
  }

  stop() {
    if (!this.mindar) return;
    clearInterval(this.perf.timer);
    try {
      this.mindar.renderer.setAnimationLoop(null);
      if (this.running) this.mindar.stop();
    } catch (err) {
      console.warn('Erro ao parar a câmera', err);
    }
    this.entries.forEach((e) => e.overlays.forEach((o) => o.dispose?.()));
    this.mindar.renderer.dispose();
    this.container.replaceChildren();
    this.overlayLayer.replaceChildren();
    this.entries = [];
    this.mindar = null;
    this.running = false;
    this.paused = false;
  }
}

// Limite inicial de cartazes rastreados ao mesmo tempo, pelo aparelho. O
// Safari não informa memória: fica no valor intermediário.
function deviceLimit() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (cores >= 8 && memory >= 6) return 6;
  if (cores <= 4 && memory <= 3) return 3;
  return 4;
}
