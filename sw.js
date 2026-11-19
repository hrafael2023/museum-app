// Service worker do Museum App.
// - Guarda a "casca" do app (HTML, CSS, JS) para ele abrir sem internet.
// - O pacote pesado (bibliotecas, alvos, imagens) entra no cache
//   'museum-app-offline' quando o visitante toca em "Baixar conteúdo".
// Mude CACHE_VERSION a cada publicação (igual ao arquivo VERSAO).
const CACHE_VERSION = '0.3.8';
const SHELL_CACHE = `museum-app-shell-${CACHE_VERSION}`;
const OFFLINE_CACHE = 'museum-app-offline';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/tokens.css',
  'styles/components.css',
  'styles/app.css',
  'assets/fonts/archivo-latin.woff2',
  'assets/fonts/archivo-latin-ext.woff2',
  'assets/fonts/fragment-mono-latin.woff2',
  'assets/fonts/fragment-mono-latin-ext.woff2',
  'assets/icons/icon.svg',
  'src/main.js',
  'src/core/events.js',
  'src/core/settings.js',
  'src/core/version.js',
  'src/content/repository.js',
  'src/ar/tracker.js',
  'src/ar/overlays/index.js',
  'src/ar/overlays/hotspot.js',
  'src/ar/overlays/outline.js',
  'src/audio/narrator.js',
  'src/offline/offline.js',
  'src/dev/fake-camera.js',
  'src/ui/router.js',
  'src/ui/dom.js',
  'src/ui/content.js',
  'src/ui/views/home.js',
  'src/ui/views/camera.js',
  'src/ui/views/item.js',
  'src/ui/views/audioguide.js',
  'src/ui/views/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('museum-app-shell-') && k !== SHELL_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Bibliotecas (vendor/) nunca mudam no mesmo endereço: cache primeiro.
const CACHE_FIRST = /\/vendor\//;
// Conteúdo (assets/: alvos, imagens, áudios) pode ser refeito com o mesmo nome,
// como o targets.mind ao incluir cartazes ou um áudio gerado de novo: rede
// primeiro (o navegador só baixa de novo o que mudou) e cache sem internet.
// Quando a rede traz uma versão nova de algo que está no pacote offline, o
// pacote é atualizado junto.
const CONTENT = /\/assets\//;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  const path = new URL(request.url).pathname;

  if (CACHE_FIRST.test(path)) {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)));
    return;
  }

  if (CONTENT.test(path)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            caches.open(OFFLINE_CACHE).then(async (c) => {
              if (await c.match(request, { ignoreSearch: true })) await c.put(request, copy);
            });
          }
          return res;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || Response.error())),
    );
    return;
  }

  // HTML, JS, CSS e dados: rede primeiro (pega a versão nova), cache se offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && SHELL.some((p) => request.url.endsWith(p.replace('./', '')))) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
