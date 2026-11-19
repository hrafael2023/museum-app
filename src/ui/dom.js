// Pequenos utilitários de DOM, sem framework.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const icons = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6" /></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" class="fill"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" class="fill"/></svg>',
  stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z" class="fill"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  headphones: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0116 0v3"/><path d="M4 15h3v5H4zM17 15h3v5h-3z"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

export function iconButton(icon, label, onclick, cls = '') {
  return h('button', { class: `ds-icon-btn ${cls}`, type: 'button', 'aria-label': label, title: label, onclick, html: icons[icon] });
}

// Cabeçalho do design system: ação à esquerda (VOLTAR), meio livre, e à
// direita a assinatura da instituição ou outra ação.
export function header({ back, center, right } = {}) {
  const left = back
    ? h('button', { class: 'ds-header__action t-nav', type: 'button', onclick: back, html: `${icons.back}<span>Voltar</span>` })
    : null;
  return h('header', { class: 'ds-header' }, left, h('div', { class: 'ds-header__center' }, center ?? null), right ?? null);
}

export function headerAction(icon, label, onclick) {
  return h('button', { class: 'ds-header__action', type: 'button', 'aria-label': label, title: label, onclick, html: icons[icon] });
}

// Assinatura tipográfica: "INSTITUTO" pequeno + nome grande, a partir do título da exposição.
export function signature(title) {
  const words = title.trim().split(/\s+/);
  const small = words.length > 2 ? words.shift() : '';
  const last = words.pop();
  return h('span', { class: 'ds-signature', 'aria-label': title },
    small && h('span', { class: 'ds-signature__small' }, small),
    h('span', { class: 'ds-signature__big' }, h('span', {}, words.join(' ') + ' '), h('b', {}, last)),
  );
}

export function marquee(words) {
  const items = [...words, ...words, ...words, ...words];
  const track = h('div', { class: 'ds-marquee__track', 'aria-hidden': 'true' },
    [...items, ...items].map((w) => h('span', { class: 'ds-marquee__item' }, w)));
  return h('div', { class: 'ds-marquee' }, track);
}
