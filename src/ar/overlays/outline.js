// Moldura 3D desenhada sobre o alvo: mostra que o cartaz foi reconhecido e
// serve de exemplo de conteúdo 3D preso à imagem.
export function createOutline(config, { THREE, anchor, item }) {
  const aspect = item.target?.aspect ?? 1.4; // altura / largura do alvo
  const w = 1;
  const h = aspect;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.lineTo(-w / 2, -h / 2);
  const inner = new THREE.Path();
  const t = 0.012;
  inner.moveTo(-w / 2 + t, -h / 2 + t);
  inner.lineTo(-w / 2 + t, h / 2 - t);
  inner.lineTo(w / 2 - t, h / 2 - t);
  inner.lineTo(w / 2 - t, -h / 2 + t);
  inner.lineTo(-w / 2 + t, -h / 2 + t);
  shape.holes.push(inner);

  const material = new THREE.MeshBasicMaterial({
    color: config.color ?? 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  anchor.group.add(mesh);

  let target = 0;
  return {
    show() { target = 0.9; },
    hide() { target = 0; material.opacity = 0; },
    update(dt) {
      material.opacity += (target - material.opacity) * Math.min(1, dt * 6);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
