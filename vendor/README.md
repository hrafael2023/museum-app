# Bibliotecas de terceiros

Cópias locais (para o app funcionar offline), sem etapa de build.

- `three/`: three.js 0.160.0 (MIT), `build/three.module.js` e `CSS3DRenderer`.
- `mind-ar/`: MindAR 1.2.5 (MIT), arquivos de `dist/`.

## Alteração local no MindAR

`mind-ar/controller-mGt1s8dJ.js`, em `_trackAndUpdate`: o mínimo de pontos
rastreados para continuar seguindo um alvo era fixo em 4. Virou
`this.minTrackPoints ?? 4`, ajustado em `src/ar/tracker.js`. Com 4, o
rastreador às vezes continuava "preso" na textura ao redor depois que o cartaz
saía da câmera, e as marcações ficavam na tela. Ao atualizar o MindAR, refaça
essa alteração (procure por `museum-app`).
