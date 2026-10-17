# Evidencias 

Saca estas **6 capturas reales** luego de ejecutar el sistema. Debajo de cada imagen puedes copiar su descripción. No inventes imágenes ni reemplaces las capturas por ilustraciones.

## Captura 1 — Vista pública con partidos

**Qué fotografiar:** Navegador completo en `http://localhost:5173`, pestaña Vista pública, tres tarjetas de partidos visibles.

**Descripción:** «Vista pública del sistema Marcador Live. Se visualizan tres partidos con sus equipos, estado y marcador almacenado.»

## Captura 2 — Administración y registro de eventos

**Qué fotografiar:** Pestaña Administración, mismo partido seleccionado, un gol ya publicado; deja visibles el formulario y la cronología.

**Descripción:** «Formulario administrativo validado que permite registrar goles, faltas y cambios mediante POST y actualiza la línea de tiempo.»

## Captura 3 — SSE y EventSource

**Qué fotografiar:** Abre `F12` → Network → `stream` → `events/stream`, verifica status 200 y `Content-Type: text/event-stream`. En otra ventana publica un evento y verifica en DevTools `EventStream` o `Response` que llegó `match-event` con `id`.

**Descripción:** «Conexión SSE activa y evento recibido mediante EventSource sin polling. El canal corresponde únicamente al partido seleccionado.»

## Captura 4 — Migraciones

**Qué fotografiar:** VS Code mostrando `backend/drizzle/0000_initial.sql`, `0001_player.sql`, `meta` y la terminal tras `npm run db:migrate` sin errores. Puedes unir dos capturas si no caben bien.

**Descripción:** «Dos migraciones versionadas Drizzle: creación inicial de tablas y evolución posterior para agregar el campo del jugador, aplicadas correctamente a SQLite.»

## Captura 5 — Persistencia tras recarga

**Qué fotografiar:** Registra gol, presiona F5 en vista pública y captura marcador junto con el evento que permanece visible.

**Descripción:** «El marcador y la cronología se reconstruyen desde SQLite tras recargar el navegador; los datos no dependen únicamente del estado React.»

## Captura 6 — Aislamiento entre partidos

**Qué fotografiar:** Primero muestra un gol de Municipal vs Comunicaciones y luego cambia a Guatemala vs Costa Rica, sin que aparezca el gol anterior. Puedes presentar ambas imágenes juntas.

**Descripción:** «El sistema separa eventos por identificador del partido; el SSE del primer encuentro no modifica la línea de tiempo ni el marcador del segundo.»

## Texto breve de Canvas

**Proyecto:** Marcador Live — aplicación web de fútbol en vivo desarrollada con TypeScript, React, Express, SQLite y Drizzle ORM. Implementa SSE mediante EventSource, persistencia y dos migraciones versionadas.


**Evidencias:** Se adjuntan capturas de la vista pública, administración, conexión SSE, migraciones, persistencia y aislamiento entre partidos.
