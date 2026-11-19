// Círculo clicável que acompanha o centro do alvo na tela.
// É um botão HTML (acessível, fácil de estilizar), posicionado a cada quadro
// pela projeção do ponto 3D do alvo na câmera.
export function createHotspot(config, { THREE, anchor, item, camera, layer, select }) {
  const button = document.createElement('button');
  button.className = 'hotspot';
  button.type = 'button';
  button.setAttribute('aria-label', `Abrir ${item.title}`);
  button.innerHTML = '<span class="hotspot__ring"></span><span class="hotspot__dot"></span>';
  button.hidden = true;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    select();
  });
  layer.appendChild(button);

  // Ponto do alvo onde o círculo fica (0,0 = centro; unidades da imagem).
  const local = new THREE.Vector3(config.x ?? 0, config.y ?? 0, 0);
  const point = new THREE.Vector3();

  return {
    show() { button.hidden = false; },
    hide() { button.hidden = true; },
    update(dt, { width, height }) {
      point.copy(local).applyMatrix4(anchor.group.matrixWorld).project(camera);
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      button.style.transform = `translate(${x}px, ${y}px)`;
    },
    dispose() { button.remove(); },
  };
}
