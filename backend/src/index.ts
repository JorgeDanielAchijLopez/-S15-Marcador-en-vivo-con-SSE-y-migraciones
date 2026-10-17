import 'dotenv/config';
import cors from 'cors';
import express, { type Response } from 'express';
import { and, asc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db.js';
import { matchEvents, matches, type Match, type MatchEvent } from './schema.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '16kb' }));
app.disable('x-powered-by');

const subscribers = new Map<number, Set<Response>>();
const createEventSchema = z.object({
  type: z.enum(['GOAL', 'FOUL', 'SUBSTITUTION']),
  team: z.enum(['HOME', 'AWAY']),
  minute: z.coerce.number().int().min(0).max(130),
  player: z.string().trim().max(70).optional(),
  description: z.string().trim().min(3).max(240),
});

type Update = { match: Match; event: MatchEvent };

function parseMatchId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function findMatch(id: number) {
  const [match] = await db.select().from(matches).where(eq(matches.id, id));
  return match ?? null;
}

async function listMatchEvents(id: number) {
  return db.select().from(matchEvents)
    .where(eq(matchEvents.matchId, id))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.createdAt), asc(matchEvents.id));
}

function writeEvent(res: Response, payload: Update) {
  res.write(`id: ${payload.event.id}\n`);
  res.write('event: match-event\n');
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function notifyMatch(id: number, update: Update) {
  // AISLAMIENTO: solo reciben el evento quienes están suscritos a este partido.
  for (const res of subscribers.get(id) ?? []) {
    writeEvent(res, update);
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Marcador Live' }));

app.get('/api/matches', async (_req, res) => {
  try {
    res.json(await db.select().from(matches).orderBy(asc(matches.id)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron obtener los partidos.' });
  }
});

app.get('/api/matches/:id', async (req, res) => {
  const id = parseMatchId(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido.' }); return; }
  try {
    const match = await findMatch(id);
    if (!match) { res.status(404).json({ error: 'Partido no encontrado.' }); return; }
    res.json({ match, events: await listMatchEvents(id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo cargar el partido.' });
  }
});

app.post('/api/matches/:id/events', async (req, res) => {
  const id = parseMatchId(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido.' }); return; }
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Revisa el formulario.', details: parsed.error.flatten() });
    return;
  }
  try {
    const match = await findMatch(id);
    if (!match) { res.status(404).json({ error: 'Partido no encontrado.' }); return; }
    if (match.status === 'FINALIZADO') {
      res.status(409).json({ error: 'No puedes registrar eventos en un partido finalizado.' });
      return;
    }
    const value = parsed.data;
    // El evento y el marcador se escriben JUNTOS antes de emitir por SSE.
    const update = await db.transaction(async (tx) => {
      const [event] = await tx.insert(matchEvents).values({
        matchId: id,
        minute: value.minute,
        type: value.type,
        team: value.team,
        player: value.player || null,
        description: value.description,
        createdAt: new Date().toISOString(),
      }).returning();
      if (!event) throw new Error('No se pudo guardar el evento.');
      if (value.type === 'GOAL') {
        const [latest] = await tx.select().from(matches).where(eq(matches.id, id));
        if (!latest) throw new Error('Partido inexistente.');
        await tx.update(matches).set({
          homeScore: latest.homeScore + (value.team === 'HOME' ? 1 : 0),
          awayScore: latest.awayScore + (value.team === 'AWAY' ? 1 : 0),
        }).where(eq(matches.id, id));
      }
      const [updatedMatch] = await tx.select().from(matches).where(eq(matches.id, id));
      if (!updatedMatch) throw new Error('No se encontró el partido actualizado.');
      return { match: updatedMatch, event };
    });
    notifyMatch(id, update);
    res.status(201).json(update);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo guardar el evento.' });
  }
});

app.get('/api/matches/:id/events/stream', async (req, res) => {
  const id = parseMatchId(req.params.id);
  if (!id) { res.status(400).json({ error: 'ID inválido.' }); return; }
  try {
    const match = await findMatch(id);
    if (!match) { res.status(404).json({ error: 'Partido no encontrado.' }); return; }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 2500\n');
    res.write('event: ready\n');
    res.write('data: {"connected":true}\n\n');

    if (!subscribers.has(id)) subscribers.set(id, new Set());
    subscribers.get(id)!.add(res);

    // Registrar limpieza en cuanto se abre el canal, incluso si el cliente
    // cierra la pestaña durante el replay asincrónico.
    const heartbeat = setInterval(() => {
      if (!res.writableEnded && !res.destroyed) res.write(': heartbeat\n\n');
    }, 15000);
    res.on('close', () => {
      clearInterval(heartbeat);
      const group = subscribers.get(id);
      group?.delete(res);
      if (group?.size === 0) subscribers.delete(id);
    });

    // Catch-up para el intervalo GET -> EventSource y para reconexiones.
    // El navegador envía Last-Event-ID automáticamente al reconectar.
    const fromQuery = Number(req.query.after ?? 0);
    const fromHeader = Number(req.header('last-event-id') ?? 0);
    const since = Math.max(
      Number.isSafeInteger(fromQuery) && fromQuery >= 0 ? fromQuery : 0,
      Number.isSafeInteger(fromHeader) && fromHeader >= 0 ? fromHeader : 0,
    );
    // Se registra la suscripción ANTES del replay. Si un evento coincide
    // con el replay, el cliente lo deduplica mediante su ID persistente.
    const missed = await db.select().from(matchEvents).where(
      and(eq(matchEvents.matchId, id), gt(matchEvents.id, since)),
    ).orderBy(asc(matchEvents.id));
    const currentMatch = await findMatch(id);
    if (currentMatch && !res.destroyed) {
      for (const event of missed) writeEvent(res, { match: currentMatch, event });
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'No se pudo abrir SSE.' });
    else res.end();
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Marcador Live API: http://localhost:${port}`);
  console.log(`SSE: http://localhost:${port}/api/matches/1/events/stream`);
});
