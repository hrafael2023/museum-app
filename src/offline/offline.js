import { Emitter } from '../core/events.js';
import { getExhibition } from '../content/repository.js';

// Pacote offline: guarda no aparelho tudo o que a visita precisa (bibliotecas,
// alvos de reconhecimento, textos e imagens) para funcionar sem internet.
// O service worker (sw.js) serve esses arquivos do cache quando não há rede.
export const OFFLINE_CACHE = 'museum-app-offline';

const VENDOR = [
  'vendor/three/three.module.js',
  'vendor/three/addons/renderers/CSS3DRenderer.js',
  'vendor/mind-ar/mindar-image-three.prod.js',
  'vendor/mind-ar/controller-mGt1s8dJ.js',
  'vendor/mind-ar/ui-fBadYuor.js',
];

export function packageUrls() {
  const ex = getExhibition();
  const urls = new Set([...VENDOR, 'data/exhibition.json', ex.ar.targets]);
  for (const item of ex.items) {
    item.images?.forEach((img) => urls.add(img.src));
    if (item.target?.image) urls.add(item.target.image);
    if (item.audio?.src) urls.add(item.audio.src);
  }
  return [...urls];
}

class OfflineManager extends Emitter {
  get supported() {
    return 'caches' in window && 'serviceWorker' in navigator;
  }

  async status() {
    if (!this.supported) return { downloaded: false, missing: 0, total: 0 };
    const cache = await caches.open(OFFLINE_CACHE);
    const urls = packageUrls();
    let missing = 0;
    for (const url of urls) {
      if (!(await cache.match(url))) missing += 1;
    }
    return { downloaded: missing === 0, missing, total: urls.length };
  }

  async download() {
    const cache = await caches.open(OFFLINE_CACHE);
    const urls = packageUrls();
    let done = 0;
    let bytes = 0;
    this.emit('progress', { done, total: urls.length, bytes });
    for (const url of urls) {
      // cache: 'reload' evita pegar uma versão velha do cache HTTP.
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(`Falha ao baixar ${url}`);
      const blob = await res.clone().blob();
      bytes += blob.size;
      await cache.put(url, res);
      done += 1;
      this.emit('progress', { done, total: urls.length, bytes });
    }
    await navigator.storage?.persist?.();
    return { bytes };
  }

  async remove() {
    await caches.delete(OFFLINE_CACHE);
  }

  async size() {
    if (!navigator.storage?.estimate) return null;
    const { usage } = await navigator.storage.estimate();
    return usage;
  }
}

export const offline = new OfflineManager();

export function formatBytes(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
