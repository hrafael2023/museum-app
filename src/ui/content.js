import { h, icons } from './dom.js';
import { narrator } from '../audio/narrator.js';
import { settings } from '../core/settings.js';

// Conteúdo completo de um item: imagens, textos, botão de ouvir e link do site.
export function renderContent(item, { onClose } = {}) {
  const listenBtn = h('button', { class: 'ds-btn ds-btn--primary', type: 'button', onclick: () => narrator.toggle(item) });
  const syncListen = () => {
    const playing = narrator.isPlaying(item);
    listenBtn.innerHTML = `${playing ? icons.pause : icons.play}<span>${playing ? 'Pausar áudio' : 'Ouvir'}</span>`;
    listenBtn.hidden = !settings.get('audio');
  };
  syncListen();
  const offState = narrator.on('state', syncListen);

  const el = h('article', { class: 'content' },
    h('header', { class: 'ds-infoblock ds-band' },
      h('p', { class: 't-label' }, item.kind),
      h('p', { class: 't-meta' }, item.dates),
      item.info && h('p', { class: 't-meta' }, item.info),
    ),
    h('div', { class: 'content__head ds-band' },
      h('h1', { class: 't-title content__title' }, item.title),
      item.subtitle && h('p', { class: 't-lead content__subtitle' }, item.subtitle),
      h('div', { class: 'content__actions' }, listenBtn),
    ),
    gallery(item.images ?? []),
    h('div', { class: 'content__body t-body' },
      item.summary && h('p', { class: 't-lead content__lead' }, item.summary),
      (item.sections ?? []).map((s) =>
        h('section', { class: 'content__section' }, s.heading && h('h2', { class: 't-section' }, s.heading), s.paragraphs.map((p) => h('p', {}, p)))
      ),
    ),
    h('div', { class: 'content__footer' },
      h('a', { class: 'ds-btn', href: item.url, target: '_blank', rel: 'noopener', html: `<span>Ver no site do Instituto</span>${icons.external}` }),
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

// Galeria com contador e setas, como nas páginas do site.
function gallery(images) {
  if (!images.length) return null;
  const counter = h('span', { class: 't-counter' }, `1 / ${images.length}`);
  const strip = h('div', { class: 'gallery__strip', tabindex: '0', 'aria-label': 'Imagens' },
    images.map((img) => h('figure', {}, h('img', { src: img.src, alt: img.alt ?? '', loading: 'lazy', decoding: 'async' }))));
  const step = (dir) => strip.scrollBy({ left: dir * strip.clientWidth, behavior: 'smooth' });
  strip.addEventListener('scroll', () => {
    const i = Math.round(strip.scrollLeft / strip.clientWidth);
    counter.textContent = `${Math.min(images.length, i + 1)} / ${images.length}`;
  }, { passive: true });
  return h('div', { class: 'gallery ds-band' },
    h('div', { class: 'gallery__bar ds-band' },
      counter,
      images.length > 1 && h('span', { class: 'gallery__arrows' },
        h('button', { class: 'ds-icon-btn ds-icon-btn--bare', type: 'button', 'aria-label': 'Imagem anterior', html: icons.arrowLeft, onclick: () => step(-1) }),
        h('button', { class: 'ds-icon-btn ds-icon-btn--bare', type: 'button', 'aria-label': 'Próxima imagem', html: icons.arrowRight, onclick: () => step(1) }),
      ),
    ),
    strip,
  );
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
  const closeBtn = h('button', { class: 'ds-header__action t-nav sheet__close', type: 'button', html: `${icons.close}<span>Fechar</span>`, onclick: close });
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': item.title },
    h('div', { class: 'sheet__backdrop', onclick: close }),
    h('div', { class: 'sheet__panel' }, h('div', { class: 'ds-header sheet__header' }, closeBtn, h('div', { class: 'ds-header__center' })), content.el),
  );
  root.append(sheet);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  closeBtn.focus({ preventScroll: true });
  return close;
}
