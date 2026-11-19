import { h, icons, header, headerAction, signature, marquee } from '../dom.js';
import { go } from '../router.js';
import { getExhibition, getItems } from '../../content/repository.js';
import { VERSION } from '../../core/version.js';

export function homeView(root) {
  const ex = getExhibition();
  root.append(
    h('main', { class: 'home' },
      header({ center: signature(ex.title), right: headerAction('gear', 'Ajustes', () => go('ajustes')) }),
      marquee([ex.marquee ?? ex.title]),
      h('section', { class: 'home__hero' },
        h('p', { class: 't-label' }, ex.subtitle),
        h('h1', { class: 't-display home__title' }, 'Aponte, toque, ouça'),
        h('p', { class: 't-lead home__lead' }, 'Aponte a câmera para um cartaz ou uma obra. Quando aparecer um círculo, toque nele para ver o conteúdo.'),
      ),
      h('div', { class: 'home__actions' },
        h('button', { class: 'ds-btn ds-btn--primary ds-btn--block', type: 'button', onclick: () => go('camera'), html: `<span>Explorar com a câmera</span>${icons.arrowRight}` }),
        h('button', { class: 'ds-btn ds-btn--block', type: 'button', onclick: () => go('audioguia'), html: `<span>Audioguia</span>${icons.headphones}` }),
      ),
      h('footer', { class: 'home__footer t-meta' },
        h('span', {}, `${getItems().length} conteúdos`),
        h('span', {}, `v${VERSION}`),
      ),
    ),
  );
}
