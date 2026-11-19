import { bus } from './events.js';

// Preferências do visitante, guardadas no aparelho.
const KEY = 'museum-app:settings';
const DEFAULTS = {
  audio: true,        // narração habilitada
  debug: false,       // painel de diagnóstico de desempenho na câmera
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

let state = load();

export const settings = {
  get(key) {
    return state[key];
  },
  set(key, value) {
    state = { ...state, [key]: value };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* modo privado */ }
    bus.emit('settings:change', { key, value, state });
  },
  all() {
    return { ...state };
  },
};
