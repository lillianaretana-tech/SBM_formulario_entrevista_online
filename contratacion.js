/* Contratación (RH-F-07) y checklist de requisitos para enviar el expediente a RH.
 *
 * - Reúne en un solo lugar los datos del RH-F-07: lo que ya se capturó en la entrevista se toma de la base
 *   y sólo se piden los datos que faltan (sexo, salario, fecha de ingreso, etc.).
 * - Checklist de la "Documentación que se debe de enviar" del RH-F-07, con sugerencias automáticas según
 *   lo que ya consta en el expediente. Se guarda en el expediente (response_data.checklist_contratacion).
 * - Genera el Excel RH-F-07 con la plantilla original (rhf07-excel.js).
 *
 * Usa las funciones y variables globales de admin.html (selected, records, config, usableSession, message,
 * esc, labels, reportStructure, responseValue, fillFilters, render, openDetail, openEdit, dashboardStatus).
 */
(function () {
  'use strict';

  const L = () => (window.RHF07 && window.RHF07.LISTAS) || {};

  /* ---- datos que pide el RH-F-07 y no estaban en la entrevista.
   g:'p' = los pregunta el formulario de entrevista (index.html); g:'c' = los llena RH en "Completar administrativo" ---- */
  const CAMPOS = [
    { g: 'p', k: 'sexo', t: 'Sexo', type: 'select', list: () => L().sexo },
    { g: 'p', k: 'fecha_nacimiento', t: 'Fecha de nacimiento', type: 'date' },
    { g: 'p', k: 'nacionalidad', t: 'Nacionalidad', type: 'text', suggest: true },
    { g: 'p', k: 'provincia', t: 'Provincia donde vive', type: 'select', list: () => L().provincia },
    { g: 'c', k: 'plaza_tipo', t: 'Plaza (nueva o sustitución)', type: 'select', list: () => L().plaza },
    { g: 'c', k: 'plaza_vacante_desde', t: 'Si es sustitución: vacante desde', type: 'date' },
    { g: 'c', k: 'jornada_contrato', t: 'Jornada', type: 'select', list: () => L().jornada },
    { g: 'c', k: 'horario_contrato', t: 'Horario', type: 'select', list: () => L().horario },
    { g: 'c', k: 'salario', t: 'Salario de contratación', type: 'number' },
    { g: 'c', k: 'fecha_ingreso', t: 'Fecha de ingreso', type: 'date' },
    { g: 'c', k: 'hora_ingreso', t: 'Hora de ingreso del primer día', type: 'time' },
    { g: 'c', k: 'curso_fecha', t: 'Fecha de aprobación del curso RH-F-55 (nuevo ingreso)', type: 'date' },
    { g: 'c', k: 'curso_puntos', t: 'Puntos obtenidos en el curso (mínimo 12)', type: 'number' }
  ];

  /* ---- datos que ya vienen de la entrevista (sólo lectura aquí; se corrigen en "Editar expediente") ---- */
  const DE_ENTREVISTA = [
    ['nombre', 'Nombre y apellidos', true], ['cedula', 'Cédula', true],
    ['seguro_social_extranjero', '# de carné CCSS (si es extranjero)', false], ['estado_civil', 'Estado civil', true],
    ['telefono', 'Teléfono', true], ['correo', 'Correo electrónico', true], ['direccion', 'Dirección detallada', true],
    ['emergencia_nombre', 'Contacto de emergencia', true], ['emergencia_telefono', 'Teléfono de emergencia', true],
    ['proyecto_asignado', 'Proyecto', true], ['posicion', 'Puesto', true]
  ];

  const si = v => /^s[ií]$/i.test(String(v ?? '').trim());
  const val = (d, k) => String(d?.[k] ?? '').replace(/\s+/g, ' ').trim();

  /* ---- documentación que se debe enviar (hoja RH-F-07, filas 33 a 40) ---- */
  const ITEMS = [
    { k: 'foto', t: 'Fotografía en formato JPG (busto, fondo liso)' },
    { k: 'cedula', t: 'Fotocopia de la cédula y/o DIMEX al día (DIMEX vencido: copia de la cita de renovación)',
      auto: d => si(d.cedula_vigente), why: 'Entrevista: cédula vigente' },
    { k: 'delincuencia', t: 'Copia de la hoja de delincuencia, máximo un mes de emitida al día de la entrevista',
      auto: d => si(d.hoja_delincuencia), why: 'Entrevista: hoja de delincuencia' },
    { k: 'curriculum', t: 'Currículum completo (2 cartas de recomendación y/o 2 referencias anotadas)',
      auto: d => si(d.curriculum_actualizado) && (si(d.cartas_recomendacion) || (val(d, 'referencia_1_empresa') && val(d, 'referencia_2_empresa'))),
      why: 'Entrevista: currículum y cartas/referencias' },
    { k: 'rhf07', t: 'PDF del RH-F-07 Inclusión provisional al INS', hint: d => faltantes(d).length ? `Datos incompletos: faltan ${faltantes(d).length}` : 'Datos completos: ya se puede generar' },
    { k: 'rhf08', t: 'PDF del RH-F-08 Estado de Salud, debidamente cumplimentado', hint: () => 'Se imprime desde "RH-F-08 Salud"' },
    { k: 'rhf55', t: 'PDF del RH-F-55 Evaluación Nuevo ingreso SBM-CR (12 puntos: aprobado)',
      auto: d => !!val(d, 'curso_fecha') && Number(val(d, 'curso_puntos')) >= 12, why: 'Curso aprobado con 12 puntos o más' },
    { k: 'rhf56', t: 'RH-F-56 Aprobación de Ingreso de Recursos Humanos (adjuntar correo)' }
  ];

  /* datos requeridos por el RH-F-07 que todavía no constan */
  function faltantes(d) {
    const out = [];
    DE_ENTREVISTA.forEach(([k, t, req]) => { if (req && !val(d, k) && !(k === 'emergencia_nombre' && val(d, 'contacto_emergencia'))) out.push(t); });
    CAMPOS.forEach(c => {
      if (c.k === 'plaza_vacante_desde') { if (val(d, 'plaza_tipo') === 'Sustitución' && !val(d, c.k)) out.push(c.t); return; }
      if (!val(d, c.k)) out.push(c.t);
    });
    return out;
  }

  /* estado efectivo de cada requisito: lo guardado, o la sugerencia automática */
  function estados(d) {
    const guardado = d?.checklist_contratacion || {};
    return ITEMS.map(it => {
      const auto = it.auto ? !!it.auto(d || {}) : false;
      const manual = typeof guardado[it.k] === 'boolean';
      return { ...it, auto, manual, ok: manual ? guardado[it.k] : auto };
    });
  }
  function resumen(r) {
    const e = estados(r?.response_data || {});
    return { tengo: e.filter(x => x.ok).length, total: e.length, falta: e.filter(x => !x.ok).map(x => x.t) };
  }

  /* ---------------------------------- interfaz ---------------------------------- */
  let dlg, tocados = new Set(), huboCambios = false;   // tocados: requisitos que la usuaria marcó o desmarcó a mano

  function css() {
    if (document.getElementById('hireCss')) return;
    const st = document.createElement('style');
    st.id = 'hireCss';
    st.textContent = `
      #hireDialog .hire-sum{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--line,#d6dde6);border-radius:12px;background:#f7f9fb}
      #hireDialog .hire-bar{flex:1;min-width:140px;height:10px;border-radius:99px;background:#e3e8ee;overflow:hidden}
      #hireDialog .hire-bar>i{display:block;height:100%;background:var(--ok,#1f8a4c);width:0;transition:width .2s}
      #hireDialog .hire-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
      #hireDialog .hire-item{display:flex;gap:12px;align-items:flex-start;padding:11px 12px;border:1px solid var(--line,#d6dde6);border-radius:10px}
      #hireDialog .hire-item.ok{background:#f1faf4;border-color:#bfe3cc}
      #hireDialog .hire-item.no{background:#fff8f3;border-color:#f0d3bd}
      #hireDialog .hire-item input{width:22px;height:22px;margin-top:1px;flex:none}
      #hireDialog .hire-item label{margin:0;font-weight:600;cursor:pointer;display:block}
      #hireDialog .hire-item small{display:block;color:var(--muted,#667085);font-weight:400;margin-top:3px}
      #hireDialog .chip{display:inline-block;font-size:12px;padding:2px 8px;border-radius:99px;background:#e8edf3;color:#37455a;margin-left:6px;font-weight:600}
      #hireDialog .chip.warn{background:#fde8d9;color:#9a4a14}
      #hireDialog .hire-read{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
      #hireDialog .hire-read div{padding:6px 0;border-bottom:1px solid #eef1f5;overflow-wrap:anywhere}
      #hireDialog .hire-read b{display:block;font-size:12px;color:var(--muted,#667085);font-weight:600}
      #hireDialog h3.hire-h{margin:20px 0 10px;color:var(--navy,#111);border-bottom:2px solid var(--gold,#f76120);padding-bottom:5px}
      @media(max-width:640px){#hireDialog .hire-read{grid-template-columns:1fr}}`;
    document.head.appendChild(st);
  }

  function build() {
    if (dlg) return;
    css();
    dlg = document.createElement('dialog');
    dlg.id = 'hireDialog';
    dlg.innerHTML = `<div class="modal-head"><div><h2>Contratación · RH-F-07 y requisitos</h2><p id="hireCandidate"></p></div><button class="ghost" type="button" id="hireClose">Cerrar</button></div>
      <form id="hireForm" class="modal-body" novalidate>
        <div class="hire-sum"><strong id="hireCount"></strong><div class="hire-bar"><i id="hireBar"></i></div><span id="hireData"></span></div>
        <h3 class="hire-h">Documentación que se debe enviar a RH</h3>
        <ul class="hire-list" id="hireItems"></ul>
        <h3 class="hire-h">Datos del candidato (formulario de entrevista)</h3>
        <div class="hire-read" id="hireRead"></div>
        <h3 class="hire-h">Datos de contratación (control administrativo)</h3>
        <div class="hire-read" id="hireFields"></div>
        <p class="hire-links"><button class="secondary" type="button" id="hireAdmin">Completar administrativo</button> <button class="ghost" type="button" id="hireFix">Corregir datos de la entrevista</button></p>
      </form>
      <div class="modal-body edit-foot"><div class="status" id="hireStatus" role="status"></div>
        <div class="modal-actions"><button class="primary" type="button" id="hireExcel">Generar Excel RH-F-07</button><button class="secondary" type="button" id="hireSave">Guardar checklist</button><button class="ghost" type="button" id="hireCancel">Cancelar</button></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('#hireClose').onclick = dlg.querySelector('#hireCancel').onclick = () => dlg.close();
    dlg.querySelector('#hireSave').onclick = () => guardar(false);
    dlg.querySelector('#hireExcel').onclick = () => guardar(true);
    dlg.querySelector('#hireFix').onclick = () => { dlg.close(); if (typeof openEdit === 'function') openEdit(); };
    dlg.querySelector('#hireAdmin').onclick = () => { dlg.close(); if (typeof openAdminForm === 'function') openAdminForm(); };
    // 'input' se dispara antes que 'change': se marca como tocado aquí para que refrescar() no revierta la casilla
    dlg.querySelector('#hireForm').addEventListener('input', e => { if (e.target.dataset?.item) tocados.add(e.target.dataset.item); refrescar(); });
    dlg.querySelector('#hireForm').addEventListener('change', e => { if (e.target.dataset?.item) tocados.add(e.target.dataset.item); refrescar(); });
    dlg.addEventListener('close', () => {            // al cerrar, el expediente abierto detrás muestra los datos nuevos
      if (!huboCambios) return;
      huboCambios = false;
      if (typeof dialog !== 'undefined' && selected) { if (dialog.open) dialog.close(); openDetail(selected.id); }
    });
    dlg.querySelector('#hireForm').addEventListener('submit', e => e.preventDefault());
  }

  function mostrar(c, v) {
    if (!v) return '';
    if (c.type === 'date') return v.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');
    if (c.type === 'number' && c.k === 'salario' && isFinite(Number(v))) return '₡' + Number(v).toLocaleString('es-CR');
    return v;
  }

  // datos del expediente con lo que hay en pantalla (sin guardar todavía)
  function datosActuales() {
    const d = { ...(selected.response_data || {}) };
    if (!dlg) return d;
    // sólo se guardan los requisitos marcados a mano; el resto sigue la sugerencia automática de los datos
    const cl = { ...(d.checklist_contratacion || {}) };
    dlg.querySelectorAll('[data-item]').forEach(el => { if (tocados.has(el.dataset.item)) cl[el.dataset.item] = el.checked; });
    d.checklist_contratacion = cl;
    return d;
  }

  function refrescar() {
    if (!dlg || !selected) return;
    const d = datosActuales(), est = estados(d);
    const f = faltantes(d);
    dlg.querySelector('#hireData').textContent = f.length ? `Datos del RH-F-07: faltan ${f.length}` : 'Datos del RH-F-07 completos';
    // la lista se construye una sola vez (abrir); aquí sólo se actualizan estado y notas para no perder el foco
    est.forEach(it => {
      const li = dlg.querySelector(`#hireItems [data-li="${it.k}"]`), chk = li.querySelector('input');
      if (!tocados.has(it.k)) chk.checked = it.ok;           // lo no marcado a mano sigue la sugerencia automática
      li.className = `hire-item ${chk.checked ? 'ok' : 'no'}`;
      const nota = it.hint ? it.hint(d) : (it.auto && !it.manual ? `Sugerido: ${it.why}` : (it.auto ? it.why : ''));
      const aviso = it.k === 'rhf55' && val(d, 'curso_puntos') && Number(val(d, 'curso_puntos')) < 12 ? '<span class="chip warn">No aprobado (mínimo 12)</span>' : '';
      li.querySelector('.hire-extra').innerHTML = `${chk.checked ? '' : '<span class="chip warn">Falta</span>'}${aviso}${nota ? `<small>${esc(nota)}</small>` : ''}`;
    });
    const n = dlg.querySelectorAll('#hireItems input:checked').length;
    dlg.querySelector('#hireCount').textContent = `Requisitos: ${n} de ${est.length}`;
    dlg.querySelector('#hireBar').style.width = `${Math.round(n / est.length * 100)}%`;
  }

  function abrir() {
    if (!selected) return;
    build();
    const d = selected.response_data || {};
    dlg.querySelector('#hireCandidate').textContent = selected.candidate_name;
    const chip = req => req ? '<span class="chip warn">Falta</span>' : '<span class="chip">No aplica</span>';
    const fila = (t, v, req) => `<div><b>${esc(t)}</b>${v ? esc(v) : chip(req)}</div>`;
    dlg.querySelector('#hireRead').innerHTML = DE_ENTREVISTA.map(([k, t, req]) => {
      const v = k === 'nombre' ? selected.candidate_name : (val(d, k) || (k === 'emergencia_nombre' ? val(d, 'contacto_emergencia') : ''));
      return fila(t, v, req);
    }).join('') + CAMPOS.filter(c => c.g === 'p').map(c => fila(c.t, mostrar(c, val(d, c.k)), true)).join('');
    dlg.querySelector('#hireFields').innerHTML = CAMPOS.filter(c => c.g === 'c').map(c =>
      fila(c.t, mostrar(c, val(d, c.k)), c.k !== 'plaza_vacante_desde' || val(d, 'plaza_tipo') === 'Sustitución')).join('');
    message(dlg.querySelector('#hireStatus'), '');
    tocados = new Set();
    dlg.querySelector('#hireItems').innerHTML = ITEMS.map(it => `<li data-li="${it.k}" class="hire-item"><input type="checkbox" id="chk_${it.k}" data-item="${it.k}">
      <label for="chk_${it.k}">${esc(it.t)}<span class="hire-extra"></span></label></li>`).join('');
    estados(d).forEach(x => { dlg.querySelector(`#chk_${x.k}`).checked = x.ok; });   // estado guardado (o sugerido)
    refrescar();
    dlg.showModal();
  }

  async function guardar(generar) {
    const status = dlg.querySelector('#hireStatus'), botones = dlg.querySelectorAll('.edit-foot button');
    const session = await usableSession();
    if (!session) { dlg.close(); showLogin(); return; }
    const antes = selected.response_data || {}, ahora = datosActuales(), updates = {}, changes = [];
    CAMPOS.forEach(c => {
      const a = val(antes, c.k), b = val(ahora, c.k);
      if (a !== b) { updates[c.k] = b; changes.push({ campo: c.t, clave: c.k, antes: a, despues: b }); }
    });
    const efAntes = Object.fromEntries(estados(antes).map(x => [x.k, x.ok])), efAhora = Object.fromEntries(estados(ahora).map(x => [x.k, x.ok]));
    ITEMS.forEach(it => {
      if (efAntes[it.k] !== efAhora[it.k]) {
        changes.push({ campo: `Requisito: ${it.t}`, clave: `checklist_contratacion.${it.k}`, antes: efAntes[it.k] ? 'Tengo' : 'Falta', despues: efAhora[it.k] ? 'Tengo' : 'Falta' });
      }
    });
    const cambioLista = JSON.stringify(antes.checklist_contratacion || null) !== JSON.stringify(ahora.checklist_contratacion);
    let guardado = true;
    if (changes.length || cambioLista) {
      updates.checklist_contratacion = ahora.checklist_contratacion;
      const historial = [...(Array.isArray(antes.historial_ediciones) ? antes.historial_ediciones : []), { fecha: new Date().toISOString(), por: typeof sessionEmail === 'function' ? sessionEmail(session) : '', cambios: changes }];
      const body = { response_data: { ...antes, ...updates, historial_ediciones: historial } };
      botones.forEach(b => b.disabled = true);
      message(status, 'Guardando…');
      try {
        const res = await fetch(`${config.url}/rest/v1/sbm_interview_responses?id=eq.${encodeURIComponent(selected.id)}&project_key=eq.${encodeURIComponent(config.project)}`, {
          method: 'PATCH', headers: { apikey: config.key, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
        const upd = await res.json().catch(() => []);
        if (!res.ok) throw new Error(upd.message || `Error ${res.status}`);
        if (!upd.length) throw new Error('El expediente no pudo actualizarse (permisos).');
        const pos = records.findIndex(r => r.id === selected.id);
        if (pos >= 0) records[pos] = upd[0];
        selected = upd[0];
        huboCambios = true;
        fillFilters(); render();
      } catch (error) {
        guardado = false;
        message(status, `No se pudo guardar: ${error.message}`, 'error');
      } finally { botones.forEach(b => b.disabled = false); }
    }
    if (!guardado) return;
    if (!generar) { message(status, 'Cambios guardados en el expediente.', 'ok'); refrescar(); return; }
    try {
      message(status, 'Generando Excel…');
      const datos = { ...selected.response_data, nombre: selected.response_data?.nombre || selected.candidate_name };
      const { blob, filename } = await RHF07.generarRHF07(datos);
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      const f = faltantes(selected.response_data);
      message(status, f.length ? `Excel generado. Ojo, faltan datos: ${f.slice(0, 4).join(', ')}${f.length > 4 ? '…' : ''}.` : 'Excel generado con todos los datos.', f.length ? '' : 'ok');
    } catch (error) {
      message(status, `No se pudo generar el Excel: ${error.message}`, 'error');
    }
  }

  /* se llama una vez desde admin.html cuando ya existen labels y reportStructure */
  function init() {
    Object.assign(labels, Object.fromEntries(CAMPOS.map(c => [c.k, c.t])));
    const personales = CAMPOS.filter(c => c.g === 'p').map(c => c.k), contrato = CAMPOS.filter(c => c.g === 'c').map(c => c.k);
    const s1 = reportStructure[0];
    personales.forEach(k => { if (!s1.keys.includes(k)) s1.keys.splice(s1.keys.indexOf('estado_civil') + 1, 0, k); });
    if (!reportStructure.some(x => x.title.startsWith('7.'))) reportStructure.push({ title: '7. Contratación (RH-F-07)', keys: contrato });
  }

  window.Hire = { init, abrir, resumen, CAMPOS, faltantes, estados };
})();
