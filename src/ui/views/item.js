import { h, header } from '../dom.js';
import { getItem } from '../../content/repository.js';

// Página de um item (#/item/<id>): usada pela lista do audioguia e por links diretos.
import { renderContent } from '../content.js';

export function itemView(root, { params }) {
  const item = getItem(params[0]);
  if (!item) {
    location.hash = '#/';
    return;
  }
  const content = renderContent(item);
  root.append(
    h('div', { class: 'page' },
      header({ back: () => (history.length > 1 ? history.back() : (location.hash = '#/')) }),
      content.el,
    ),
  );
  return () => content.destroy();
}
