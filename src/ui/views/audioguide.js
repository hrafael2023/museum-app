import { h, icons, header, headerAction } from '../dom.js';
import { go } from '../router.js';
import { getItems } from '../../content/repository.js';
import { narrator } from '../../audio/narrator.js';
import { settings } from '../../core/settings.js';

// Audioguia: ouvir o conteúdo sem precisar ler a tela.
// Dois caminhos: apontar a câmera (toque no ícone de som sobre o cartaz)
// ou escolher na lista.
export function audioGuideView(root) {
  const enabled = settings.get('audio');
  const rows = getItems().map((item) => {
    const btn = h('button', { class: 'ds-icon-btn', type: 'button', 'aria-label': `Ouvir ${item.title}`, onclick: () => narrator.toggle(item) });
    const sync = () => {
      const playing = narrator.isPlaying(item);
      btn.innerHTML = playing ? icons.pause : icons.play;
      btn.classList.toggle('ds-icon-btn--primary', playing);
      btn.setAttribute('aria-label', `${playing ? 'Pausar' : 'Ouvir'} ${item.title}`);
      row.classList.toggle('is-playing', playing);
    };
    const row = h('li', { class: 'guide-row' },
      h('img', { class: 'guide-row__thumb', src: item.target.image, alt: '' }),
      h('a', { class: 'guide-row__text', href: `#/item/${item.id}` },
        h('span', { class: 't-label' }, item.kind),
        h('strong', { class: 'guide-row__title' }, item.title),
        h('span', { class: 'guide-row__sub' }, item.subtitle ?? ''),
      ),
      enabled && btn,
    );
    sync();
    row.sync = sync;
    return row;
  });
  const off = narrator.on('state', () => rows.forEach((r) => r.sync()));

  root.append(
    h('main', { class: 'page guide' },
      header({ back: () => go(''), right: headerAction('gear', 'Ajustes', () => go('ajustes')) }),
      h('h1', { class: 't-title page__title ds-band' }, 'Audioguia'),
      enabled
        ? h('div', { class: 'guide__intro' },
            h('p', { class: 't-body' }, 'Aponte a câmera para um cartaz e toque no ícone de som que aparece sobre ele. Você também pode escolher na lista abaixo.'),
            h('button', { class: 'ds-btn ds-btn--primary ds-btn--block', type: 'button', onclick: () => { narrator.unlock(); go('camera?modo=audio'); }, html: `<span>Ouvir com a câmera</span>${icons.camera}` }),
          )
        : h('div', { class: 'ds-banner guide__off' },
            h('p', {}, 'O áudio está desligado nos ajustes.'),
            h('button', { class: 'ds-btn ds-btn--inverse', type: 'button', onclick: () => go('ajustes') }, 'Abrir ajustes'),
          ),
      h('ul', { class: 'ds-list guide-list' }, rows),
    ),
  );
  return () => { off(); narrator.stop(); };
}
