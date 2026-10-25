// Giro del juego/lab para el celular parado (Juan 23-24/10). Código compartido: lo usan girar.html (el juego) y la portada del
// lab (tools/anim/build_lab_web.mjs). Gira 90° un iframe con el contenido: adentro el juego se ve acostado (ancho = alto de la
// pantalla) y el navegador traduce solo los toques, arrastres y posiciones. Si el celu sí está acostado, no gira nada.
// Uso: <script src="girar/giro.js"></script> … Giro.montar(iframe, { activo: () => true })
(function () {
  function montar(el, op) {
    op = op || {};
    const activo = op.activo || (() => true);
    // op.minAncho: si el contenido queda apaisado y más angosto que esto (celus chicos, 667×375), se dibuja a ese ancho y se
    // achica entero con scale (así adentro sigue valiendo el diseño apaisado y no el de celular parado)
    function ajustar() {
      const vv = window.visualViewport, W = Math.round(vv ? vv.width : innerWidth), H = Math.round(vv ? vv.height : innerHeight);
      const girar = activo() && H > W;
      let w = girar ? H : W, h = girar ? W : H, k = 1;
      if (op.minAncho && w > h && w < op.minAncho) { k = w / op.minAncho; w = op.minAncho; h = Math.round(h / k); }
      document.documentElement.classList.toggle('girado', girar);
      const t = (k !== 1 ? `scale(${k}) ` : '') + (girar ? 'rotate(90deg) translateY(-100%)' : '');
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: w + 'px', height: h + 'px', transformOrigin: '0 0', transform: t || 'none' });
      if (op.alCambiar) op.alCambiar(girar, k);
    }
    addEventListener('resize', ajustar); addEventListener('orientationchange', () => setTimeout(ajustar, 250));
    window.visualViewport?.addEventListener('resize', ajustar);
    ajustar();
    return { ajustar };
  }
  window.Giro = { montar };
})();
