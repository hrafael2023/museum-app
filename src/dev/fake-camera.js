// Câmera simulada para testar no computador: abra o app com
// ?camerateste=assets/test/folha-cartazes.jpg e a "câmera" passa a mostrar essa
// imagem (com um leve movimento), em vez da câmera de verdade.
export function installFakeCamera(src) {
  const original = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  const md = navigator.mediaDevices ?? (navigator.mediaDevices = {});
  md.getUserMedia = async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    const start = performance.now();
    const draw = () => {
      const t = (performance.now() - start) / 1000;
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * (1 + 0.02 * Math.sin(t));
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.save();
      ctx.translate(canvas.width / 2 + 6 * Math.sin(t * 0.7), canvas.height / 2);
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
