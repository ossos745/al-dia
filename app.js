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
    // Audio «Explicación diagrama-Flujo offline y mas» (19-nov, 17:42): depurar el N3 Flujo Offline
    { id: 'w1119-offline-base-queries', titulo: 'Flujo Offline: recibir la base de don William y las queries de policies y RLO', plazo: '2026-11-20', prioridad: 2,
      notas: 'William quedó de mandar el 20-nov una base del N3 «Problemas para devolver la orden de compra» con la query de policies lista (si aún no hay acceso al panel de abiertas 1P/3P). Pedir también la query de RLO de Andrés. La de policies busca por Order Name: números entre comillas y separados por comas.' },
    { id: 'w1119-offline-muestra-0a4', titulo: 'Flujo Offline: revisar una muestra de casos abiertos creados hace 0–4 días', plazo: '2026-11-23', prioridad: 1,
      notas: 'Unos 5 casos para empezar: ¿cumplen el procedimiento?, ¿qué se detecta? Ojo con los mal tipificados que son Reembolso por devolución, los creados por la tienda por PU (debía ser YTL → Línea Roja) y los de un caso por SKU. Plazo puesto por Claude.' },
    { id: 'w1119-offline-1p', titulo: 'Flujo Offline: listar los casos 1P con N4 Flujo Offline (11) y proponer qué hacer', plazo: '2026-11-23', prioridad: 1,
      notas: 'El flujo es solo 3P Mini Ticket. Opciones de William: devolverlos a la operación para que los rehaga, o cerrarlos nosotros según antigüedad. Plazo puesto por Claude.' },
    { id: 'w1119-offline-reporte', titulo: 'Flujo Offline: diseñar el reporte semanal de control del N3 para las áreas', plazo: '2026-11-27', prioridad: 1,
      notas: 'Cruzar la base con las queries de policies y RLO: 1P mal tipificados, estado de policies, RLO vigente o vencida, casos de Reembolso por devolución. Que sea conciso y se envíe a las áreas para que cierren o corrijan. Plazo puesto por Claude.' },
    { id: 'w1119-offline-avisos', titulo: 'Avisar a don William los errores de fuente del Flujo Offline', plazo: '2026-11-24', prioridad: 2,
      notas: '(1) El maestro de asignación permite 1P + N4 Flujo Offline (filas 542 y 547). (2) El procedimiento .docx tiene invertido el paso 1 (dice «si está entregada → totalizar»). (3) Su alcance no dice «solo 3P». (4) Paso 4: «reasignarse» en vez de ir al carril offline. (5) Sigue la duda «¿Policies rechazado? No → solicitar evidencia».' },
    { id: 'w1119-offline-tottus', titulo: 'Preguntar a don William a quién de tiendas consultar por la devolución rechazada en Tottus', plazo: '', prioridad: 3,
      notas: 'Producto «alta gama» con RLO vigente y en plazo que Tottus no recibió. William mencionó a dos contactos de tiendas.' },
    // Audio «Revisión Problema con la Giftcard V1» (20-nov, ~13:00): rehacer el flujo por tipo de gift card
    { id: 'w1120-gc-flujo-por-tipo', titulo: 'Gift Card: rehacer el flujo v2 abierto por tipo de gift card', plazo: '2026-11-24', prioridad: 1,
      notas: 'Decisión de la revisión con William y Pamela: quiebre (nueva GC por Jarvis con evidencia), corporativa (se extiende una vez), empresa (no se extiende) e intangible (otra área). Cruzar con los tipos del instructivo. Listo para presentarlo el martes.' },
    { id: 'w1120-gc-preguntas-juan', titulo: 'Gift Card: preparar las preguntas para Juan Fuentes', plazo: '2026-11-23', prioridad: 1,
      notas: 'Plazo de extensión de las corporativas, rol de Venta Empresa, restricciones de uso por tipo, intangibles, novios, número de GC y SLA. Lista en la ficha del audio (Falabella\\Reuniones).' },
    { id: 'w1120-gc-reunion-juan', titulo: 'Gift Card: reunión en la oficina con Juan Fuentes para presentar el flujo', plazo: '2026-11-24', prioridad: 1,
      notas: 'Acordada para el martes 24-nov en la oficina. Hora por confirmar: cuando la tengas, crea la reunión en la app para pasarla a Google Calendar.' },
    { id: 'w1120-gc-numero-gc', titulo: 'Gift Card: agregar al flujo cómo pedir el número de la gift card', plazo: '2026-11-24', prioridad: 2,
      notas: 'Sin el número no se puede gestionar. No hay plantilla ni número de intentos definido; Pamela lo verá con el área de comunicaciones. Dejarlo como paso del flujo para validarlo.' },
    { id: 'w1120-gc-avisos', titulo: 'Gift Card: avisar a don William las diferencias entre la reunión y el instructivo', plazo: '2026-11-24', prioridad: 2,
      notas: 'Tipos de GC distintos (Anticipadas/FXC vs quiebre/corporativa/empresa), Venta Empresa extendía según el instructivo, restricciones de uso distintas y cómo se resuelve la GC de quiebre sin código.' },
    // Audio «Reinsistencia» (24-nov, 13:01): base de datos de reinsistencias
    { id: 'w1124-rein-base', titulo: 'Reinsistencias: conseguir la base de datos y confirmar el encargo', plazo: '2026-11-25', prioridad: 1,
      notas: 'Reinsistencia = el cliente vuelve a reclamar por lo mismo después del cierre. Confirmar si la base es solo de falsa entrega, quién la envía, de qué periodo y qué entregable se espera. Plazo puesto por Claude (el audio no dio).' },
    { id: 'w1124-rein-evidencia', titulo: 'Reinsistencias: revisar la evidencia de entrega con el criterio de evidencia válida', plazo: '', prioridad: 2,
      notas: 'Evidencia válida: en el mismo caso, foto del lugar de entrega (casa o su entorno), con la etiqueta del producto y la numeración de la casa o dirección visibles.' },
    // Reunión con William, Pamela y Lorena (25-nov, ~11:11): homologación boleta/factura y N3 de tienda
    { id: 'w1125-minuta-boleta', titulo: 'Minuta «Solicitud cambiar boleta/factura» (reunión 25-nov)', plazo: '2026-11-26', prioridad: 1,
      notas: 'Acuerdos: 2 N3 boleta/factura (Copia/solicitud y Cambio/corrección de datos) para 1P y 3P, Pedido Solicitud; diferencia por tarea (BO General solo corrección; grupos sensibles también cambio boleta→factura). Tienda: Problema en tienda a cola LR con 6 N4; nuevo N3 Gestión complementaria. William la envía a Mario por correo. Plazo puesto por Claude (freeze desde el 26-nov).' },
    { id: 'w1125-foto-notas', titulo: 'Pedir la foto de las notas de la reunión del 25-nov para contrastar la minuta', plazo: '2026-11-26', prioridad: 1, notas: '' },
    { id: 'w1125-dudas-minuta', titulo: 'Confirmar con don William las dudas de la reunión antes de enviar la minuta', plazo: '2026-11-26', prioridad: 1,
      notas: 'Nombres exactos de las tareas, hasta cuándo es el freeze, fecha de Gestión complementaria, si Problema en tienda deja de ser FCR, qué pasa con Actitud del personal, y si Gestión complementaria reemplaza al Reproceso de reembolso en los flujos publicados.' },
    { id: 'w1125-reproceso-flujos', titulo: 'Listar los flujos que usan «Reproceso de reembolso» (por Gestión complementaria)', plazo: '', prioridad: 2,
      notas: 'Flujo Offline, Daño a la propiedad, C&D. Actualizarlos cuando exista el N3 nuevo.' },
    { id: 'w1125-boleta-flujos', titulo: 'Cuando se homologue: actualizar flujos/procedimientos de boleta/factura', plazo: '', prioridad: 2, notas: 'Queda como está hasta que Marito cambie las reglas.' },
    { id: 'w1125-nexus-bo3p', titulo: 'Seguir el Nexus pendiente: N3 que llegan al BO 3P y Línea Roja arrastra', plazo: '', prioridad: 3,
      notas: 'Espera lo que tiene Andrés y lo de César (Problemas con personal a la cola LR).' },
    // Reunión de equipo con William (26-nov, ~11:27): panel con Constanza, reinsistencias, Cupón promocional
    { id: 'w1126-panel-folios', titulo: 'Panel de folios M20 / fecha pactada con Constanza (ella responsable)', plazo: '2026-11-27', prioridad: 1,
      notas: 'Reemplazar el reporte diario de Andrés por un panel Looker. 1) Ver si el panel de Coni usa la misma tabla. 2) Columnas: N3, cambio/devolución, folio, fecha folio, fecha comprometida, estado (futura/incumplida), área (Producto con falla de funcionamiento → Servicio Técnico; Línea Roja). Filtros por fecha y descarga Excel. Plazo: «viernes» (¿27-nov o 4-dic?).' },
    { id: 'w1126-rein-revision', titulo: 'Reinsistencias: revisar evidencias en la planilla (~10 casos al día, entre los tres)', plazo: '2026-11-27', prioridad: 1,
      notas: 'William explica el 26 o 27-nov. Evidencia = fotos dentro de una tarea. Válida si se ve bulto entregado, fachada, persona recibiendo y número de OC. Reunión los viernes.' },
    { id: 'w1126-cupon-promocional', titulo: 'Flujo Cupón promocional: agendar con la supervisora que lo explica', plazo: '2026-11-30', prioridad: 1,
      notas: 'Ir a la mesa de coordinadoras y preguntar a Lorena Angelini [?] con qué supervisora verlo. Confirmar en la regla de asignación si es solo 1P. Plazo puesto por Claude.' },
    { id: 'w1126-connect-python', titulo: 'Connect: revisar la lógica con Pamela y luego pasar el reporte a Python', plazo: '', prioridad: 2,
      notas: 'Cuando vuelva Pamela. Semanal; el equipo corre los reportes con Python + Jenkins.' },
    // Reunión con Coni (27-nov, ~12:25): panel de folios C&D y marca M20
    { id: 'w1127-revisar-panel', titulo: 'Revisar el panel de Coni en Looker Studio y anotar qué falta', plazo: '2026-11-30', prioridad: 1,
      notas: 'Ya tienes acceso con edición. Comparar con lo pedido por William: N2, N3, tipo de folio, folio, fecha del folio, fecha pactada, área, estado y marca M20.' },
    { id: 'w1127-consulta-m20', titulo: 'Consulta del panel con marca M20 y los campos pedidos', plazo: '2026-11-30', prioridad: 1,
      notas: 'Marca M20 cruzando TB_SEGUIMIENTO_CYD con TB_M20 por caso. Agregar N2 y fecha del folio. Área con regla Servicio Técnico. Sin datos de clientes.' },
    { id: 'w1127-propuesta-scripts', titulo: 'Proponer a Coni las columnas que faltan en sus scripts', plazo: '2026-11-30', prioridad: 1,
      notas: 'Fecha del folio desde el orquestador (RLO_FECHA_LINEA, XO_FECHA_LINEA, RO_DCREACION) y marca M20. No correr sus scripts: escriben en BigQuery con su credencial.' },
    { id: 'w1127-aclarar-campo-m20', titulo: 'Aclarar con Coni qué campo agregar al M20 y quién modifica cada script', plazo: '2026-11-30', prioridad: 2, notas: '' },
    { id: 'w1127-reunion-coni', titulo: 'Reunión con Coni para juntar las tablas del panel (lunes en la tarde)', plazo: '2026-11-30', prioridad: 1, notas: '' },
    { id: 'w1126-metrica-antiguedad', titulo: 'Recibir de Isaac la métrica de antigüedad (script, condiciones, carpetas)', plazo: '', prioridad: 2,
      notas: 'Se calcula los primeros días del mes sobre el mes anterior.' },
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
    { id: 'aj-1119-excel-error-bo-hecho', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-excel-error-bo');
      if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); }
    } },
    // Respuesta de Benjamín (20-nov): el Flujo Offline corresponde con policies rechazadas
    { id: 'aj-1120-offline-policies', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-offline-reporte');
      if (it) it.notas += ' Regla: el reclamo de Flujo Offline corresponde con policies RECHAZADAS; si están aprobadas, el cliente va a la tienda y listo, así que no debería estar en este N3.';
    } },
    // Criterio de Benjamín (20-nov): el diagrama publicado manda
    { id: 'aj-1120-offline-diagrama-manda', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1119-offline-avisos');
      if (it) { it.titulo = 'Avisar a don William lo que no calza con el diagrama del Flujo Offline'; it.notas = 'Manda el diagrama (aprobado y publicado). Errores de otras fuentes: (1) el maestro de asignación permite 1P + N4 Flujo Offline (filas 542 y 547); (2) el procedimiento .docx tiene invertido el paso 1 («entregada → totalizar»); (3) su alcance no dice «solo 3P»; (4) su paso 4 dice «reasignarse» en vez del carril offline; (5) sus plazos BO 5 / LR 10 días no salen en el diagrama.'; }
    } },
    { id: 'aj-1119-pistas', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1118-revisar-pistas');
      if (it) it.notas = 'Excel «(base completa)», hoja Base, columna «Pista en descripción». Ver si el N4 calza con la descripción. Llevar los dudosos a la reunión con Pamela Pizarro para afinar las palabras clave.';
    } },
    // 26-nov: Benjamín aclara que el correo de acceso a BD y la prueba de IA son tareas de Constanza
    { id: 'aj-1126-quitar-coni', fn: () => {
      estado.items = estado.items.filter((i) => !['w1126-correo-acceso-bd', 'w1126-ia-fotos'].includes(i.id));
    } },
    { id: 'aj-1127-panel-contexto', fn: () => {
      const it = estado.items.find((i) => i.id === 'w1126-panel-folios');
      if (it) { it.plazo = '2026-11-30'; it.notas = 'Coni es la responsable. Fuente: TB_SEGUIMIENTO_CYD (tabla de Coni) + marca M20 (TB_M20). Panel en Looker Studio, con acceso de edición. Ver las tareas del 27-nov.'; }
    } },
    // Reunión de equipo 26-nov: cierra tareas anteriores
    { id: 'aj-1126-cierres', fn: () => {
      const cerrar = {
        'w1125-minuta-boleta': 'Enviada (26-nov). William pide la solicitud formal a Mario Torres desde el correo de Benjamín.',
        'w1120-gc-flujo-por-tipo': 'Subido al portal para revalidar (26-nov). Validación: 5 días hábiles.',
        'w1124-rein-base': 'Encargo aclarado el 26-nov: revisión de evidencias en planilla entre tres (ver tarea nueva).',
      };
      Object.entries(cerrar).forEach(([id, nota]) => {
        const it = estado.items.find((i) => i.id === id);
        if (it && !it.lista) { it.lista = true; it.listaEn = Date.now(); it.notas = (it.notas ? it.notas + ' ' : '') + nota; }
      });
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
    elBuscar.placeholder = vista === 'reuniones' ? 'Buscar reuniones' : vista === 'listas' ? 'Buscar en tareas listas' : vista === 'vencidas' ? 'Buscar en vencidas' : 'Buscar tareas';

    if (vista === 'pendientes') renderPendientes();
    else if (vista === 'vencidas') renderVencidas();
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

  const esVencida = (t) => estadoPlazo(t).grupo === 'vencidas';

  // Pestaña Vencidas: solo tareas pendientes cuyo plazo ya pasó (la más atrasada primero).
  function renderVencidas() {
    const todas = estado.items.filter((i) => i.tipo === 'tarea' && !i.lista && esVencida(i));
    const tareas = filtrar(porPrioridad(todas));
    if (!tareas.length) return vacio(todas.length ? '🔍' : '✅', todas.length ? 'No hay vencidas con ese filtro.' : 'No tienes tareas vencidas.');
    const o = estado.prefs.orden;
    let ord = ordenar(tareas);
    let html = '';
    if (o === 'prioridad') {
      for (const p of [1, 2, 3]) {
        const del = ord.filter((t) => t.prioridad === p);
        if (del.length) html += tituloGrupo(PRIO[p].replace(/l$/, 'les').replace(/a$/, 'as'), del.length) + del.map(cardTarea).join('');
      }
    } else {
      html = tituloGrupo('Vencidas', ord.length, 'rojo') + ord.map(cardTarea).join('');
    }
    elLista.innerHTML = html;
  }

  function renderPendientes() {
    const noListas = estado.items.filter((i) => i.tipo === 'tarea' && !i.lista);
    const alDia = noListas.filter((t) => !esVencida(t));
    const nVenc = noListas.length - alDia.length;
    const tareas = filtrar(porPrioridad(alDia));
    const avisoVenc = nVenc ? `<button class="aviso-vencidas" data-accion="ir-vencidas">⚠ Tienes ${nVenc} tarea${nVenc === 1 ? '' : 's'} vencida${nVenc === 1 ? '' : 's'} · Ver</button>` : '';
    if (!tareas.length) {
      vacio(alDia.length ? '🔍' : '🎉', alDia.length ? 'No hay tareas con ese filtro.' : nVenc ? 'No tienes tareas pendientes dentro de plazo.' : '¡Estás al día! Agrega una tarea con el botón ＋.');
      elLista.insertAdjacentHTML('afterbegin', avisoVenc);
      return;
    }
    const ord = ordenar(tareas);
    let html = avisoVenc;
    if (estado.prefs.orden === 'plazo') {
      const grupos = [['hoy', 'Hoy'], ['manana', 'Mañana'], ['semana', 'Próximos 7 días'], ['despues', 'Más adelante'], [undefined, 'Sin plazo']];
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
      html += ord.map(cardTarea).join('');
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
    $('#badgePend').textContent = deHoy || '';
    $('#badgeVenc').textContent = venc || '';
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

  // Cerrar hojas: botón ✕ o tocar fuera. El formulario de tarea/reunión
  // solo se cierra con la ✕ (o al guardar), para no perder lo escrito.
  dlgForm.addEventListener('cancel', (e) => e.preventDefault()); // tecla Esc / botón atrás
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) d.close();
      else if (e.target === d && d !== dlgForm) { const r = d.getBoundingClientRect(); if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) d.close(); }
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
    if (accion === 'ir-vencidas') { estado.prefs.vista = 'vencidas'; guardar(); render(); window.scrollTo({ top: 0 }); return; }
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
