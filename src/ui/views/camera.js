import { h, icons, iconButton, header, headerAction } from '../dom.js';
import { go } from '../router.js';
import { getExhibition, getItems } from '../../content/repository.js';
import { ImageTracker } from '../../ar/tracker.js';
import { narrator } from '../../audio/narrator.js';
import { settings } from '../../core/settings.js';
import { openSheet } from '../content.js';

// Tela da câmera. Dois modos:
//  - "ver":   um círculo aparece sobre o cartaz reconhecido; tocar abre o conteúdo.
//  - "ouvir": o áudio do cartaz reconhecido começa sozinho (audioguia).
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
      // Se já há um cartaz na câmera, começa a tocar sem esperar ele sumir e voltar.
      const last = [...visible.values()].pop();
      if (last && narrator.item?.id !== last.id) narrator.play(last);
    } else {
      narrator.stop();
    }
    updateHint();
  }

  const visible = new Map(); // id -> item dos cartazes na câmera agora
  function updateHint() {
    if (!tracker.running) return;
    if (visible.size) {
      hint.textContent = mode === 'audio' ? '' : 'Toque no círculo para abrir';
    } else {
      hint.textContent = mode === 'audio'
        ? 'Aponte para um cartaz para ouvir'
        : 'Aponte a câmera para um cartaz';
    }
    hint.hidden = !hint.textContent;
  }

  // Marca o círculo do cartaz cujo áudio está tocando: vira um ícone de som
  // que acompanha o cartaz na câmera (no modo Ouvir é o único que aparece).
  function markPlaying() {
    const { status, item } = narrator;
    for (const b of overlayLayer.querySelectorAll('.ds-hotspot')) {
      const on = !!item && status !== 'stopped' && b.dataset.item === item.id;
      b.classList.toggle('is-audio', on);
      b.classList.toggle('is-paused', on && status !== 'playing');
    }
  }

  function renderPlayer() {
    markPlaying();
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
    visible.set(item.id, item);
    navigator.vibrate?.(30);
    if (mode === 'audio' && narrator.item?.id !== item.id) narrator.play(item);
    updateHint();
  });
  tracker.on('lost', ({ item }) => {
    visible.delete(item.id);
    updateHint();
  });
  tracker.on('select', ({ item }) => openItem(item));

  setMode(mode);
  renderPlayer();

  tracker.start().then(() => { markPlaying(); updateHint(); }).catch((err) => {
    console.error(err);
    hint.hidden = false;
    hint.classList.add('camera__hint--error');
    hint.textContent = window.isSecureContext
      ? 'Não foi possível abrir a câmera. Verifique se o navegador tem permissão para usá-la e tente de novo.'
      : 'A câmera só funciona em endereço seguro (https).';
  });

  return () => {
    closeSheet?.();
    offNarrator();
    narrator.stop();
    tracker.stop();
  };
}
