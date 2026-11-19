// Roteador por hash: #/camera, #/item/<id>, #/audioguia, #/ajustes.
// Cada view é uma função (root, params) => cleanup opcional.
// Links diretos (#/item/mira-schendel) permitem QR codes e compartilhamento.
export function router(root, views) {
  let cleanup = null;

  async function render() {
    const [name = '', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    const [route, query = ''] = name.split('?');
    const view = views[route] ?? views[''];
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    root.replaceChildren();
    root.dataset.view = route || 'home';
    window.scrollTo(0, 0);
    cleanup = await view(root, { params: rest, query: new URLSearchParams(query) });
  }

  window.addEventListener('hashchange', render);
  render();
}

export function go(path) {
  location.hash = `#/${path}`;
}
