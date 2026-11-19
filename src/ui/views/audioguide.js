import { h, icons, iconButton } from '../dom.js';
import { go } from '../router.js';
import { getItems } from '../../content/repository.js';
import { narrator } from '../../audio/narrator.js';
import { settings } from '../../core/settings.js';

// Audioguia: ouvir o conteúdo sem precisar ler a tela.
// Dois caminhos: apontar a câmera (o áudio começa sozinho ao reconhecer)
// ou escolher na lista.
export function audioGuideView(root) {
  const enabled = settings.get('audio');
  const rows = getItems().map((item) => {
    const btn = h('button', { class: 'icon-btn icon-btn--solid', type: 'button', 'aria-label': `Ouvir ${item.title}`, onclick: () => narrator.toggle(item) });
    const sync = () => {
      const playing = narrator.isPlaying(item);
      btn.innerHTML = playing ? icons.pause : icons.play;
      btn.setAttribute('aria-label', `${playing ? 'Pausar' : 'Ouvir'} ${item.title}`);
      row.classList.toggle('is-playing', playing);
    };
    const row = h('li', { class: 'guide-row' },
      h('img', { class: 'guide-row__thumb', src: item.target.image, alt: '' }),
      h('a', { class: 'guide-row__text', href: `#/item/${item.id}` },
        h('strong', {}, item.title),
        h('span', {}, item.subtitle ?? item.kind),
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
      h('div', { class: 'topbar topbar--light topbar--sticky' },
        iconButton('back', 'Voltar', () => go('')),
        h('h1', { class: 'topbar__title' }, 'Audioguia'),
        iconButton('gear', 'Ajustes', () => go('ajustes')),
      ),
      enabled
        ? h('div', { class: 'guide__intro' },
            h('p', {}, 'Aponte a câmera para um cartaz e o áudio começa sozinho. Você também pode escolher na lista abaixo.'),
            h('button', { class: 'btn btn--primary btn--big', type: 'button', onclick: () => { narrator.unlock(); go('camera?modo=audio'); }, html: `${icons.camera}<span>Ouvir com a câmera</span>` }),
          )
        : h('div', { class: 'notice' },
            h('p', {}, 'O áudio está desligado nos ajustes.'),
            h('button', { class: 'btn', type: 'button', onclick: () => go('ajustes') }, 'Abrir ajustes'),
          ),
      h('ul', { class: 'guide-list' }, rows),
    ),
  );
  return () => { off(); narrator.stop(); };
}
