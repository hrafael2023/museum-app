import { h, icons, iconButton } from '../dom.js';
import { go } from '../router.js';
import { getExhibition } from '../../content/repository.js';
import { VERSION } from '../../core/version.js';

export function homeView(root) {
  const ex = getExhibition();
  root.append(
    h('main', { class: 'home' },
      h('div', { class: 'topbar topbar--light' }, h('span'), iconButton('gear', 'Ajustes', () => go('ajustes'))),
      h('div', { class: 'home__hero' },
        h('p', { class: 'eyebrow' }, ex.title),
        h('h1', { class: 'home__title' }, 'Museum App'),
        h('p', { class: 'home__lead' }, 'Aponte a câmera para um cartaz ou uma obra. Quando aparecer um círculo, toque nele para ver o conteúdo.'),
      ),
      h('div', { class: 'home__actions' },
        h('button', { class: 'btn btn--primary btn--big', type: 'button', onclick: () => go('camera'), html: `${icons.camera}<span>Explorar com a câmera</span>` }),
        h('button', { class: 'btn btn--big', type: 'button', onclick: () => go('audioguia'), html: `${icons.headphones}<span>Audioguia</span>` }),
      ),
      h('footer', { class: 'home__footer' }, `${ex.subtitle} · v${VERSION}`),
    ),
  );
}
