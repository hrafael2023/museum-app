import { h, icons, iconButton, header, headerAction } from '../dom.js';
import { go } from '../router.js';
import { getExhibition, getItems, getItem } from '../../content/repository.js';
import { ImageTracker } from '../../ar/tracker.js';
import { narrator } from '../../audio/narrator.js';
import { settings } from '../../core/settings.js';
import { openSheet } from '../content.js';
import { VERSION } from '../../core/version.js';

// Tela da câmera. Dois modos:
//  - "ver":   um círculo aparece sobre o cartaz reconhecido; tocar abre o conteúdo.
//  - "ouvir": o círculo vira um ícone de som; tocar nele toca o áudio (audioguia).
export function cameraView(root, { query }) {
  const audioOn = settings.get('audio');
  let mode = audioOn && query.get('modo') === 'audio' ? 'audio' : 'ver';
  let closeSheet = null;

  const arContainer = h('div', { class: 'camera__ar' });
  const overlayLayer = h('div', { class: 'camera__overlays' });
  const hint = h('p', { class: 'camera__hint t-meta' }, 'Preparando a câmera…');
  const player = h('div', { class: 'player', hidden: true });

  const modeSwitch = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Modo' });
  const modeButtons = [
    ['ver', 'Ver'],
    ['audio', 'Ouvir'],
  ].map(([value, label]) => {
    const b = h('button', { class: 't-nav', type: 'button', role: 'radio', onclick: () => setMode(value) }, label);
    b.dataset.value = value;
    modeSwitch.append(b);
    return b;
  });

  const el = h('main', { class: 'camera' },
    arContainer,
    overlayLayer,
    header({ back: () => go(''), center: audioOn ? modeSwitch : null, right: headerAction('gear', 'Ajustes', () => go('ajustes')) }),
    hint,
    player,
  );
  root.append(el);

  function setMode(value) {
    mode = value;
    el.dataset.mode = mode;
    modeButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === mode)));
    if (mode === 'audio') {
      narrator.unlock();
    } else {
      narrator.stop();
    }
    paintHotspots();
    updateHint();
  }

  const visible = new Map(); // id -> item dos cartazes na câmera agora
  function updateHint() {
    if (!tracker.running) return;
    if (visible.size) {
      hint.textContent = mode === 'audio' ? 'Toque no ícone para ouvir' : 'Toque no círculo para abrir';
    } else {
      hint.textContent = mode === 'audio'
        ? 'Aponte para um cartaz para ouvir'
        : 'Aponte a câmera para um cartaz';
    }
    hint.hidden = !hint.textContent;
  }

  // Desenha os círculos conforme o modo e o áudio: no modo Ouvir todos viram
  // ícones de som parados; o do cartaz que está tocando fica animado.
  function paintHotspots() {
    const { status, item } = narrator;
    for (const b of overlayLayer.querySelectorAll('.ds-hotspot')) {
      const on = !!item && status !== 'stopped' && b.dataset.item === item.id;
      const title = getItem(b.dataset.item)?.title ?? '';
      b.classList.toggle('ds-hotspot--audio', mode === 'audio');
      b.classList.toggle('is-audio', on);
      b.classList.toggle('is-paused', on && status !== 'playing');
      b.setAttribute('aria-label', mode !== 'audio' ? `Abrir ${title}`
        : on && status === 'playing' ? `Pausar ${title}` : `Ouvir ${title}`);
    }
  }

  function renderPlayer() {
    paintHotspots();
    const { status, item } = narrator;
    if (!item || status === 'stopped') {
      player.hidden = true;
      return;
    }
    player.hidden = false;
    player.replaceChildren(
      h('button', { class: 'player__info', type: 'button', onclick: () => openItem(item) },
        h('span', { class: 't-label' }, status === 'playing' ? 'Tocando' : 'Pausado'),
        h('strong', { class: 'player__title' }, item.title),
      ),
      iconButton(status === 'playing' ? 'pause' : 'play', status === 'playing' ? 'Pausar' : 'Continuar',
        () => (status === 'playing' ? narrator.pause() : narrator.resume()), 'ds-icon-btn--primary'),
      iconButton('stop', 'Parar', () => narrator.stop()),
    );
  }
  const offNarrator = narrator.on('state', renderPlayer);

  function openItem(item) {
    if (closeSheet) return;
    tracker.pause();
    closeSheet = openSheet(item, {
      onClose: () => {
        closeSheet = null;
        tracker.resume();
      },
    });
  }

  const ex = getExhibition();
  const tracker = new ImageTracker({
    container: arContainer,
    overlayLayer,
    targetsSrc: ex.ar.targets,
    items: getItems(),
    // Todos os cartazes que estiverem na câmera ao mesmo tempo ganham um círculo.
    maxTrack: ex.ar.maxTrack ?? getItems().length,
  });

  window.museumDebug = { tracker }; // facilita a inspeção pelo console

  // App em segundo plano (troca de app, tela bloqueada): para de processar.
  const onVisibility = () => {
    if (document.hidden) tracker.pause();
    else if (!closeSheet) tracker.resume();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Modo de diagnóstico: ?debug=1 no endereço mostra os números de desempenho.
  const debugOn = new URLSearchParams(location.search).has('debug') || query.has('debug');
  let debugTimer = null;
  if (debugOn) {
    const panel = h('pre', { class: 'camera__debug', 'aria-hidden': 'true' });
    el.append(panel);
    const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
    const targetsSize = () => {
      const entry = performance.getEntriesByType('resource').find((e) => e.name.includes('.mind'));
      return entry && (entry.decodedBodySize || entry.encodedBodySize) ? mb(entry.decodedBodySize || entry.encodedBodySize) : 'n/d';
    };
    debugTimer = setInterval(() => {
      const s = tracker.stats;
      const memory = performance.memory ? mb(performance.memory.usedJSHeapSize) : 'n/d (Safari não informa)';
      panel.textContent = [
        `Quadros na tela:   ${s.renderFps}/s`,
        `Análises:          ${s.analysesPerSec}/s (${s.msPerAnalysis} ms cada)`,
        `Rastreando:        ${s.tracking} cartaz(es)`,
        `Limite simultâneo: ${s.limit} (máximo ${s.ceiling})`,
        `Economia:          ${s.saving ? 'ligada (sem cartaz)' : 'desligada'}`,
        `Catálogo:          ${getItems().length} cartazes, ${targetsSize()}`,
        `Memória JS:        ${memory}`,
        `Aparelho:          ${navigator.hardwareConcurrency || '?'} núcleos, ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'memória n/d'}`,
        `Versão:            ${VERSION}`,
      ].join('\n');
    }, 500);
  }

  tracker.on('found', ({ item }) => {
    visible.set(item.id, item);
    navigator.vibrate?.(30);
    updateHint();
  });
  tracker.on('lost', ({ item }) => {
    visible.delete(item.id);
    updateHint();
  });
  // Tocar no círculo: no modo Ver abre o conteúdo; no Ouvir, toca ou pausa o áudio.
  tracker.on('select', ({ item }) => (mode === 'audio' ? narrator.toggle(item) : openItem(item)));

  setMode(mode);
  renderPlayer();

  tracker.start().then(() => { paintHotspots(); updateHint(); }).catch((err) => {
    console.error(err);
    hint.hidden = false;
    hint.classList.add('camera__hint--error');
    hint.textContent = window.isSecureContext
      ? 'Não foi possível abrir a câmera. Verifique se o navegador tem permissão para usá-la e tente de novo.'
      : 'A câmera só funciona em endereço seguro (https).';
  });

  return () => {
    closeSheet?.();
    clearInterval(debugTimer);
    document.removeEventListener('visibilitychange', onVisibility);
    offNarrator();
    narrator.stop();
    tracker.stop();
  };
}
