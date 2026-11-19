// Câmera simulada para testar no computador: abra o app com
// ?camerateste=assets/test/folha-cartazes.jpg e a "câmera" passa a mostrar essa
// imagem (com um leve movimento), em vez da câmera de verdade.
// No console, window.fakeCamera.show('outra.jpg') troca a imagem (simula
// apontar para outro lugar) e window.fakeCamera.show(null) mostra uma parede vazia.
export function installFakeCamera(src) {
  const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const md = navigator.mediaDevices ?? (navigator.mediaDevices = {});
  md.getUserMedia = async () => {
    let img = new Image();
    img.src = src;
    await img.decode();
    let offset = { x: 0, y: 0 };
    window.fakeCamera = {
      // Desliza a imagem até (x, y) pixels em `ms` milissegundos (simula mover o celular).
      pan(x, y, ms = 1500) {
        const from = { ...offset };
        const t0 = performance.now();
        return new Promise((resolve) => {
          const step = setInterval(() => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            offset = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
            if (k === 1) { clearInterval(step); resolve(); }
          }, 16);
        });
      },
      async show(next) {
        if (!next) { img = null; return; }
        const n = new Image();
        n.src = next;
        await n.decode();
        img = n;
      },
    };
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!img) return;
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * (1 + 0.02 * Math.sin(t));
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.save();
      ctx.translate(canvas.width / 2 + 6 * Math.sin(t * 0.7) + offset.x, canvas.height / 2 + offset.y);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    };
    draw();
    // setInterval (e não requestAnimationFrame) para continuar desenhando com a aba em segundo plano.
    setInterval(draw, 33);
    return canvas.captureStream(30);
  };
  return original;
}
