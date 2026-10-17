# Marcador Live — Fútbol en tiempo real

Proyecto académico **React + TypeScript + Express + SSE + SQLite + Drizzle ORM**.
La vista pública muestra tres partidos de ejemplo y su línea de tiempo; desde Administración se agregan goles, faltas y cambios. Los nuevos eventos llegan a los espectadores por **Server-Sent Events (EventSource)**, sin polling ni recargas manuales.

> Los nombres y marcadores son datos ficticios para demostrar la aplicación. No se consulta una liga real.

## Requisitos previos

- Node.js **20 o superior** y npm.
- Git, para subir el proyecto a GitHub.
- **No necesitas PostgreSQL, Docker ni configurar cuentas externas:** SQLite guarda los datos en `backend/data/football.db`.

## Instalar y ejecutar en Windows (CMD o PowerShell)

**IMPORTANTE:** abre CMD o PowerShell en la carpeta exacta que contiene el archivo raíz `package.json`. Si descomprimiste este ZIP en `C:\Users\achij\Downloads\MarcadorLive-Futbol`, deberías encontrar allí `package.json`, `backend` y `frontend`.

### CMD (Símbolo del sistema)

```bat
cd /d "C:\Users\achij\Downloads\MarcadorLive-Futbol"
dir package.json
copy backend\.env.example backend\.env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Si `backend\.env` ya existe puedes contestar `N` (No) a la pregunta de sobrescritura.

### PowerShell

```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Abre: **http://localhost:5173**. El backend funciona en **http://localhost:3001**. Para detener ambos, pulsa `Ctrl+C`.

**Si npm indica ENOENT**, ejecuta `dir package.json` para comprobar que estás en la carpeta correcta. **Si indica EJSONPARSE**, sustituye el `package.json` raíz por la versión corregida incluida en este paquete (su script `dev` usa comillas escapadas válidas para JSON).

### Scripts

| Comando desde la raíz | Función |
| --- | --- |
| `npm run dev` | Abre API Express y frontend React/Vite. |
| `npm run db:migrate` | Aplica las dos migraciones versionadas de Drizzle Kit. |
| `npm run db:seed` | Crea 3 partidos de demostración. Es idempotente. |
| `npm run db:generate` | Genera una migración a partir de un cambio nuevo en `backend/src/schema.ts`. |
| `npm run typecheck` | Comprueba tipos de backend y frontend. |
| `npm run build` | Valida TypeScript y crea el `frontend/dist`. |

**Orden obligatorio la primera vez:** instalar → migrar → seed → ejecutar. `db:seed` no recrea ni borra datos existentes.

## Estructura

```text
MarcadorLive-Futbol/
├── backend/
│   ├── drizzle/
│   │   ├── 0000_initial.sql       # 1. Partidos + eventos
│   │   ├── 0001_player.sql        # 2. Evolución: jugador opcional
│   │   └── meta/                  # Journal + 2 snapshots Drizzle
│   ├── src/
│   │   ├── schema.ts              # Tablas del ORM
│   │   ├── db.ts                  # Conexión SQLite
│   │   ├── seed.ts                # Tres partidos
│   │   └── index.ts               # API, POST, SSE, validación
│   ├── data/                       # Se crea el archivo SQLite local
│   ├── .env.example               # Variables sin secretos
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Público + administración
│   │   ├── api.ts                 # Consultas HTTP
│   │   ├── types.ts               # Tipos TypeScript
│   │   └── styles.css             # Diseño vino y negro
│   └── vite.config.ts              # Proxy hacia Express
├── .env.example
├── .gitignore
└── README.md
```

## Dos migraciones funcionales

1. `0000_initial.sql` crea `matches` con equipos, estado y marcador; y `match_events` con FK a partidos, minuto, tipo, equipo, descripción y fecha.
2. `0001_player.sql` modifica la tabla de eventos usando `ALTER TABLE` para incorporar la columna `player`, permitiendo guardar el nombre del jugador.

Las dos migraciones se aplican mediante `npm run db:migrate` (**Drizzle Kit**). Los SQL, snapshots y el historial (`_journal.json`) se incluyen en Git. Drizzle administra qué migraciones se aplicaron; no es necesario editar la base manualmente. Para un cambio **posterior**, modifica el esquema en `backend/src/schema.ts` y ejecuta:

```powershell
npm run db:generate
npm run db:migrate
```

No utilices `drizzle-kit push` para reemplazar este flujo: la evaluación necesita **historial versionado**.

