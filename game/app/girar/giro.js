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
    // (Juan 18/11, iPhone) toda la pantalla: el iframe va del tamaño GRANDE de la pantalla (100lvh/100lvw: también detrás de
    // la barra de Safari y de la isla; antes visualViewport dejaba franjas negras arriba y abajo) y al juego de adentro se le
    // pasan las zonas seguras ya giradas (--sa-t/r/b/l), para que los botones no queden debajo de la isla ni de las barras.
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;left:0;top:0;width:100vw;width:100lvw;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;box-sizing:content-box;padding:0;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(sonda);
    let INS = { t: 0, r: 0, b: 0, l: 0 };
    function pasarZonas() {
      try {
        const d = el.contentDocument, w = el.contentWindow; if (!d || !d.documentElement) return;
        const st = d.documentElement.style; for (const k of ['t', 'r', 'b', 'l']) st.setProperty('--sa-' + k, INS[k].toFixed(1) + 'px');
        w.dispatchEvent(new w.Event('asedio-insets'));
      } catch (e) {}
    }
    el.addEventListener('load', pasarZonas);
    function ajustar() {
      const vv = window.visualViewport, c = getComputedStyle(sonda), px = (v) => parseFloat(v) || 0;
      const vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
      const W = Math.round(Math.max(vw, innerWidth, px(c.width))), H = Math.round(Math.max(vh, innerHeight, px(c.height)));
      // zonas en la pantalla: las del navegador + lo que tapan sus barras (lo que queda fuera de lo visible)
      const oy = vv ? vv.offsetTop : 0, sc = { t: Math.max(px(c.paddingTop), oy), r: px(c.paddingRight), b: Math.max(px(c.paddingBottom), H - oy - vh), l: px(c.paddingLeft) };
      const girar = activo() && H > W;
      let w = girar ? H : W, h = girar ? W : H, k = 1;
      if (op.minAncho && w > h && w < op.minAncho) { k = w / op.minAncho; w = op.minAncho; h = Math.round(h / k); }
      // girado 90°: arriba de adentro = derecha de la pantalla, derecha = abajo, abajo = izquierda, izquierda = arriba
      const g = girar ? { t: sc.r, r: sc.b, b: sc.l, l: sc.t } : sc;
      INS = { t: Math.max(0, g.t) / k, r: Math.max(0, g.r) / k, b: Math.max(0, g.b) / k, l: Math.max(0, g.l) / k };
      document.documentElement.classList.toggle('girado', girar);
      const t = (k !== 1 ? `scale(${k}) ` : '') + (girar ? 'rotate(90deg) translateY(-100%)' : '');
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', width: w + 'px', height: h + 'px', transformOrigin: '0 0', transform: t || 'none' });
      pasarZonas();
      if (op.alCambiar) op.alCambiar(girar, k);
    }
    addEventListener('resize', ajustar); addEventListener('orientationchange', () => setTimeout(ajustar, 250));
    window.visualViewport?.addEventListener('resize', ajustar);
    ajustar();
    return { ajustar };
  }
  window.Giro = { montar };
})();
