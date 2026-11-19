// Círculo clicável sobre o centro do alvo na tela, estabilizado.
// É um botão HTML (acessível, fácil de estilizar), posicionado a cada quadro
// pela projeção do ponto 3D do alvo na câmera.
export function createHotspot(config, { THREE, anchor, item, camera, layer, select }) {
  const button = document.createElement('button');
  button.className = 'ds-hotspot hotspot';
  button.type = 'button';
  button.dataset.item = item.id; // a tela da câmera marca o cartaz cujo áudio está tocando
  button.setAttribute('aria-label', `Abrir ${item.title}`);
  button.innerHTML = '<span class="ds-hotspot__ring"></span><span class="ds-hotspot__dot"></span>'
    + '<span class="ds-hotspot__eq" aria-hidden="true"><i></i><i></i><i></i></span>';
  button.hidden = true;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    select();
  });
  layer.appendChild(button);

  // Ponto do alvo onde o círculo fica (0,0 = centro; unidades da imagem).
  const local = new THREE.Vector3(config.x ?? 0, config.y ?? 0, 0);
  const point = new THREE.Vector3();

  // Estabilização: o círculo não acompanha cada tremida da câmera. Ele só
  // muda de lugar quando o cartaz se desloca de verdade na tela (mais que
  // DEAD_ZONE da menor dimensão), e então desliza até a nova posição. Perdas
  // curtas de reconhecimento (menos de GRACE_MS) também não o fazem sumir.
  const DEAD_ZONE = config.deadZone ?? 0.12;
  const GRACE_MS = config.graceMs ?? 800;
  let active = false;
  let placed = null; // { x, y } onde o círculo está
  let hideTimer = null;

  const moveTo = (x, y, animate) => {
    button.style.transition = animate ? 'transform .35s cubic-bezier(.2, .8, .2, 1)' : 'none';
    button.style.transform = `translate(${x}px, ${y}px)`;
    placed = { x, y };
  };

  return {
    show() {
      clearTimeout(hideTimer);
      hideTimer = null;
      active = true;
    },
    hide() {
      active = false;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!active) { button.hidden = true; placed = null; }
      }, GRACE_MS);
    },
    update(dt, { width, height }) {
      point.copy(local).applyMatrix4(anchor.group.matrixWorld).project(camera);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      // Só aparece com o centro do alvo dentro da tela.
      const onScreen = x >= 0 && x <= width && y >= 0 && y <= height;
      if (!active || !onScreen) {
        if (!onScreen && active && !button.hidden) this.hide();
        return;
      }
      if (button.hidden || !placed) {
        moveTo(x, y, false);
        button.hidden = false;
        return;
      }
      const limit = DEAD_ZONE * Math.min(width, height);
      if (Math.hypot(x - placed.x, y - placed.y) > limit) moveTo(x, y, true);
    },
    dispose() {
      clearTimeout(hideTimer);
      button.remove();
    },
  };
}
