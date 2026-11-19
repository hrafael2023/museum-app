import { h, icons, iconButton, header, headerAction } from '../dom.js';
import { go } from '../router.js';
import { getExhibition, getItems, getItem } from '../../content/repository.js';
import { ImageTracker } from '../../ar/tracker.js';
import { narrator } from '../../audio/narrator.js';
import { settings } from '../../core/settings.js';
import { openSheet } from '../content.js';

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

  // Marcador fixo no centro da tela: aparece quando um cartaz é reconhecido e
  // não acompanha o movimento da câmera (fica estável para tocar).
  const markerButton = h('button', {
    class: 'ds-hotspot camera__marker-btn', type: 'button',
    html: '<span class="ds-hotspot__ring"></span><span class="ds-hotspot__dot"></span>'
      + '<span class="ds-hotspot__eq" aria-hidden="true"><i></i><i></i><i></i></span>',
    onclick: () => {
      const item = current && getItem(current);
      if (!item) return;
      if (mode === 'audio') narrator.toggle(item);
      else openItem(item);
    },
  });
  const markerTitle = h('span', { class: 'camera__marker-title t-meta' });
  const marker = h('div', { class: 'camera__marker', hidden: true }, markerButton, markerTitle);

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
    marker,
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
  let current = null;        // id do cartaz que o marcador representa
  const lostTimers = new Map();
  const GRACE_MS = 800;      // perdas curtas (tremida, reflexo) não somem com o marcador

  function setCurrent(id) {
    current = id;
    marker.hidden = !current;
    markerTitle.textContent = current ? getItem(current)?.title ?? '' : '';
    paintHotspots();
    updateHint();
  }
  function updateHint() {
    if (!tracker.running) return;
    if (current) {
      hint.textContent = mode === 'audio' ? 'Toque no ícone para ouvir' : 'Toque no círculo para abrir';
    } else {
      hint.textContent = mode === 'audio'
        ? 'Aponte para um cartaz para ouvir'
        : 'Aponte a câmera para um cartaz';
    }
    hint.hidden = !hint.textContent;
  }

  // Desenha o marcador (e eventuais círculos presos aos cartazes) conforme o
  // modo e o áudio: no modo Ouvir vira um ícone de som parado; se o áudio
  // daquele cartaz está tocando, fica animado.
  function paintHotspots() {
    const { status, item } = narrator;
    markerButton.dataset.item = current ?? '';
    for (const b of [markerButton, ...overlayLayer.querySelectorAll('.ds-hotspot')]) {
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
    maxTrack: ex.ar.maxTrack ?? 1,
  });

  window.museumDebug = { tracker }; // facilita a inspeção pelo console

  tracker.on('found', ({ item }) => {
    clearTimeout(lostTimers.get(item.id));
    lostTimers.delete(item.id);
    const isNew = !visible.has(item.id);
    visible.set(item.id, item);
    if (!current) {
      navigator.vibrate?.(30);
      setCurrent(item.id);
    } else if (isNew) updateHint();
  });
  tracker.on('lost', ({ item }) => {
    // Espera um pouco antes de tirar o marcador: se o cartaz voltar logo, nada muda.
    clearTimeout(lostTimers.get(item.id));
    lostTimers.set(item.id, setTimeout(() => {
      lostTimers.delete(item.id);
      visible.delete(item.id);
      if (current === item.id) setCurrent([...visible.keys()].pop() ?? null);
      else updateHint();
    }, closeSheet ? 0 : GRACE_MS));
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
    lostTimers.forEach(clearTimeout);
    offNarrator();
    narrator.stop();
    tracker.stop();
  };
}
