// Círculo clicável que acompanha o centro do alvo na tela.
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

  let active = false;
  return {
    show() { active = true; },
    hide() { active = false; button.hidden = true; },
    update(dt, { width, height }) {
      point.copy(local).applyMatrix4(anchor.group.matrixWorld).project(camera);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      // Só aparece com o centro do alvo dentro da tela.
      const onScreen = x >= 0 && x <= width && y >= 0 && y <= height;
      button.hidden = !(active && onScreen);
      button.style.transform = `translate(${x}px, ${y}px)`;
    },
    dispose() { button.remove(); },
  };
}
