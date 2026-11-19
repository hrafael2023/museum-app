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
// A implementação usa MindAR (reconhecimento de imagens no navegador) e three.js
// (camada 3D). Para trocar de motor (ex.: WebXR, 8th Wall), basta outra classe
// com a mesma interface: start(), stop(), pause(), resume() e os eventos acima.
export class ImageTracker extends Emitter {
  constructor({ container, overlayLayer, targetsSrc, items, maxTrack = 1 }) {
    super();
    this.container = container;
    this.overlayLayer = overlayLayer;
    this.targetsSrc = targetsSrc;
    this.items = items;
    this.maxTrack = maxTrack;
    this.mindar = null;
    this.entries = []; // { item, anchor, overlays, visible }
    this.running = false;
    this.paused = false;
  }

  async start() {
    const THREE = await import('three');
    const { MindARThree } = await import('../../vendor/mind-ar/mindar-image-three.prod.js');
    this.THREE = THREE;

    this.mindar = new MindARThree({
      container: this.container,
      imageTargetSrc: this.targetsSrc,
      maxTrack: this.maxTrack,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      filterMinCF: 0.0001,
      filterBeta: 0.001,
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
        entry.visible = true;
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
    this.running = true;

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      const size = { width: this.container.clientWidth, height: this.container.clientHeight };
      for (const entry of this.entries) {
        if (entry.visible) entry.overlays.forEach((o) => o.update?.(dt, size));
      }
      renderer.render(scene, camera);
    });
  }

  // Para o processamento (economiza bateria) sem desligar a câmera.
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.mindar.controller.stopProcessVideo();
    for (const entry of this.entries) {
      if (entry.visible) this.emit('lost', { item: entry.item });
      entry.visible = false;
      entry.anchor.group.visible = false;
      entry.anchor.visible = false;
      entry.overlays.forEach((o) => o.hide?.());
    }
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.mindar.controller.processVideo(this.mindar.video);
  }

  stop() {
    if (!this.mindar) return;
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
