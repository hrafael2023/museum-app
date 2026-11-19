# Museum App

App web para exposições: o visitante aponta a câmera do celular para um cartaz
ou uma obra, um círculo aparece sobre a imagem reconhecida e, ao tocar nele, abre
o conteúdo. Também funciona como audioguia e pode ser baixado para usar sem
internet.

Publicado no GitHub Pages: https://hrafael2023.github.io/museum-app/

Primeiro teste: 6 cartazes do Instituto Tomie Ohtake.

## Como usar

- **Explorar com a câmera**: aponte para um cartaz. Quando ele é reconhecido,
  aparece um círculo rosa pulsando no centro. Toque no círculo para abrir o conteúdo.
- **Audioguia**: aponte a câmera e o áudio do cartaz começa sozinho, sem precisar
  tocar na tela. Sobre o cartaz que está tocando fica um ícone de som
  que acompanha a imagem. Também dá para escolher o conteúdo numa lista e só ouvir.
- **Ajustes**: liga e desliga o áudio e baixa o conteúdo para usar sem internet.

Funciona no navegador do celular (Safari no iPhone, Chrome no Android), sem
instalar nada. Também pode ser adicionado à tela inicial.

## Rodar no computador

```bash
python3 tools/servidor.py
```

Abra http://localhost:8000. Para testar sem câmera, use a câmera simulada, que
mostra uma imagem no lugar da câmera:

http://localhost:8000/?camerateste=assets/test/folha-cartazes.jpg#/camera

## Estrutura

```
index.html                 página única do app
data/exhibition.json       conteúdo da exposição (textos, imagens, alvos, camadas)
assets/targets/            imagens de referência dos cartazes e targets.mind compilado
assets/content/            imagens dos conteúdos
src/
  main.js                  inicialização
  core/                    eventos, ajustes do visitante, versão
  content/repository.js    leitura do exhibition.json
  ar/tracker.js            câmera + reconhecimento de imagens (MindAR) + cena 3D (three.js)
  ar/overlays/             camadas sobre o alvo: hotspot (círculo), outline (moldura 3D)
  audio/narrator.js        audioguia: áudio gravado ou voz do aparelho
  offline/offline.js       download do pacote para usar sem internet
  ui/                      telas (início, câmera, conteúdo, audioguia, ajustes)
  dev/fake-camera.js       câmera simulada para testes
sw.js                      service worker (cache e funcionamento offline)
tools/compilar-alvos.html  gera assets/targets/targets.mind a partir das imagens
tools/servidor.py          servidor local que também salva o targets.mind
vendor/                    MindAR 1.2.5 e three.js 0.160 (cópias locais, para o offline)
```

Sem etapa de build: é HTML, CSS e JavaScript (módulos ES) servidos como estão.

## Como evoluir

**Adicionar ou trocar um cartaz/obra**
1. Coloque uma foto de frente, bem iluminada, em `assets/targets/`.
   Quanto mais detalhe e contraste, melhor o reconhecimento.
2. Adicione o item em `data/exhibition.json` (a ordem dos itens é o índice do alvo).
3. Rode `python3 tools/servidor.py`, abra http://localhost:8000/tools/compilar-alvos.html
   e clique em **Compilar**. O `targets.mind` é salvo no projeto.

**Áudio gravado**: em vez da voz do aparelho, ponha um arquivo em
`assets/audio/` e preencha `"audio": { "src": "assets/audio/x.mp3" }` no item.
Para mudar só o texto narrado, use `"audio": { "script": "..." }`.

**Elementos 3D sobre a câmera**: cada item lista suas camadas em `"overlays"`.
Para um novo tipo (modelo 3D, vídeo, animação), crie um arquivo em
`src/ar/overlays/`, registre em `src/ar/overlays/index.js` e use no item, por
exemplo `{ "type": "modelo", "src": "assets/models/obra.glb" }`. A camada recebe
`anchor.group`, um grupo do three.js preso ao alvo (largura 1 = largura da
imagem), onde é só adicionar objetos 3D. `outline.js` (uma moldura 3D sobre o
alvo, hoje desligada) é um exemplo pronto: use `{ "type": "outline" }`.

**Trocar o visual**: veja a seção Design system abaixo. As telas são funções
independentes em `src/ui/views/`.

**Trocar o motor de reconhecimento** (ex.: WebXR ou um app nativo): basta uma
classe com a mesma interface de `ImageTracker` (`start`, `stop`, `pause`,
`resume` e os eventos `found`, `lost`, `select`).

## Design system

O visual segue o site do Instituto Tomie Ohtake. A referência fica em
[design-system.html](https://hrafael2023.github.io/museum-app/design-system.html).

- fundo branco e texto preto; o rosa `#EC0C6D` marca estrutura e ação (fios,
  rótulos, bordas, botões);
- cantos retos e faixas horizontais separadas por fios rosa de 2 px;
- uma família tipográfica usada em várias larguras, da comprimida à expandida.

Arquivos:
- `styles/tokens.css`: cores, fontes, escala de texto, espaços, fios. Para outra
  instituição, troque estes valores.
- `styles/components.css`: peças reutilizáveis (cabeçalho, letreiro, botões,
  listas, interruptor, faixa de aviso, hotspot), só com tokens.
- `styles/app.css`: layout de cada tela.

**Fonte:** o site usa a Chromatic, que é comercial. O app usa a
[Archivo](https://github.com/Omnibus-Type/Archivo) (licença SIL OFL, em
`assets/fonts/`), que tem eixo de largura de 62% a 125% e cobre os mesmos papéis.
Se o Instituto ceder os arquivos da Chromatic, basta declarar os `@font-face`
em `tokens.css`: ela está primeiro em cada pilha de fontes e passa a ser usada.
O letreiro animado usa a [Fragment Mono](https://github.com/weiweihuanghuang/fragment-mono)
(SIL OFL), próxima da tipografia do título da exposição; o texto vem de
`"marquee"` no `exhibition.json`.

## Versão

A versão fica em `VERSAO`, `src/core/version.js` e `CACHE_VERSION` no `sw.js`.
Atualize os três a cada publicação. Ela aparece no rodapé da tela inicial e nos ajustes.

## Créditos

Textos e imagens: Instituto Tomie Ohtake (institutotomieohtake.org.br).
Reconhecimento de imagens: [MindAR](https://github.com/hiukim/mind-ar-js) (MIT).
3D: [three.js](https://threejs.org) (MIT).
