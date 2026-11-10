# Checador 🌿

App web sencilla para registrar con tu huella las actividades que haces cada día.

- **Calendario mensual**: cada día muestra cuántas tareas hiciste (verde = todo hecho, amarillo = pendiente, rojo = no hecho).
- **Vista del día**: la fecha arriba y tus tareas abajo, ordenadas por hora.
- **Tareas que se repiten**: elige los días de la semana y, si quieres, una fecha de fin.
- **Registro con huella**: usa WebAuthn (las "llaves de acceso" del teléfono). La primera vez se configura sola.
- **Funciona sin conexión** y se puede instalar en la pantalla de inicio (PWA).
- **Tus datos se quedan en tu dispositivo** (IndexedDB). En Ajustes puedes descargar o restaurar un respaldo.

## Probarla en tu computadora

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Publicarla (para usarla en el celular)

La huella necesita **https**. Lo más fácil es GitHub Pages:

1. En GitHub: *Settings → Pages → Build and deployment → Deploy from a branch*.
2. Elige la rama y la carpeta `/ (root)`, guarda y espera un par de minutos.
3. Abre la dirección en tu celular → menú del navegador → **Agregar a la pantalla de inicio**.

> Si publicas cambios, sube el número de `VERSION` en `sw.js` para que el teléfono descargue la versión nueva.

## Estructura

```
index.html            pantallas y diálogos
css/styles.css        estilos (responsivo, modo claro/oscuro)
js/app.js             lógica de la app
js/db.js              almacenamiento local (IndexedDB)
js/dates.js           utilidades de fechas
js/huella.js          huella digital (WebAuthn)
sw.js                 funcionamiento sin conexión
manifest.webmanifest  datos para instalarla como app
```
