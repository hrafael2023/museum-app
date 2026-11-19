import { createHotspot } from './hotspot.js';
import { createOutline } from './outline.js';

// Registro de camadas que aparecem sobre um alvo reconhecido.
// Cada item da exposição lista as suas em "overlays" no exhibition.json.
//
// Para adicionar um novo tipo (ex.: um modelo 3D .glb, um vídeo, uma animação),
// crie um arquivo nesta pasta que exporte uma função (config, ctx) => overlay e
// registre-a aqui. O overlay pode ter: show(), hide(), update(dt, size), dispose().
// ctx traz: THREE, anchor (anchor.group é o grupo 3D preso ao alvo, com largura
// 1 = largura da imagem), item, camera, renderer, layer (div HTML) e select().
const registry = {
  hotspot: createHotspot,
  outline: createOutline,
};

export function registerOverlay(type, factory) {
  registry[type] = factory;
}

export function createOverlays(configs, ctx) {
  return configs
    .map((config) => {
      const factory = registry[config.type];
      if (!factory) {
        console.warn(`Overlay desconhecido: ${config.type}`);
        return null;
      }
      return factory(config, ctx);
    })
    .filter(Boolean);
}
