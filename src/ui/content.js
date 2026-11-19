import { h, icons } from './dom.js';
import { narrator } from '../audio/narrator.js';
import { settings } from '../core/settings.js';

// Conteúdo completo de um item: imagens, textos, botão de ouvir e link do site.
export function renderContent(item, { onClose } = {}) {
  const listenBtn = h('button', { class: 'btn btn--listen', type: 'button', onclick: () => narrator.toggle(item) });
  const syncListen = () => {
    const playing = narrator.isPlaying(item);
    listenBtn.innerHTML = `${playing ? icons.pause : icons.play}<span>${playing ? 'Pausar áudio' : 'Ouvir'}</span>`;
    listenBtn.hidden = !settings.get('audio');
  };
  syncListen();
  const offState = narrator.on('state', syncListen);

  const gallery = h('div', { class: 'gallery', tabindex: '0', 'aria-label': 'Imagens' },
    (item.images ?? []).map((img) =>
      h('figure', {}, h('img', { src: img.src, alt: img.alt ?? '', loading: 'lazy', decoding: 'async' }))
    )
  );

  const el = h('article', { class: 'content' },
    h('header', { class: 'content__head' },
      h('p', { class: 'eyebrow' }, item.kind),
      h('h1', { class: 'content__title' }, item.title),
      item.subtitle && h('p', { class: 'content__subtitle' }, item.subtitle),
      h('p', { class: 'content__meta' }, item.dates, item.info && h('br'), item.info),
      h('div', { class: 'content__actions' }, listenBtn),
    ),
    gallery,
    h('div', { class: 'content__body' },
      item.summary && h('p', { class: 'lead' }, item.summary),
      (item.sections ?? []).map((s) =>
        h('section', {}, s.heading && h('h2', {}, s.heading), s.paragraphs.map((p) => h('p', {}, p)))
      ),
      h('a', { class: 'btn btn--ghost', href: item.url, target: '_blank', rel: 'noopener', html: `${icons.external}<span>Ver no site do Instituto</span>` }),
    ),
  );

  return {
    el,
    destroy() {
      offState();
      if (narrator.item?.id === item.id) narrator.stop();
      onClose?.();
    },
  };
}

// Abre o conteúdo como painel por cima da tela atual (usado na câmera).
export function openSheet(item, { onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const content = renderContent(item);
  const close = () => {
    sheet.classList.remove('is-open');
    setTimeout(() => sheet.remove(), 250);
    document.removeEventListener('keydown', onKey);
    content.destroy();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const closeBtn = h('button', { class: 'icon-btn sheet__close', type: 'button', 'aria-label': 'Fechar', html: icons.close, onclick: close });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': item.title },
    h('div', { class: 'sheet__backdrop', onclick: close }),
    h('div', { class: 'sheet__panel' }, closeBtn, content.el),
  );
  root.append(sheet);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  closeBtn.focus({ preventScroll: true });
  return close;
}
