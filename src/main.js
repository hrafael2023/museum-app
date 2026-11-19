import { loadExhibition } from './content/repository.js';
import { router } from './ui/router.js';
import { homeView } from './ui/views/home.js';
import { cameraView } from './ui/views/camera.js';
import { itemView } from './ui/views/item.js';
import { audioGuideView } from './ui/views/audioguide.js';
import { settingsView } from './ui/views/settings.js';
import { installFakeCamera } from './dev/fake-camera.js';

const params = new URLSearchParams(location.search);
if (params.get('camerateste')) installFakeCamera(params.get('camerateste'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker', err));
}

async function boot() {
  const app = document.getElementById('app');
  try {
    await loadExhibition();
  } catch (err) {
    app.innerHTML = `<p class="fatal">Não foi possível carregar o conteúdo. Verifique a conexão e tente de novo.</p>`;
    throw err;
  }
  router(app, {
    '': homeView,
    camera: cameraView,
    item: itemView,
    audioguia: audioGuideView,
    ajustes: settingsView,
  });
}

boot();
