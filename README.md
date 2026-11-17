# Al Día

App web (PWA) para organizar tareas y reuniones del trabajo desde el celular.

- **Tareas** con nombre, plazo ("hasta cuándo"), prioridad (principal, secundaria, terciaria), notas, botón **Aplazar** y control para marcarlas como **listas**.
- Vistas **Pendientes** (agrupadas en vencidas, hoy, mañana, próximos 7 días, más adelante), **Reuniones** y **Listas**.
- Filtro por prioridad, orden por plazo / prioridad / recientes / nombre y búsqueda.
- **Reuniones** con fecha, hora, duración y lugar o link; botón **Agregar a Google Calendar** y descarga `.ics`.
- Deshacer después de cada cambio, editar y eliminar, exportar e importar respaldo `.json`.
- Los datos quedan **solo en el dispositivo** (localStorage). No hay servidor ni cuentas.

## Instalar en el teléfono
- **Android (Chrome):** abre el link → menú ⋮ → *Instalar app* (o *Agregar a pantalla principal*).
- **iPhone (Safari):** abre el link → botón Compartir → *Agregar a pantalla de inicio*.

## Publicar una actualización
1. Edita los archivos.
2. En PowerShell, dentro de esta carpeta: `.\publicar.ps1 "qué cambió"`
   (sube la versión en `sw.js`, hace commit y push).
3. En 1–2 minutos, al abrir la app aparece **"Hay una nueva versión"** → *Actualizar*.

Si no se sube la versión de `sw.js`, los teléfonos siguen con la versión guardada.

## Archivos
`index.html` · `styles.css` · `app.js` · `sw.js` (service worker versionado) · `manifest.webmanifest` · `icons/` · `publicar.ps1`
