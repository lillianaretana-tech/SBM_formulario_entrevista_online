/* Genera el Excel RH-F-07 (Inclusión provisional al INS) a partir de la plantilla original.
 *
 * No se reconstruye el libro: se abre la plantilla (rhf07-template.js) y se escribe SOLO el contenido de las
 * celdas de la hoja DATOS (fila 4) y el nombre en la hoja RH-F-07 (C6). El resto — formato, combinaciones,
 * listas desplegables, protección de la hoja, logo, comentarios y fórmulas BUSCARV — queda tal cual.
 * También se guardan los valores calculados de las fórmulas para que se vean aunque el archivo se abra en
 * una vista previa (correo, celular) y se pide a Excel recalcular al abrir.
 *
 * Requiere JSZip (jszip.min.js) y window.RHF07_TEMPLATE_B64.
 */
(function () {
  'use strict';

  const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Opciones de las listas desplegables de la plantilla (hoja DATOS)
  const LISTAS = {
    sexo: ['Femenino', 'Masculino'],
    estadoCivil: ['Soltero(a)', 'Casado(a)', 'Unión Libre', 'Divorciado(a)'],
    provincia: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'],
    plaza: ['Nueva', 'Sustitución'],
    jornada: ['Completa', 'Parcial'],
    horario: ['Día', 'Tarde-Noche', 'Noche']
  };

  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function matchList(value, list) {
    const n = norm(value);
    if (!n) return '';
    const hit = list.find(x => norm(x) === n);
    return hit || '';
  }
  function estadoCivil(value) {
    const n = norm(value);
    if (!n) return '';
    if (n.startsWith('solter')) return 'Soltero(a)';
    if (n.startsWith('casad')) return 'Casado(a)';
    if (n.startsWith('union')) return 'Unión Libre';
    if (n.startsWith('divorc')) return 'Divorciado(a)';
    return String(value).trim();   // p. ej. "Viudo(a)": la plantilla no lo ofrece, pero se conserva
  }

  // yyyy-mm-dd -> número de serie de Excel; HH:MM -> fracción de día
  function dateSerial(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) + 25569 : null;
  }
  function timeFraction(v) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
    return m ? (+m[1] * 60 + +m[2]) / 1440 : null;
  }
  function toNumber(v) {
    const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));
    return String(v ?? '').trim() !== '' && isFinite(n) ? n : null;
  }

  /* Valores de la fila de DATOS (columnas B..Y). Cada valor es {t:'s'|'n', v} */
  function filaDatos(d) {
    const s = k => String(d?.[k] ?? '').replace(/\s+/g, ' ').trim();
    const txt = v => ({ t: 's', v: v || ' ' });
    const lst = v => ({ t: 's', v: v || '-' });
    const num = (n, fallback = ' ') => n === null ? { t: 's', v: fallback } : { t: 'n', v: n };
    return {
      B: txt(s('nombre')),
      C: txt(s('cedula')),
      D: txt(s('seguro_social_extranjero')),
      E: lst(matchList(s('sexo'), LISTAS.sexo)),
      F: num(dateSerial(s('fecha_nacimiento'))),
      G: txt(s('nacionalidad')),
      H: lst(estadoCivil(s('estado_civil'))),
      I: lst(matchList(s('provincia'), LISTAS.provincia)),
      J: txt(s('telefono')),
      K: txt(s('correo')),
      L: txt(s('direccion')),
      M: txt(s('emergencia_nombre') || s('contacto_emergencia')),
      N: txt(s('emergencia_telefono')),
      O: txt(s('proyecto_asignado')),
      P: txt(s('posicion')),
      Q: lst(matchList(s('plaza_tipo'), LISTAS.plaza)),
      R: num(dateSerial(s('plaza_vacante_desde'))),
      S: lst(matchList(s('jornada_contrato'), LISTAS.jornada)),
      T: lst(matchList(s('horario_contrato'), LISTAS.horario)),
      U: num(toNumber(s('salario'))),
      V: num(dateSerial(s('fecha_ingreso'))),
      W: num(timeFraction(s('hora_ingreso'))),
      X: num(dateSerial(s('curso_fecha'))),
      Y: num(toNumber(s('curso_puntos')))
    };
  }

  // celda de la hoja RH-F-07 -> columna de DATOS de la que toma el valor (BUSCARV)
  const FORMULAS = { C7: 'C', C8: 'D', C9: 'E', C10: 'F', C11: 'G', C12: 'H', C13: 'I', C14: 'J', C15: 'K', C16: 'L', C17: 'M', C18: 'N',
    C20: 'O', C21: 'P', E23: 'S', F23: 'T', C24: 'Q', D24: 'R', E26: 'U', C27: 'V', C28: 'W', C31: 'X', F31: 'Y' };

  // (se usan funciones como reemplazo para que un "$" dentro de un dato no se interprete como patrón)
  function celdaDatos(ref, cell, estilo) {
    return cell.t === 'n'
      ? `<c r="${ref}"${estilo || ''}><v>${cell.v}</v></c>`
      : `<c r="${ref}"${estilo || ''} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(cell.v)}</t></is></c>`;
  }

  function editarDatos(xml, fila) {
    for (const col of Object.keys(fila)) {
      const ref = col + '4';
      const re = new RegExp(`<c r="${ref}"( s="\\d+")? t="s"><v>\\d+</v></c>`);
      if (!re.test(xml)) throw new Error('La plantilla RH-F-07 cambió: no se encontró la celda DATOS!' + ref);
      xml = xml.replace(re, (m, estilo) => celdaDatos(ref, fila[col], estilo));
    }
    // En la plantilla, K4 es un enlace de ejemplo (ksanchez@hotmail.com): se quita para no apuntar a un correo ajeno.
    xml = xml.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, '');
    return xml;
  }

  function editarFormulario(xml, fila) {
    const nombre = fila.B.v;
    const c6 = /<c r="C6"( s="\d+")? t="s"><v>\d+<\/v><\/c>/;
    if (!c6.test(xml)) throw new Error('La plantilla RH-F-07 cambió: no se encontró la celda C6');
    xml = xml.replace(c6, (m, estilo) => `<c r="C6"${estilo || ''} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(nombre)}</t></is></c>`);
    for (const [ref, col] of Object.entries(FORMULAS)) {
      const re = new RegExp(`<c r="${ref}"( s="\\d+")?( t="str")?>(<f>[^<]*</f>)<v[^>]*>[^<]*</v></c>`);
      if (!re.test(xml)) throw new Error('La plantilla RH-F-07 cambió: no se encontró la fórmula en ' + ref);
      const val = fila[col];
      xml = xml.replace(re, (m, estilo, tipo, f) => val.t === 'n'
        ? `<c r="${ref}"${estilo || ''}>${f}<v>${val.v}</v></c>`
        : `<c r="${ref}"${estilo || ''} t="str">${f}<v xml:space="preserve">${xmlEsc(val.v)}</v></c>`);
    }
    return xml;
  }

  async function generarRHF07(datos) {
    if (typeof JSZip === 'undefined') throw new Error('No se cargó la librería JSZip.');
    if (!window.RHF07_TEMPLATE_B64) throw new Error('No se cargó la plantilla RH-F-07.');
    const fila = filaDatos(datos);
    if (fila.B.v.trim() === '') throw new Error('El expediente no tiene nombre.');
    const zip = await JSZip.loadAsync(window.RHF07_TEMPLATE_B64, { base64: true });

    zip.file('xl/worksheets/sheet1.xml', editarDatos(await zip.file('xl/worksheets/sheet1.xml').async('string'), fila));
    zip.file('xl/worksheets/sheet2.xml', editarFormulario(await zip.file('xl/worksheets/sheet2.xml').async('string'), fila));
    // los enlaces de ejemplo ya no existen: se vacía la lista de relaciones de la hoja DATOS
    zip.file('xl/worksheets/_rels/sheet1.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    // pedir a Excel que recalcule al abrir
    const wbXml = await zip.file('xl/workbook.xml').async('string');
    zip.file('xl/workbook.xml', wbXml.replace(/<calcPr calcId="(\d+)"\/>/, '<calcPr calcId="$1" fullCalcOnLoad="1"/>'));

    const blob = await zip.generateAsync({
      type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const limpio = String(datos.nombre || 'Candidato').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return { blob, filename: `RH-F-07 - ${limpio}.xlsx` };
  }

  window.RHF07 = { LISTAS, generarRHF07, filaDatos, matchList, estadoCivil };
})();
