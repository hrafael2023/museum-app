// Barramento de eventos mínimo. Módulos conversam por eventos, sem se importar
// diretamente, para que a interface possa ser trocada sem mexer no resto.
export class Emitter {
  #handlers = new Map();

  on(type, fn) {
    if (!this.#handlers.has(type)) this.#handlers.set(type, new Set());
    this.#handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.#handlers.get(type)?.delete(fn);
  }

  emit(type, detail) {
    for (const fn of this.#handlers.get(type) ?? []) fn(detail);
  }
}

// Eventos globais do app (ex.: 'item:open', 'settings:change').
export const bus = new Emitter();
