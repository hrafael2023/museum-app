import { h, icons, iconButton } from '../dom.js';
import { settings } from '../../core/settings.js';
import { offline, formatBytes } from '../../offline/offline.js';
import { narrator } from '../../audio/narrator.js';
import { VERSION } from '../../core/version.js';

export function settingsView(root) {
  // Áudio
  const audioToggle = h('input', {
    type: 'checkbox',
    role: 'switch',
    id: 'set-audio',
    checked: settings.get('audio'),
    onchange: (e) => {
      settings.set('audio', e.target.checked);
      if (!e.target.checked) narrator.stop();
    },
  });

  // Download offline
  const offlineStatus = h('p', { class: 'setting__hint' }, 'Verificando…');
  const progress = h('progress', { max: '1', value: '0', hidden: true });
  const downloadBtn = h('button', { class: 'btn btn--primary', type: 'button', html: `${icons.download}<span>Baixar conteúdo</span>` });
  const removeBtn = h('button', { class: 'btn btn--ghost', type: 'button', hidden: true }, 'Remover do aparelho');

  async function refresh() {
    if (!offline.supported) {
      offlineStatus.textContent = 'Este navegador não permite guardar o conteúdo para usar sem internet.';
      downloadBtn.hidden = true;
      return;
    }
    const st = await offline.status();
    if (st.downloaded) {
      offlineStatus.textContent = 'Conteúdo baixado. O app funciona sem internet neste aparelho.';
      downloadBtn.querySelector('span').textContent = 'Atualizar download';
      removeBtn.hidden = false;
    } else {
      offlineStatus.textContent = st.missing < st.total
        ? 'Download incompleto. Baixe de novo para usar sem internet.'
        : 'Baixe antes da visita para usar em lugares sem conexão (cerca de 10 MB).';
      downloadBtn.querySelector('span').textContent = 'Baixar conteúdo';
      removeBtn.hidden = true;
    }
  }

  const offProgress = offline.on('progress', ({ done, total, bytes }) => {
    progress.max = total;
    progress.value = done;
    offlineStatus.textContent = `Baixando… ${done} de ${total} arquivos (${formatBytes(bytes)})`;
  });

  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    removeBtn.hidden = true;
    progress.hidden = false;
    try {
      const { bytes } = await offline.download();
      await refresh();
      offlineStatus.textContent = `Pronto: ${formatBytes(bytes)} guardados. O app funciona sem internet neste aparelho.`;
    } catch (err) {
      console.error(err);
      offlineStatus.textContent = 'O download falhou. Verifique a conexão e tente de novo.';
    } finally {
      downloadBtn.disabled = false;
      progress.hidden = true;
    }
  });

  removeBtn.addEventListener('click', async () => {
    await offline.remove();
    refresh();
  });

  root.append(
    h('main', { class: 'page settings' },
      h('div', { class: 'topbar topbar--light topbar--sticky' },
        iconButton('back', 'Voltar', () => (history.length > 1 ? history.back() : (location.hash = '#/'))),
        h('h1', { class: 'topbar__title' }, 'Ajustes'),
        h('span'),
      ),
      h('section', { class: 'setting' },
        h('div', { class: 'setting__row' },
          h('label', { for: 'set-audio' },
            h('strong', {}, 'Áudio'),
            h('span', { class: 'setting__hint' }, 'Narração dos conteúdos e modo audioguia.'),
          ),
          h('span', { class: 'switch' }, audioToggle, h('span', { class: 'switch__track', 'aria-hidden': 'true' })),
        ),
      ),
      h('section', { class: 'setting' },
        h('strong', {}, 'Usar sem internet'),
        offlineStatus,
        progress,
        h('div', { class: 'setting__actions' }, downloadBtn, removeBtn),
      ),
      h('p', { class: 'settings__version' }, `Museum App · v${VERSION}`),
    ),
  );

  refresh();
  return () => offProgress();
}
