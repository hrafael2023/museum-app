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
essas alterações (procure por `museum-app`).

No mesmo arquivo, no fim do laço de `processVideo`: depois de cada quadro,
espera `this.idleDelay` milissegundos se esse valor existir. O
`src/ar/tracker.js` usa isso para analisar menos quadros por segundo quando
nenhum cartaz está na câmera, o que poupa bateria e aquecimento.
