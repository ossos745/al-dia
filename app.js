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

  // Paquetes de tareas que llegan con una actualización. Cada id se agrega una sola vez:
  // si la borras, no vuelve a aparecer (los ids ya entregados quedan en CLAVE_PAQUETES).
  const CLAVE_PAQUETES = 'al-dia:paquetes';
  const PAQUETES = [
    { id: 'w1117-guia-legal', titulo: 'Terminar la guía legal', plazo: '2026-11-17', prioridad: 1,
      notas: 'Tarea vigente según don William (audio 17-nov). Después de la guía legal se ven otros temas.' },
    { id: 'w1117-recordar-comunicado', titulo: 'Recordarle a don William el comunicado de Reembolso por devolución (flujo online)', plazo: '2026-11-17', prioridad: 1,
      notas: 'Pidió que se lo recuerdes durante el día, cuando vayas avanzando. Con ese comunicado se hace el flujo.' },
    { id: 'w1117-flujograma-reembolso', titulo: 'Flujograma: Reembolso por devolución (flujo online)', plazo: '2026-11-20', prioridad: 1,
      notas: 'Primer flujo a mapear, a partir del comunicado de don William (él ayuda). Plazo puesto por mí: ajústalo si William da otro.' },
    { id: 'w1117-procedimiento-reembolso', titulo: 'Procedimiento escrito: Reembolso por devolución (flujo online)', plazo: '2026-11-24', prioridad: 2,
      notas: 'Usar el prompt para Claude que dará don William y el mismo formato de los procedimientos de Isaac. Va después del flujograma.' },
    { id: 'w1117-dudas-audio', titulo: 'Confirmar dudas del audio de don William', plazo: '2026-11-18', prioridad: 3,
      notas: '¿Qué es el "panel de SELEAN"? ¿Cómo se escriben Gonçoy, Tiara y Malla? Ver PDF en Falabella\\Reuniones.' },
    { id: 'w1117-accesos-portal', titulo: 'Revisar Portal SAC y los accesos que entregue don William', plazo: '', prioridad: 3,
      notas: 'Los comunicados de procedimientos se cargan en el Portal SAC (lo hizo Elisa).' },
    { id: 'w1117-revisar-borrador-flujo', titulo: 'Revisar con don William el borrador del flujograma Reembolso por devolución', plazo: '2026-11-18', prioridad: 1,
      notas: 'Archivo: Falabella\\Flujogramas\\Reembolso por devolucion - borrador v0.1.drawio. Confirmar: cómo llega el caso a BO (cola), si tienda Falabella también va al Focal STS Corp, qué hace el Focal y en qué plazo, cómo se reembolsa el saldo (¿NC / Gestión de reembolso? ¿1P vs 3P?), cierre y plantilla, si aplica a LR/SERNAC, y si N2 es "Devoluciones" o "Cambios y devoluciones".' },
    { id: 'w1117-pedir-drawio', titulo: 'Pedir el archivo «Diagramas tipificaciones» (.drawio) a William o Isaac', plazo: '2026-11-18', prioridad: 2,
      notas: 'Para pegar el flujo en la misma página/estilo que los demás N3.' },
    // Audio «Tarea» de don William, 18-nov: reporte Connect – Cobro/Anulación Mandato
    { id: 'w1118-confirmar-regla-connect', titulo: 'Confirmar con don William las dudas del reporte Connect – Cobro/Anulación Mandato', plazo: '2026-11-19', prioridad: 1,
      notas: '1) El aviso SAC 210726 se contradice: ¿FO ingresa por N1 Reclamo, o el Front Regional ingresa por Pedido Solicitud y el BO 1P retipifica? 2) ¿Qué cuenta como «mal creado desde operaciones»: el Bot (Pantalla Única), el BO o ambos? 3) ¿El reporte va sobre las abiertas del lunes o sobre las creadas en la semana? 4) ¿Qué plazo quiso decir con «no el lunes que viene sino el que sigue… hasta el miércoles de la otra semana»?' },
    { id: 'w1118-pedir-escrito-tarea', titulo: 'Pedirle a don William el escrito y el comunicado de la tarea Connect', plazo: '2026-11-19', prioridad: 2,
      notas: 'Dijo que te enviaría la tarea por escrito y el comunicado de Cobro/Anulación Mandato. Ya tienes el aviso «210726 Reforzamiento N1 Connect» y la base.' },
    { id: 'w1118-revisar-pistas', titulo: 'Leer los 18 casos con «pista en descripción» del reporte Connect', plazo: '2026-11-20', prioridad: 2,
      notas: 'Excel: Falabella\\Reportes\\2026-11-18 Reporte Connect Cobro-Anulación Mandato.xlsx, hoja Detalle, columna K. Ver si el N4 calza con lo que dice la descripción (p. ej. NC por cobro que menciona «desconoce»).' },
    { id: 'w1118-presentar-reporte', titulo: 'Mostrarle a don William el primer reporte Connect – Cobro/Anulación Mandato', plazo: '2026-11-20', prioridad: 1,
      notas: 'Llevar el Excel y el PDF (Falabella\\Reuniones). Resultado preliminar: 3 sin N4, 89 debían ser Reclamo, 54 debían ser Pedido Solicitud, 113 OK. Pedir feedback para pulirlo como reporte semanal.' },
    { id: 'w1118-reporte-lunes', titulo: 'Reporte semanal Connect – Cobro/Anulación Mandato (lunes)', plazo: '2026-11-23', prioridad: 1,
      notas: 'Cada lunes: descargar las abiertas de la tipología desde el panel de abiertas, pegarlas en la hoja Detalle del Excel (columnas A–H y L) y arrastrar las fórmulas I–J. Al terminar, aplazar esta tarea +1 semana.' },
    { id: 'w1118-panel-abiertas', titulo: 'Practicar con el panel de abiertas: filtros, M7–M30, reapertura y recontacto', plazo: '', prioridad: 3,
      notas: 'Filtrar por tipología, área (ej. Línea Roja) y propietario, y descargar. Meta: 85 % cerrado antes de 10 días. Detalle en el Glosario SAC.' },
    { id: 'w1118-patron-ia', titulo: 'Idea: patrón por palabras clave / IA para saber si va por Pedido o Reclamo', plazo: '', prioridad: 3,
      notas: 'Propuesta de don William: usar la descripción del caso para detectar si está bien creado. Base: la columna «Pista en descripción» del Excel.' },
    { id: 'w1118-automatizacion-connect', titulo: 'Idea: automatización pequeña con Connect (ver con don William)', plazo: '', prioridad: 3,
      notas: 'Mencionada en los audios del 17 y 18-nov: algo sencillo para ir familiarizándose, de menos a más.' },
    // Audio «Tarea 3», 18-nov 17:57: revisión del Excel con don William (se usa la versión con base completa)
    { id: 'w1119-revisar-73', titulo: 'Revisar los 73 casos de Desconocimiento creados como Pedido Solicitud', plazo: '2026-11-19', prioridad: 1,
      notas: 'Foco principal de don William: «estos 73 deberían ser Reclamo sí o sí, hay que levantarlo». Ver quién y qué área los tiene (71 entraron por Teléfono y 2 por Chat). Filtrar en el Excel base completa: N4 = Desconocimiento y N1 = Pedido Solicitud.' },
    { id: 'w1119-dotacion', titulo: 'Pedir la dotación por área y agregar «Área» al Excel Connect', plazo: '2026-11-19', prioridad: 1,
      notas: 'Cruzar el propietario del caso con la dotación (Línea Roja, SERNAC, Backoffice…) y agregar una tabla dinámica por área. El reporte final va por área. Todo con fórmulas.' },
    { id: 'w1119-titulo-neutro', titulo: 'Cambiar el título «¿Quién lo creó mal?» del Excel por uno neutro', plazo: '2026-11-19', prioridad: 2,
      notas: 'Pedido de don William, para no herir susceptibilidades. Propuesta: «Por canal de creación».' },
    { id: 'w1119-aclarar-metodo', titulo: 'Explicarle a don William cómo funciona el análisis del Excel (no es IA)', plazo: '2026-11-19', prioridad: 2,
      notas: 'Él entendió que la IA leyó las descripciones. En realidad: «Resultado» aplica la regla del aviso al N4 y «Pista» busca palabras clave en la descripción. Decírselo antes de validar con Backoffice.' },
    { id: 'w1119-reunion-pamela', titulo: 'Coordinar reunión con Pamela Pizarro (Backoffice) para validar el reporte Connect', plazo: '2026-11-20', prioridad: 2,
      notas: 'El BO recibe la mayor parte de este N3. Revisar casos puntuales juntos, ver si el análisis acierta y afinar las palabras clave de la columna «Pista».' },
    { id: 'w1119-bloqueo-reclamo', titulo: 'Averiguar desde cuándo rige el bloqueo de N1 Reclamo → Pedido Solicitud', plazo: '2026-11-20', prioridad: 1,
      notas: 'Don William: van a bloquear el cambio de Reclamo a Pedido (al revés sí se podrá). Un Reclamo mal creado obligará a cancelar y crear otro caso. Preguntar qué se hace con los 54 casos del Bot creados como Reclamo que debían ser Pedido Solicitud.' },
    { id: 'w1119-propietarios-sin-area', titulo: 'Preguntar el área de los 9 propietarios que no están en la dotación', plazo: '2026-11-20', prioridad: 1,
      notas: 'No aparecen en «DOTACION DE PLATAFORMA.xlsx» y tienen 141 de los 259 casos (36 de los 73 posibles fraudes). La lista está en la hoja Dotación del Excel Connect (filas con Área en blanco). ¿Son de otra plataforma, de un proveedor externo o están desvinculados? Cuando se sepa, completar la columna Área y Datos → Actualizar todo.' },
    // Audio «RESPUESTAS A TUS DUDAS» (19-nov)
    { id: 'w1119-excel-error-bo', titulo: 'Ajustar el Excel Connect: error atribuido al BO en la retipificación', plazo: '2026-11-23', prioridad: 2,
      notas: 'Regla confirmada: todo entra como N1 Pedido Solicitud y el BO retipifica a Reclamo si corresponde. Revisar títulos y la hoja Regla para que no culpen al Front.' },
    { id: 'w1119-bot-reclamo', titulo: 'Preguntar a don William por qué el Bot crea los casos como Reclamo', plazo: '2026-11-23', prioridad: 3,
      notas: 'La regla dice que todo entra como Pedido Solicitud, pero los casos del Bot (Pantalla Única) entran como Reclamo. ¿Excepción o error de ingreso?' },
  ];
  (function aplicarPaquetes() {
    let entregados = [];
    try { entregados = JSON.parse(localStorage.getItem(CLAVE_PAQUETES) || '[]'); } catch { entregados = []; }
    const nuevos = PAQUETES.filter((p) => !entregados.includes(p.id) && !estado.items.some((i) => i.id === p.id));
    if (!nuevos.length) return;
    const ahora = Date.now();
    nuevos.forEach((p, k) => estado.items.push({ ...p, tipo: 'tarea', plazoHora: '', creada: ahora + k, lista: false, aplazos: 0 }));
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      localStorage.setItem(CLAVE_PAQUETES, JSON.stringify([...entregados, ...nuevos.map((p) => p.id)]));
    } catch {}
  })();

  // Ajustes de una sola vez a tareas que ya llegaron en un paquete (si ya las tenías, se corrige el título).
  const CLAVE_AJUSTES = 'al-dia:ajustes';
  const AJUSTES = [
    { id: 'aj-1117-flujo-online', fn: () => {
      ['w1117-recordar-comunicado', 'w1117-flujograma-reembolso', 'w1117-procedimiento-reembolso'].forEach((id) => {
        const it = estado.items.find((i) => i.id === id);
        if (it && !/flujo online/i.test(it.titulo)) it.titulo += ' (flujo online)';
      });
    } },
    { id: 'aj-1117-comunicado-recibido', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1117-recordar-comunicado');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas = (it.notas ? it.notas + ' ' : '') + 'Recibido el 17-nov: «Nuevo N3 reembolso por devolucion 1.pdf».'; }
    } },
    { id: 'aj-1119-reporte-presentado', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-presentar-reporte');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas = (it.notas ? it.notas + ' ' : '') + 'Revisado con don William el 18-nov (audio «Tarea 3»): le gustó; pidió reporte por área, título neutro y validar con Pamela Pizarro.'; }
    } },
    { id: 'aj-1119-reporte-lunes', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-reporte-lunes');
      if (it) it.notas = 'Usar el Excel «(base completa)». Cada lunes: descargar las abiertas de la tipología desde el panel, pegarlas en la hoja Base bajo la tabla (mismas 59 columnas), revisar que BH–BJ tengan fórmula y Datos → Actualizar todo. Enviarlo al Backoffice para que retipifiquen. Al terminar, aplazar +1 semana.';
    } },
    { id: 'aj-1119-titulo-hecho', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-titulo-neutro');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas += ' Hecho el 19-nov: ahora dice «Por canal de creación».'; }
    } },
    { id: 'aj-1119-dotacion-excel', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-dotacion');
      if (it) { it.titulo = 'Conseguir la dotación por área y completarla en el Excel Connect'; it.notas = 'El Excel ya tiene la hoja «Dotación» (los 28 propietarios de la base, con el Área en blanco), la columna «Área» en la base y la hoja «Por área» con las tablas dinámicas. Falta la dotación oficial: completar la columna Área, o pegar la dotación (nombre en A, área en B), y luego Datos → Actualizar todo.'; }
    } },
    { id: 'aj-1119-foco73-excel', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-revisar-73');
      if (it) it.notas = 'Foco de don William: «estos 73 deberían ser Reclamo sí o sí». En el Excel base completa: hoja «Por área», tabla 5 (por área y propietario), o filtrar la columna «Alerta» = «Posible fraude…» en la hoja Base. Revisar casos en Connect Front y ver qué área los tiene, una vez cargada la dotación.';
    } },
    { id: 'aj-1119-dotacion-cargada', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-dotacion');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas += ' Hecho el 19-nov con «DOTACION DE PLATAFORMA.xlsx»: 18 de 28 propietarios con área (Sub-categoría). Faltan 9 que no están en la dotación (ver tarea aparte).'; }
    } },
    { id: 'aj-1119-sin-area-provisorio', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-propietarios-sin-area');
      if (it) { it.titulo = 'Confirmar con don William el área de los 9 propietarios fuera de la dotación'; it.notas = 'Por ahora están marcados como «BACK OFFICE 1P (fuera de dotación)», porque por regla de asignación todo este N3 va a FAL_CL_BO_General. No son SERNAC: ninguno tiene ID regulatorio. Tienen 141 de los 259 casos. Si William dice otra área, se cambia en la hoja Dotación y luego Datos → Actualizar todo.'; }
    } },
    // Audio «RESPUESTAS A TUS DUDAS» (19-nov): William responde las dudas del reporte Connect
    { id: 'aj-1119-dudas-respondidas', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-confirmar-regla-connect');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas = 'Respondido (19-nov): todo entra como N1 Pedido Solicitud y el BO retipifica a Reclamo si corresponde; los errores son del BO en la retipificación; la base son los casos creados en la semana (lunes a domingo).'; }
    } },
    { id: 'aj-1119-reporte-lunes-creadas', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-reporte-lunes');
      if (it) { it.plazo = '2026-11-23'; it.notas = 'Descargar los casos CREADOS entre el lunes y el domingo anteriores (no las abiertas). Primer reporte: lunes 23-nov con lo creado del 16 al 22-nov. Pegar en la hoja Base del Excel «(base completa)» (eliminar filas de la tabla y pegar valores en A2). El error se atribuye al BO en la retipificación.'; }
    } },
    { id: 'aj-1119-pistas', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-revisar-pistas');
      if (it) it.notas = 'Excel «(base completa)», hoja Base, columna «Pista en descripción». Ver si el N4 calza con la descripción. Llevar los dudosos a la reunión con Pamela Pizarro para afinar las palabras clave.';
    } },
  ];
  (function aplicarAjustes() {
    let hechos = [];
    try { hechos = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || '[]'); } catch { hechos = []; }
    const pendientes = AJUSTES.filter((a) => !hechos.includes(a.id));
    if (!pendientes.length) return;
    pendientes.forEach((a) => a.fn());
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
      localStorage.setItem(CLAVE_AJUSTES, JSON.stringify([...hechos, ...pendientes.map((a) => a.id)]));
    } catch {}
  })();

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