## Rutas HTTP y SSE

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/matches` | Lista los partidos. |
| GET | `/api/matches/:id` | Devuelve marcador **y todos los eventos desde SQLite**. |
| POST | `/api/matches/:id/events` | Valida y guarda un evento; actualiza el marcador si es gol. |
| GET | `/api/matches/:id/events/stream?after=0` | Abre SSE solo para ese partido. |
| GET | `/api/health` | Estado básico del servidor. |

Ejemplo de JSON para crear un gol:

```json
{
  "minute": 24,
  "type": "GOAL",
  "team": "HOME",
  "player": "Carlos Pérez",
  "description": "Remate dentro del área tras un pase al centro."
}
```

Para faltas utiliza `"type": "FOUL"`; para cambios, `"type": "SUBSTITUTION"`. Los campos válidos son `minute` entre 0 y 130, `team` HOME/AWAY y `description` entre 3 y 240 caracteres.

### ¿Cómo funciona la actualización en vivo?

1. El navegador usa `fetch(GET /api/matches/:id)` para recuperar el estado persistido.
2. **Después de ese GET**, abre `new EventSource('/api/matches/:id/events/stream?after=<ultimoId>')`.
3. El backend registra la conexión en el grupo de suscriptores del partido elegido.
4. Administración usa **POST**. El servidor valida los datos, inserta el evento en SQLite y actualiza el marcador en una transacción.
5. **Después de confirmar la transacción**, transmite un mensaje SSE `event: match-event` a ese grupo. No se envía al otro partido.
6. El cliente actualiza marcador y cronología sin pedir el estado mediante polling. El evento incluye un `id` persistente y el frontend deduplica por él.
7. Ante una caída, EventSource reconecta; el servidor recibe `Last-Event-ID` y recupera posibles eventos omitidos. Al cambiar de partido, el efecto React cierra la conexión anterior mediante `source.close()`.

El servidor responde `Content-Type: text/event-stream`, envía `retry: 2500` y un comentario de heartbeat cada 15 segundos.

## Prueba real con dos ventanas

1. Ejecuta `npm run dev` y abre dos ventanas en `http://localhost:5173`.
2. En la **ventana A**, selecciona `Municipal vs Comunicaciones` en Vista pública.
3. En la **ventana B**, abre Administración y elige ese mismo partido.
4. Registra un gol (minuto 24, local, descripción con al menos tres caracteres).
5. Comprueba que el marcador sube en A y que el evento aparece en la línea de tiempo **sin recargar**.
6. Recarga la ventana A: marcador y evento deben mantenerse por la base de datos.
7. En A, cambia a `Guatemala vs Costa Rica`: el gol anterior NO debe aparecer.
8. Abre Chrome/Edge DevTools (`F12`) → **Network / Red** → filtro **Fetch/XHR** o **All** → busca `stream` → selecciona `events/stream`. Aparecerá una solicitud pendiente con `content-type: text/event-stream`. En la pestaña **EventStream** (o Response) se observan `ready` y `match-event`. Mantén abierta esa ventana cuando registres otro evento en B.

> Nota: Si ves la solicitud SSE como **Pending**, es correcto; la conexión permanece abierta para recibir actualizaciones. Los navegadores muestran de forma distinta el inspector EventStream.

## Capturas obligatorias para Canvas

Revisa `EVIDENCIAS-CANVAS.md` para el orden de las 6 capturas y el texto que puedes colocar debajo de cada una.

## Publicar en GitHub

```powershell
git init
git add .
git commit -m "feat: marcador de fútbol en vivo con SSE y migraciones Drizzle"
git branch -M main
# Crea un repositorio vacío en GitHub antes de continuar
git remote add origin https://github.com/TU_USUARIO/MarcadorLive-Futbol.git
git push -u origin main
```

Sustituye `TU_USUARIO` y la URL por tu repositorio real. **Nunca subas `.env` ni `backend/data/football.db`**; ya están protegidos por `.gitignore`. Los SQL versionados SÍ se deben subir.

## Comprobación final

- [ ] Vista pública muestra 3 partidos con marcador.
- [ ] La administración crea goles, faltas y cambios.
- [ ] Cada tipo tiene icono y color distinto.
- [ ] Cronología ordenada por minuto y fecha.
- [ ] El `POST` se guarda antes de emitir SSE.
- [ ] SSE exclusivo del partido elegido y reconexión visible.
- [ ] La conexión se cierra al cambiar de partido.
- [ ] Tras `F5`, persisten goles, marcador e historial.
- [ ] Nunca se duplica el mismo ID.
- [ ] Se aplican `0000_initial` y `0001_player`.
- [ ] README, `.env.example` y evidencia en GitHub.

**Alcance:** Es una demostración académica sin autenticación. No expongas la ruta de administración en Internet sin agregar inicio de sesión y autorización.

## Documentación oficial

- [MDN — Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Drizzle — SQLite](https://orm.drizzle.team/docs/get-started/sqlite-new)
- [Drizzle Kit — generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle Kit — migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
