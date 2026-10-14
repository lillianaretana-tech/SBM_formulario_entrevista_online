/* Impresión de formularios de calidad (ISO 9001): RH-F-08 Estado de Salud y RH-F-11 Guía de entrevista.
 *
 * El formulario se imprime idéntico al documento original: tamaño carta, mismas posiciones, mismos
 * saltos de página (RH-F-08 = 1 hoja, RH-F-11 = 2 hojas). Sólo se superponen los datos del
 * candidato sobre las líneas en blanco y se marca una X en las casillas correspondientes.
 *
 * El texto fijo, las líneas y los logos viven en print-templates.js (generado a partir de los .doc
 * originales). Si cambia la versión de un formulario, hay que regenerar esa plantilla.
 *
 * Coordenadas: puntos (pt) sobre una página carta de 612 x 792 pt, origen arriba a la izquierda.
 */
(function () {
  'use strict';

  const INK = '#000';               // color de los datos escritos
  const FONT = "Arial,'Liberation Sans',Helvetica,sans-serif";

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = n => (Math.round(n * 100) / 100).toString();

  /* --- medición de texto (para ajustar valores largos a la línea disponible) --- */
  let ctx;
  function measure(text, size, bold) {
    try {
      ctx = ctx || document.createElement('canvas').getContext('2d');
      ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
      return ctx.measureText(text).width;
    } catch (e) { return text.length * size * 0.5; }
  }

  /* --- datos --- */
  function formatDate(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || '');
  }

  function makeAccessor(data) {
    const get = key => {
      let v = data?.[key];
      if ((v === undefined || v === null || v === '') && key === 'medicamento_nombre') v = data?.detalle_medicamento;
      if ((v === undefined || v === null || v === '') && key === 'emergencia_nombre') v = data?.contacto_emergencia;
      if (Array.isArray(v)) v = v.join(', ');
      return v === undefined || v === null ? '' : String(v).replace(/\s+/g, ' ').trim();
    };
    const yn = key => {
      const v = get(key).toLowerCase();
      if (v === 'sí' || v === 'si') return 'si';
      if (v === 'no') return 'no';
      return '';
    };
    return { get, yn };
  }

  /* --- primitivas SVG para los datos superpuestos --- */
  function text(x, y, value, opt = {}) {
    value = String(value ?? '').trim();
    if (!value) return '';
    let size = opt.size || 9;
    const min = opt.min || 5.5;
    if (opt.maxW) while (size > min && measure(value, size, opt.bold) > opt.maxW) size -= 0.25;
    if (opt.maxW && measure(value, size, opt.bold) > opt.maxW) {       // último recurso: recortar con "…"
      while (value.length > 1 && measure(value + '…', size, opt.bold) > opt.maxW) value = value.slice(0, -1);
      value += '…';
    }
    return `<text x="${num(x)}" y="${num(y)}" fill="${INK}" style="font-family:${FONT};font-size:${num(size)}px;${opt.bold ? 'font-weight:bold' : ''}">${esc(value)}</text>`;
  }

  function wrap(value, maxW, size) {
    const lines = [];
    String(value || '').split(/\r?\n/).forEach(par => {
      let line = '';
      par.split(/\s+/).filter(Boolean).forEach(word => {
        const probe = line ? `${line} ${word}` : word;
        if (measure(probe, size) <= maxW || !line) line = probe; else { lines.push(line); line = word; }
      });
      lines.push(line);
    });
    return lines;
  }

  function paragraph(x, y, value, maxW, opt = {}) {
    value = String(value || '').trim();
    if (!value) return '';
    let size = opt.size || 9;
    const lead = () => opt.leading ? opt.leading * size / (opt.size || 9) : size * 1.15;
    let lines = wrap(value, maxW, size);
    while (opt.maxLines && lines.length > opt.maxLines && size > (opt.min || 6)) { size -= 0.25; lines = wrap(value, maxW, size); }
    if (opt.maxLines && lines.length > opt.maxLines) { lines = lines.slice(0, opt.maxLines); lines[lines.length - 1] += '…'; }
    return lines.map((l, i) => text(x, y + i * lead(), l, { size })).join('');
  }

  // X dentro de una casilla cuya esquina superior izquierda es (x, y) y de lado w
  function mark(x, y, w) {
    const p = Math.max(1.4, w * 0.2);
    return `<path d="M${num(x + p)} ${num(y + p)}L${num(x + w - p)} ${num(y + w - p)}M${num(x + w - p)} ${num(y + p)}L${num(x + p)} ${num(y + w - p)}" stroke="${INK}" stroke-width="1.2" fill="none"/>`;
  }

  // pareja Sí / No: sx, nx = x de cada casilla
  function yesNo(state, y, sx, nx, w) {
    return state === 'si' ? mark(sx, y, w) : state === 'no' ? mark(nx, y, w) : '';
  }

  /* ======================= RH-F-08 · Estado de Salud (1 hoja) ======================= */
  function fillRH08(d) {
    const { get, yn } = makeAccessor(d);
    const p1 = [], p2 = [];

    p1.push(text(50, 77.6, formatDate(get('fecha')), { size: 9, maxW: 142 }));

    // Uniformes
    p1.push(text(217.5, 131.6, get('talla_camiseta'), { size: 8, maxW: 36 }));
    const pant = [get('talla_pantalon_mujer'), get('talla_pantalon_hombre')].filter(Boolean).join(' / ');
    p1.push(text(325, 131.6, pant, { size: 8, maxW: 28, min: 4.5 }));
    p1.push(text(425, 131.6, get('talla_zapatos'), { size: 8, maxW: 100 }));

    // Contacto de emergencia
    p1.push(text(34, 246.4, get('emergencia_nombre'), { size: 9, maxW: 266 }));
    p1.push(text(308, 246.4, get('emergencia_telefono'), { size: 9, maxW: 90 }));
    p1.push(text(406, 246.4, get('emergencia_parentesco'), { size: 9, maxW: 136 }));

    // Cuadrícula de condiciones (Sí / No): [clave, columna, fila]
    const colSi = [160.4, 336.5, 525.1], rowY = [355.6, 385.6, 415.6, 445.6], step = 26.2;
    [
      ['salud_alergia_polvo', 0, 0], ['salud_diabetes', 1, 0], ['salud_presion_alta', 2, 0],
      ['salud_alergia_aire', 0, 1], ['salud_hernia', 1, 1], ['salud_presion_baja', 2, 1],
      ['salud_lesion_cadera', 0, 2], ['salud_lesion_espalda', 1, 2], ['salud_otra', 2, 2],
      ['salud_lesion_muneca', 0, 3], ['salud_asma', 1, 3], ['salud_epilepsia', 2, 3]
    ].forEach(([key, c, r]) => p1.push(yesNo(yn(key), rowY[r], colSi[c], colSi[c] + step, 9)));
    p1.push(text(420.3, 436, get('otra_condicion'), { size: 7, maxW: 88, min: 5 }));

    // Preguntas 1 a 4
    const B = 7.9;
    p1.push(yesNo(yn('operacion'), 475.6, 198.3, 225.2, B));
    p1.push(text(152, 504, get('tipo_operacion'), { maxW: 342 }));
    p1.push(yesNo(yn('limitacion_operacion'), 520.3, 361.7, 388.6, B));
    p1.push(yesNo(yn('accidente'), 542.7, 289.4, 316.2, B));
    p1.push(text(173.5, 571, get('accidente_fecha'), { maxW: 326 }));
    p1.push(text(212.5, 593.4, get('accidente_incapacidad'), { maxW: 286 }));
    p1.push(text(257.5, 615.8, get('accidente_estado'), { maxW: 242 }));
    p1.push(yesNo(yn('accidente_limitacion'), 632.1, 345.7, 372.6, B));
    p1.push(yesNo(yn('accidente_citas'), 654.5, 208.1, 234.9, B));
    p1.push(yesNo(yn('medicamento'), 676.8, 259.9, 286.7, B));
    p1.push(text(68.6, 705.2, get('medicamento_nombre'), { maxW: 121 }));
    p1.push(text(335, 705.2, get('medicamento_uso'), { maxW: 152 }));
    p1.push(yesNo(yn('drogas'), 721.5, 194.8, 221.7, B));
    p1.push(yesNo(yn('alcohol'), 721.5, 327.6, 354.4, B));

    // Declaración (continúa en la página 2, igual que el original)
    p1.push(text(39, 760.2, get('nombre'), { maxW: 246 }));
    p1.push(text(331, 760.2, get('cedula'), { maxW: 121 }));
    p2.push(text(250.5, 79, formatDate(get('fecha')), { maxW: 127 }));

    // Una sola hoja: el cuerpo sube 13.4 pt y la continuación de la declaración baja a la misma página
    // (debe coincidir con SHIFT08 y CONT08 del generador de plantillas).
    return [`<g transform="translate(0 -13.4)">${p1.join('')}<g transform="translate(0 691.55)">${p2.join('')}</g></g>`];
  }

  /* ======================= RH-F-11 · Guía de entrevista (2 hojas) ======================= */
  function fillRH11(d) {
    const { get, yn } = makeAccessor(d);
    const p1 = [], p3 = [];

    p1.push(text(118, 64.6, formatDate(get('fecha')), { size: 9, maxW: 141 }));
    p1.push(text(360, 64.6, get('entrevistador'), { size: 9, maxW: 141 }));
    p1.push(text(152, 83, get('nombre'), { size: 9, maxW: 142 }));
    p1.push(text(330, 83, get('posicion'), { size: 9, maxW: 208 }));

    // Documentos entregados: sólo se marca lo entregado
    const doc = (key, x, y) => yn(key) === 'si' ? mark(x, y, 9) : '';
    p1.push(doc('cedula_vigente', 184.4, 128.1));
    p1.push(doc('hoja_delincuencia', 378.9, 128.1));
    p1.push(doc('curriculum_actualizado', 516.1, 128.1));
    p1.push(doc('cartas_recomendacion', 378.9, 147));

    // Preguntas con Sí / No o espacio para escribir
    p1.push(yesNo(yn('parientes_sbm'), 311.9, 349.2, 379.1, 9));
    p1.push(text(97, 330.2, get('pariente_nombre'), { maxW: 205 }));
    p1.push(text(102, 365.2, get('recomendado_por'), { maxW: 262 }));
    p1.push(yesNo(yn('cuarto_limpio'), 475.4, 160.8, 190.6, 9));
    p1.push(yesNo(yn('trabajo_diversidad'), 545.9, 517.6, 547.5, 9));
    p1.push(text(333, 658, get('acepta_jornada'), { maxW: 74 }));
    p1.push(yesNo(yn('horas_extras'), 662.9, 199.1, 228.9, 9));
    p1.push(yesNo(yn('uso_epp'), 686.4, 269.2, 299.1, 9));
    p1.push(yesNo(yn('acepta_epp'), 686.4, 467.9, 497.7, 9));
    p1.push(yesNo(yn('autoriza_referencias'), 744.9, 313.6, 343.5, 9));

    // Referencias laborales (21): dos recuadros
    [[1, 143, 87, 220.5, 102, 141.2, 159.6, 178, 196.4, 170, 225, 92],
     [2, 418, 363, 495.5, 377, 140.6, 159, 177.5, 195.9, 170, 225, 93]].forEach(([n, xe, xt, xc, xm, ye, yt, yc, ym, we, wt, wc]) => {
      p3.push(text(xe, ye, get(`referencia_${n}_empresa`), { size: 8, maxW: we }));
      p3.push(text(xt, yt, get(`referencia_${n}_telefono`), { size: 8, maxW: wt }));
      p3.push(text(xc, yc, get(`referencia_${n}_contacto`), { size: 8, maxW: wc, min: 5 }));
      p3.push(paragraph(xm, ym, get(`referencia_${n}_comentarios`), 210, { size: 8, leading: 9, maxLines: 3 }));
    });

    // Prueba de escritura (22): texto dentro del recuadro redondeado
    p3.push(paragraph(76, 497, d?.seccion_22_respuesta, 446, { size: 10, leading: 14, maxLines: 13, min: 7 }));

    return [p1.join(''), p3.join('')];   // 2 hojas: el punto 20 queda al pie de la página 1
  }

  const FORMS = {
    'RH-F-08': { title: 'RH-F-08 Estado de Salud', fill: fillRH08 },
    'RH-F-11': { title: 'RH-F-11 Guía de entrevista', fill: fillRH11 }
  };

  /* Devuelve el documento HTML completo (listo para abrir en una ventana nueva e imprimir). */
  function buildQualityDocument(code, data, candidateName) {
    const form = FORMS[code], T = window.QUALITY_TEMPLATES;
    if (!form || !T) throw new Error('Plantilla de impresión no disponible: ' + code);
    const overlays = form.fill(data || {});
    const logo = T.logos[code];
    const sheets = T.pages[code].map((body, i) =>
      `<div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="612pt" height="792pt">${body.replace('{{LOGO}}', logo)}${overlays[i] || ''}</svg></div>`
    ).join('');
    const title = `${form.title} - ${candidateName || 'Candidato'}`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${T.css}
@page{size:letter;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#d9dde3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.tools{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid #ccc;padding:10px 16px;font:14px Arial,sans-serif;display:flex;gap:14px;align-items:center}
.tools button{border:0;border-radius:6px;padding:9px 14px;background:#111;color:#fff;font-weight:bold;cursor:pointer}
.tools span{color:#555}
.sheet{width:612pt;height:792pt;margin:14px auto;background:#fff;position:relative;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.sheet svg{display:block;position:absolute;left:0;top:0}
@media print{
  body{background:#fff}
  .tools{display:none}
  .sheet{margin:0;box-shadow:none;height:791pt;break-after:page;page-break-after:always}
  .sheet:last-child{break-after:auto;page-break-after:auto}
}
</style></head><body><div class="tools"><button onclick="print()">Imprimir o guardar como PDF</button><span>Tamaño carta · escala 100 % · sin márgenes ni encabezados</span></div>${sheets}</body></html>`;
  }

  window.QualityPrint = { buildQualityDocument, FORMS };
})();
