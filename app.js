/* Al Día — tareas y reuniones. Todo se guarda en este dispositivo (localStorage). */
(() => {
  'use strict';

  // ---------- Utilidades de fecha (fechas locales 'AAAA-MM-DD') ----------
  const pad = (n) => String(n).padStart(2, '0');
  const aStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const deStr = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const hoy = () => aStr(new Date());
  const sumarDias = (s, n) => { const d = deStr(s); d.setDate(d.getDate() + n); return aStr(d); };
  const difDias = (a, b) => Math.round((deStr(b) - deStr(a)) / 86400000); // b - a
  const maxFecha = (a, b) => (a > b ? a : b);
  const ahoraHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtLargo = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtMes = new Intl.DateTimeFormat('es-CL', { month: 'short' });
  const fmtFechaLarga = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaBonita = (s) => fmtLargo.format(deStr(s)).replace('.', '');
  const zona = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago';

  function proximoHabil(s) {
    let d = sumarDias(s, 1);
    while ([0, 6].includes(deStr(d).getDay())) d = sumarDias(d, 1);
    return d;
  }
  function esteViernes() {
    const h = hoy(); const dia = deStr(h).getDay();
    const falta = (5 - dia + 7) % 7;
    return sumarDias(h, falta);
  }

  // ---------- Estado y almacenamiento ----------
  const CLAVE = 'al-dia:datos';
  const estadoVacio = () => ({ items: [], prefs: { vista: 'pendientes', prioridad: 0, orden: 'plazo' } });
  let estado = cargar();

  function cargar() {
    try {
      const raw = localStorage.getItem(CLAVE);
      if (!raw) return estadoVacio();
      const e = JSON.parse(raw);
      return { items: Array.isArray(e.items) ? e.items : [], prefs: { ...estadoVacio().prefs, ...(e.prefs || {}) } };
    } catch { return estadoVacio(); }
  }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch { toast('No se pudo guardar en el dispositivo', null); }
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const buscarItem = (id) => estado.items.find((i) => i.id === id);

  // Deshacer: guarda una foto del estado antes de cada cambio.
  let fotoDeshacer = null;
  function cambiar(mensaje, fn) {
    const antes = JSON.stringify(estado.items);
    fn();
    guardar();
    render();
    fotoDeshacer = antes;
    toast(mensaje, () => {
      if (!fotoDeshacer) return;
      estado.items = JSON.parse(fotoDeshacer);
      fotoDeshacer = null;
      guardar(); render();
      toast('Cambio deshecho', null);
    });
  }

  // ---------- Elementos ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const elLista = $('#lista');
  const elBuscar = $('#buscar');
  const elOrden = $('#orden');
  const dlgForm = $('#dlgForm');
  const form = $('#form');
  const dlgAplazar = $('#dlgAplazar');
  const dlgMas = $('#dlgMas');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const PRIO = { 1: 'Principal', 2: 'Secundaria', 3: 'Terciaria' };

  // ---------- Estado de plazo ----------
  function estadoPlazo(t) {
    if (!t.plazo) return { clase: '', txt: 'Sin plazo', orden: 99999 };
    const d = difDias(hoy(), t.plazo);
    const hora = t.plazoHora ? ` ${t.plazoHora}` : '';
    if (d < 0 || (d === 0 && t.plazoHora && t.plazoHora < ahoraHHMM())) {
      const txt = d < 0 ? `Vencida hace ${-d} día${d === -1 ? '' : 's'}` : `Venció hoy${hora}`;
      return { clase: 'vencida', txt, orden: d, grupo: 'vencidas' };
    }
    if (d === 0) return { clase: 'hoy', txt: `Vence hoy${hora}`, orden: 0, grupo: 'hoy' };
    if (d === 1) return { clase: 'pronto', txt: `Mañana${hora}`, orden: 1, grupo: 'manana' };
    if (d <= 7) return { clase: 'pronto', txt: `${fechaBonita(t.plazo)}${hora} · en ${d} días`, orden: d, grupo: 'semana' };
    return { clase: '', txt: `${fechaBonita(t.plazo)}${hora}`, orden: d, grupo: 'despues' };
  }

  // ---------- Render ----------
  function filtrar(items) {
    const q = normal(elBuscar.value.trim());
    if (!q) return items;
    return items.filter((i) => normal(`${i.titulo} ${i.notas} ${i.lugar || ''}`).includes(q));
  }

  function render() {
    const vista = estado.prefs.vista;
    $$('.tab').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
    $$('#chipsPrioridad .chip').forEach((c) => c.classList.toggle('activo', Number(c.dataset.p) === estado.prefs.prioridad));
    elOrden.value = estado.prefs.orden;
    $('#chipsPrioridad').hidden = vista === 'reuniones';
    $('.orden').hidden = vista === 'reuniones';
    elBuscar.placeholder = vista === 'reuniones' ? 'Buscar reuniones' : vista === 'listas' ? 'Buscar en tareas listas' : 'Buscar tareas';

    if (vista === 'pendientes') renderPendientes();
    else if (vista === 'reuniones') renderReuniones();
    else renderListas();
    renderResumen();
  }

  function porPrioridad(items) {
    const p = estado.prefs.prioridad;
    return p ? items.filter((i) => i.prioridad === p) : items;
  }

  function ordenar(items) {
    const o = estado.prefs.orden;
    const plazoKey = (t) => (t.plazo || '9999-12-31') + (t.plazoHora || '99:99');
    const cmp = {
      plazo: (a, b) => plazoKey(a).localeCompare(plazoKey(b)) || a.prioridad - b.prioridad,
      prioridad: (a, b) => a.prioridad - b.prioridad || plazoKey(a).localeCompare(plazoKey(b)),
      creacion: (a, b) => b.creada - a.creada,
      nombre: (a, b) => a.titulo.localeCompare(b.titulo, 'es')
    }[o];
    return [...items].sort(cmp);
  }

  function renderPendientes() {
    const tareas = filtrar(porPrioridad(estado.items.filter((i) => i.tipo === 'tarea' && !i.lista)));
    if (!tareas.length) return vacio(estado.items.some((i) => i.tipo === 'tarea' && !i.lista) ? '🔍' : '🎉',
      estado.items.some((i) => i.tipo === 'tarea' && !i.lista) ? 'No hay tareas con ese filtro.' : '¡Estás al día! Agrega una tarea con el botón ＋.');
    const ord = ordenar(tareas);
    let html = '';
    if (estado.prefs.orden === 'plazo') {
      const grupos = [['vencidas', 'Vencidas', 'rojo'], ['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Próximos 7 días'], ['despues', 'Más adelante'], [undefined, 'Sin plazo']];
      for (const [g, nombre, clase] of grupos) {
        const del = ord.filter((t) => estadoPlazo(t).grupo === g);
        if (del.length) html += tituloGrupo(nombre, del.length, clase) + del.map(cardTarea).join('');
      }
    } else if (estado.prefs.orden === 'prioridad') {
      for (const p of [1, 2, 3]) {
        const del = ord.filter((t) => t.prioridad === p);
        if (del.length) html += tituloGrupo(PRIO[p].replace(/l$/, 'les').replace(/a$/, 'as'), del.length) + del.map(cardTarea).join('');
      }
    } else {
      html = ord.map(cardTarea).join('');
    }
    elLista.innerHTML = html;
  }

  function renderListas() {
    const listas = filtrar(porPrioridad(estado.items.filter((i) => i.tipo === 'tarea' && i.lista)))
      .sort((a, b) => (b.listaEn || 0) - (a.listaEn || 0));
    if (!listas.length) return vacio('☑', 'Aún no marcas tareas como listas.');
    const h = hoy();
    const grupos = [
      ['Hoy', (t) => aStr(new Date(t.listaEn)) === h],
      ['Últimos 7 días', (t) => { const d = difDias(aStr(new Date(t.listaEn)), h); return d >= 1 && d <= 7; }],
      ['Anteriores', (t) => difDias(aStr(new Date(t.listaEn)), h) > 7]
    ];
    let html = '';
    for (const [nombre, f] of grupos) {
      const del = listas.filter(f);
      if (del.length) html += tituloGrupo(nombre, del.length) + del.map(cardTarea).join('');
    }
    html += `<div class="acciones" style="justify-content:center;margin-top:12px"><button class="mini" data-accion="vaciar">🗑 Borrar todas las listas</button></div>`;
    elLista.innerHTML = html;
  }

  function renderReuniones() {
    const reus = filtrar(estado.items.filter((i) => i.tipo === 'reunion'));
    if (!reus.length) return vacio('📅', estado.items.some((i) => i.tipo === 'reunion') ? 'No hay reuniones con esa búsqueda.' : 'Sin reuniones. Agrega una con ＋ y elige “Reunión”.');
    const key = (r) => `${r.fecha}T${r.hora || '00:00'}`;
    const ahora = `${hoy()}T${ahoraHHMM()}`;
    const fin = (r) => { const d = inicioDate(r); d.setMinutes(d.getMinutes() + (Number(r.duracion) || 30)); return `${aStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const futuras = reus.filter((r) => fin(r) >= ahora).sort((a, b) => key(a).localeCompare(key(b)));
    const pasadas = reus.filter((r) => fin(r) < ahora).sort((a, b) => key(b).localeCompare(key(a)));
    const deHoy = futuras.filter((r) => r.fecha === hoy());
    const proximas = futuras.filter((r) => r.fecha !== hoy());
    let html = '';
    if (deHoy.length) html += tituloGrupo('Hoy', deHoy.length) + deHoy.map(cardReunion).join('');
    if (proximas.length) html += tituloGrupo('Próximas', proximas.length) + proximas.map(cardReunion).join('');
    if (pasadas.length) html += tituloGrupo('Pasadas', pasadas.length) + pasadas.slice(0, 30).map((r) => cardReunion(r, true)).join('');
    elLista.innerHTML = html;
  }

  const tituloGrupo = (n, c, clase = '') => `<h3 class="grupo-titulo ${clase}">${esc(n)} <span class="cuenta">${c}</span></h3>`;
  function vacio(ico, txt) { elLista.innerHTML = `<div class="vacio"><div class="grande">${ico}</div><p>${esc(txt)}</p></div>`; }

  function cardTarea(t) {
    const ep = estadoPlazo(t);
    const tags = [];
    tags.push(`<span class="tag"><i class="dot p${t.prioridad}"></i>${PRIO[t.prioridad]}</span>`);
    if (t.lista) tags.push(`<span class="tag">✓ Lista ${fechaBonita(aStr(new Date(t.listaEn)))}</span>`);
    else tags.push(`<span class="tag ${ep.clase}">${ep.clase === 'vencida' ? '⚠ ' : '⏱ '}${esc(ep.txt)}</span>`);
    if (t.aplazos) tags.push(`<span class="tag aplazada" title="Plazo original: ${t.plazoOriginal ? fechaBonita(t.plazoOriginal) : '—'}">↷ Aplazada ${t.aplazos}×</span>`);
    return `
      <article class="card p${t.prioridad} ${t.lista ? 'hecha' : ''}" data-id="${t.id}">
        <button class="check ${t.lista ? 'on' : ''}" data-accion="toggle" aria-label="${t.lista ? 'Marcar como pendiente' : 'Marcar como lista'}">✓</button>
        <div class="cuerpo">
          <p class="titulo" data-accion="editar">${esc(t.titulo)}</p>
          <div class="meta">${tags.join('')}</div>
          ${t.notas ? `<p class="notas corta" data-accion="expandir">${esc(t.notas)}</p>` : ''}
          <div class="acciones">
            ${t.lista
              ? `<button class="mini" data-accion="toggle">↺ Reabrir</button><button class="mini" data-accion="eliminar">🗑 Eliminar</button>`
              : `<button class="mini" data-accion="aplazar">↷ Aplazar</button><button class="mini" data-accion="editar">✎ Editar</button>`}
          </div>
        </div>
      </article>`;
  }

  function inicioDate(r) { const d = deStr(r.fecha); const [h, m] = (r.hora || '09:00').split(':').map(Number); d.setHours(h, m, 0, 0); return d; }

  function cardReunion(r, pasada = false) {
    const ini = inicioDate(r);
    const fin = new Date(ini.getTime() + (Number(r.duracion) || 30) * 60000);
    const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const d = difDias(hoy(), r.fecha);
    const cuando = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : fechaBonita(r.fecha);
    const lugarEsLink = /^https?:\/\//i.test(r.lugar || '');
    return `
      <article class="card reunion ${pasada ? 'hecha' : ''}" data-id="${r.id}">
        <div class="cal-ico" aria-hidden="true"><div class="mes">${esc(fmtMes.format(deStr(r.fecha)).replace('.', ''))}</div><div class="dia">${deStr(r.fecha).getDate()}</div></div>
        <div class="cuerpo">
          <p class="titulo" data-accion="editar">${esc(r.titulo)}</p>
          <div class="meta">
            <span class="tag ${d === 0 && !pasada ? 'hoy' : ''}">🕑 ${cuando} · ${hhmm(ini)}–${hhmm(fin)}</span>
            ${r.lugar ? (lugarEsLink ? `<a class="tag" href="${esc(r.lugar)}" target="_blank" rel="noopener">🔗 Abrir link</a>` : `<span class="tag">📍 ${esc(r.lugar)}</span>`) : ''}
            ${r.enCalendario ? '<span class="tag pronto">✓ En Google Calendar</span>' : ''}
          </div>
          ${r.notas ? `<p class="notas corta" data-accion="expandir">${esc(r.notas)}</p>` : ''}
          <div class="acciones">
            ${pasada ? '' : `<a class="mini ${r.enCalendario ? '' : 'verde'}" href="${linkGoogle(r)}" target="_blank" rel="noopener" data-accion="gcal">📅 ${r.enCalendario ? 'Abrir de nuevo en' : 'Agregar a'} Google Calendar</a>`}
            <button class="mini" data-accion="ics">⬇ .ics</button>
            <button class="mini" data-accion="editar">✎ Editar</button>
            ${pasada ? '<button class="mini" data-accion="eliminar">🗑 Eliminar</button>' : ''}
          </div>
        </div>
      </article>`;
  }

  function renderResumen() {
    const pend = estado.items.filter((i) => i.tipo === 'tarea' && !i.lista);
    const venc = pend.filter((t) => estadoPlazo(t).clase === 'vencida').length;
    const deHoy = pend.filter((t) => estadoPlazo(t).grupo === 'hoy').length;
    const reuHoy = estado.items.filter((i) => i.tipo === 'reunion' && i.fecha === hoy() && `${i.hora}` >= ahoraHHMM()).length;
    const partes = [`${pend.length} pendiente${pend.length === 1 ? '' : 's'}`];
    if (venc) partes.push(`${venc} vencida${venc === 1 ? '' : 's'}`);
    if (deHoy) partes.push(`${deHoy} para hoy`);
    if (reuHoy) partes.push(`${reuHoy} reunión${reuHoy === 1 ? '' : 'es'} hoy`);
    const f = fechaBonita(hoy());
    $('#resumen').textContent = `${f.charAt(0).toUpperCase() + f.slice(1)} · ${partes.join(' · ')}`;
    $('#badgePend').textContent = venc + deHoy || '';
    $('#badgeReu').textContent = reuHoy || '';
    document.title = venc + deHoy ? `(${venc + deHoy}) Al Día` : 'Al Día';
  }

  // ---------- Google Calendar e .ics ----------
  function localCompacto(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
  function utcCompacto(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function linkGoogle(r) {
    const ini = inicioDate(r);
    const fin = new Date(ini.getTime() + (Number(r.duracion) || 30) * 60000);
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: r.titulo,
      dates: `${localCompacto(ini)}/${localCompacto(fin)}`,
      ctz: zona,
      details: r.notas || '',
      location: r.lugar || ''
    });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  }
  const icsTxt = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  function veventIcs(r) {
    const ini = inicioDate(r);
    const fin = new Date(ini.getTime() + (Number(r.duracion) || 30) * 60000);
    return ['BEGIN:VEVENT', `UID:${r.id}@al-dia`, `DTSTAMP:${utcCompacto(new Date())}`, `DTSTART:${utcCompacto(ini)}`, `DTEND:${utcCompacto(fin)}`,
      `SUMMARY:${icsTxt(r.titulo)}`, r.notas ? `DESCRIPTION:${icsTxt(r.notas)}` : '', r.lugar ? `LOCATION:${icsTxt(r.lugar)}` : '',
      'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'END:VALARM', 'END:VEVENT'].filter(Boolean).join('\r\n');
  }
  function descargarIcs(reus, nombre) {
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Al Dia//ES', 'CALSCALE:GREGORIAN', ...reus.map(veventIcs), 'END:VCALENDAR'].join('\r\n');
    descargar(new Blob([txt], { type: 'text/calendar;charset=utf-8' }), nombre);
  }
  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const slug = (s) => normal(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'reunion';

  // ---------- Formulario ----------
  let editandoId = null;
  let tipoForm = 'tarea';
  let prioForm = 2;

  function setTipo(tipo) {
    tipoForm = tipo;
    $$('#segTipo button').forEach((b) => b.classList.toggle('activo', b.dataset.tipo === tipo));
    $$('.solo-tarea', form).forEach((e) => (e.hidden = tipo !== 'tarea'));
    $$('.solo-reunion', form).forEach((e) => (e.hidden = tipo !== 'reunion'));
    form.fecha.required = form.hora.required = tipo === 'reunion';
    form.titulo.placeholder = tipo === 'tarea' ? 'Ej: Revisar informe de calidad semanal' : 'Ej: Comité de calidad mensual';
    $('#formTitulo').textContent = `${editandoId ? 'Editar' : 'Nueva'} ${tipo === 'tarea' ? 'tarea' : 'reunión'}`;
  }
  function setPrio(p) {
    prioForm = p;
    $$('#segPrioridad button').forEach((b) => b.classList.toggle('activo', Number(b.dataset.p) === p));
  }

  function abrirForm(item, tipoInicial) {
    editandoId = item ? item.id : null;
    form.reset();
    $('#segTipo').hidden = !!item;
    if (item) {
      form.titulo.value = item.titulo;
      form.notas.value = item.notas || '';
      if (item.tipo === 'tarea') { form.plazo.value = item.plazo || ''; form.plazoHora.value = item.plazoHora || ''; setPrio(item.prioridad); }
      else { form.fecha.value = item.fecha; form.hora.value = item.hora; form.duracion.value = String(item.duracion || 30); form.lugar.value = item.lugar || ''; }
      setTipo(item.tipo);
    } else {
      form.plazo.value = hoy();
      form.fecha.value = hoy();
      const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1);
      form.hora.value = `${pad(d.getHours())}:00`;
      setPrio(estado.prefs.prioridad || 2);
      setTipo(tipoInicial || (estado.prefs.vista === 'reuniones' ? 'reunion' : 'tarea'));
    }
    $('#btnEliminar').hidden = !item;
    dlgForm.showModal();
    if (!item) setTimeout(() => form.titulo.focus(), 50);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titulo = form.titulo.value.trim();
    if (!titulo) return form.titulo.focus();
    const base = { titulo, notas: form.notas.value.trim() };
    if (tipoForm === 'tarea') Object.assign(base, { plazo: form.plazo.value || '', plazoHora: form.plazo.value ? form.plazoHora.value : '', prioridad: prioForm });
    else {
      if (!form.fecha.value || !form.hora.value) return;
      Object.assign(base, { fecha: form.fecha.value, hora: form.hora.value, duracion: Number(form.duracion.value), lugar: form.lugar.value.trim() });
    }
    const id = editandoId;
    dlgForm.close();
    if (id) {
      cambiar('Cambios guardados', () => {
        const it = buscarItem(id);
        if (it.tipo === 'reunion' && (it.fecha !== base.fecha || it.hora !== base.hora || it.duracion !== base.duracion)) it.enCalendario = false;
        if (it.tipo === 'tarea' && it.plazo !== base.plazo) { it.plazoOriginal = it.plazoOriginal || it.plazo; }
        Object.assign(it, base, { editada: Date.now() });
      });
    } else {
      const nuevo = { id: uid(), tipo: tipoForm, creada: Date.now(), ...base };
      if (tipoForm === 'tarea') Object.assign(nuevo, { lista: false, aplazos: 0 });
      if (tipoForm === 'reunion' && estado.prefs.vista !== 'reuniones') estado.prefs.vista = 'reuniones';
      if (tipoForm === 'tarea' && estado.prefs.vista === 'reuniones') estado.prefs.vista = 'pendientes';
      cambiar(tipoForm === 'tarea' ? 'Tarea agregada' : 'Reunión guardada', () => estado.items.push(nuevo));
    }
  });

  $('#segTipo').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTipo(b.dataset.tipo); });
  $('#segPrioridad').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPrio(Number(b.dataset.p)); });
  $('#atajosPlazo').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    form.plazo.value = b.dataset.dias === 'viernes' ? esteViernes() : sumarDias(hoy(), Number(b.dataset.dias));
  });
  $('#btnEliminar').addEventListener('click', () => {
    const id = editandoId; dlgForm.close();
    const it = buscarItem(id);
    cambiar(`${it.tipo === 'tarea' ? 'Tarea' : 'Reunión'} eliminada`, () => { estado.items = estado.items.filter((i) => i.id !== id); });
  });

  // Cerrar hojas: botón ✕ / Cancelar o tocar fuera.
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) d.close();
      else if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) d.close(); }
    });
  });

  // ---------- Aplazar ----------
  let aplazandoId = null;
  function abrirAplazar(t) {
    aplazandoId = t.id;
    $('#aplazarInfo').textContent = t.plazo ? `Plazo actual: ${fechaBonita(t.plazo)}${t.plazoHora ? ' ' + t.plazoHora : ''}${difDias(hoy(), t.plazo) < 0 ? ' (vencida: se aplaza desde hoy)' : ''}` : 'Sin plazo: se aplaza desde hoy.';
    $('#aplazarFecha').value = sumarDias(maxFecha(t.plazo || hoy(), hoy()), 1);
    $('#aplazarFecha').min = hoy();
    dlgAplazar.showModal();
  }
  function aplicarAplazo(nueva) {
    const id = aplazandoId; dlgAplazar.close();
    cambiar(`Aplazada al ${fechaBonita(nueva)}`, () => {
      const t = buscarItem(id);
      if (!t.plazoOriginal) t.plazoOriginal = t.plazo || hoy();
      t.plazo = nueva; t.aplazos = (t.aplazos || 0) + 1;
    });
  }
  dlgAplazar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aplazar]'); if (!b) return;
    const t = buscarItem(aplazandoId);
    const base = maxFecha(t.plazo || hoy(), hoy());
    aplicarAplazo(b.dataset.aplazar === 'habil' ? proximoHabil(base) : sumarDias(base, Number(b.dataset.aplazar)));
  });
  $('#btnAplazarFecha').addEventListener('click', () => { const v = $('#aplazarFecha').value; if (v) aplicarAplazo(v); });

  // ---------- Acciones en tarjetas ----------
  elLista.addEventListener('click', (e) => {
    const el = e.target.closest('[data-accion]'); if (!el) return;
    const accion = el.dataset.accion;
    if (accion === 'vaciar') {
      const n = estado.items.filter((i) => i.tipo === 'tarea' && i.lista).length;
      if (n && confirm(`¿Borrar las ${n} tareas listas? Podrás deshacerlo justo después.`))
        cambiar(`${n} tareas listas borradas`, () => { estado.items = estado.items.filter((i) => !(i.tipo === 'tarea' && i.lista)); });
      return;
    }
    const card = el.closest('.card'); if (!card) return;
    const it = buscarItem(card.dataset.id); if (!it) return;
    switch (accion) {
      case 'toggle':
        cambiar(it.lista ? 'Tarea reabierta' : '¡Lista! Movida a “Listas”', () => { it.lista = !it.lista; it.listaEn = it.lista ? Date.now() : null; });
        break;
      case 'editar': abrirForm(it); break;
      case 'aplazar': abrirAplazar(it); break;
      case 'eliminar': cambiar(`${it.tipo === 'tarea' ? 'Tarea' : 'Reunión'} eliminada`, () => { estado.items = estado.items.filter((i) => i.id !== it.id); }); break;
      case 'expandir': el.classList.toggle('corta'); break;
      case 'ics': descargarIcs([it], `${slug(it.titulo)}.ics`); break;
      case 'gcal': // el link se abre solo; aquí marcamos que ya se envió
        setTimeout(() => { it.enCalendario = true; guardar(); render(); }, 300);
        break;
    }
  });

  // ---------- Barra, filtros y navegación ----------
  $$('.tab').forEach((b) => b.addEventListener('click', () => { estado.prefs.vista = b.dataset.vista; guardar(); render(); window.scrollTo({ top: 0 }); }));
  $('#chipsPrioridad').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (!c) return; estado.prefs.prioridad = Number(c.dataset.p); guardar(); render(); });
  elOrden.addEventListener('change', () => { estado.prefs.orden = elOrden.value; guardar(); render(); });
  elBuscar.addEventListener('input', render);
  $('#fab').addEventListener('click', () => abrirForm(null));
  $('#btnMas').addEventListener('click', () => { pedirVersion(); dlgMas.showModal(); });

  // ---------- Respaldo ----------
  $('#btnExportar').addEventListener('click', () => {
    const datos = { app: 'al-dia', version: 1, exportado: new Date().toISOString(), items: estado.items };
    descargar(new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' }), `al-dia-respaldo-${hoy()}.json`);
    dlgMas.close();
  });
  $('#inputImportar').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      const items = Array.isArray(d) ? d : d.items;
      if (!Array.isArray(items) || items.some((i) => !i || !i.id || !i.titulo || !['tarea', 'reunion'].includes(i.tipo))) throw new Error('formato');
      if (!confirm(`El respaldo trae ${items.length} elementos. ¿Reemplazar los datos de este dispositivo?`)) return;
      dlgMas.close();
      cambiar(`Respaldo importado (${items.length})`, () => { estado.items = items; });
    } catch { alert('El archivo no es un respaldo válido de Al Día.'); }
  });
  $('#btnExportarIcs').addEventListener('click', () => {
    const ahora = new Date();
    const futuras = estado.items.filter((i) => i.tipo === 'reunion' && inicioDate(i) >= ahora);
    if (!futuras.length) return alert('No hay reuniones futuras para exportar.');
    descargarIcs(futuras, `al-dia-reuniones-${hoy()}.ics`);
    dlgMas.close();
  });

  // ---------- Toast con deshacer ----------
  let toastTimer;
  function toast(msg, alDeshacer) {
    const t = $('#toast');
    $('#toastTxt').textContent = msg;
    const btn = $('#toastBtn');
    btn.hidden = !alDeshacer;
    btn.onclick = () => { t.hidden = true; alDeshacer && alDeshacer(); };
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, alDeshacer ? 6000 : 2500);
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('input,textarea') && !$('#toastBtn').hidden && !$('#toast').hidden) $('#toastBtn').click();
  });

  // ---------- PWA: instalación y actualizaciones ----------
  let eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; $('#btnInstalar').hidden = false; });
  $('#btnInstalar').addEventListener('click', async () => { if (!eventoInstalar) return; eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; $('#btnInstalar').hidden = true; });
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (esIOS && !instalada) {
    const b = $('#btnInstalar'); b.hidden = false;
    b.querySelector('small').textContent = 'En iPhone: toca Compartir (□↑) en Safari y luego “Agregar a inicio”.';
    b.onclick = () => alert('En Safari toca el botón Compartir (cuadrado con flecha) y elige “Agregar a pantalla de inicio”.');
  }

  let registro = null;
  let quiereActualizar = false;
  function mostrarBanner() { $('#bannerVersion').hidden = false; }
  function pedirVersion() {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (c) c.postMessage('VERSION');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.version) $('#txtVersion').textContent = `Versión instalada: ${e.data.version}`; });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (quiereActualizar) location.reload(); });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        registro = reg;
        if (reg.waiting && navigator.serviceWorker.controller) mostrarBanner();
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo && nuevo.addEventListener('statechange', () => { if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrarBanner(); });
        });
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      }).catch(() => {});
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && registro) registro.update().catch(() => {}); });
  }
  $('#btnActualizar').addEventListener('click', () => {
    quiereActualizar = true;
    if (registro && registro.waiting) registro.waiting.postMessage('SKIP_WAITING');
    else location.reload();
  });
  $('#btnBuscarAct').addEventListener('click', async () => {
    if (!registro) return alert('La actualización automática funciona cuando la app está publicada (https).');
    await registro.update().catch(() => {});
    setTimeout(() => {
      if (registro.waiting || registro.installing) { dlgMas.close(); mostrarBanner(); }
      else toast('Ya tienes la última versión', null);
    }, 1200);
  });

  // Refresca etiquetas de plazo (vencida, hoy…) cada minuto y al volver a la app.
  setInterval(render, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });

  render();
})();
