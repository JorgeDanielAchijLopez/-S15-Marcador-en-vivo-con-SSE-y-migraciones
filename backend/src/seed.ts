import { db } from './db.js';
import { matches } from './schema.js';

async function seed() {
  const existing = await db.select().from(matches);
  if (existing.length > 0) {
    console.log(`Base de datos lista: ya hay ${existing.length} partidos. No se duplicó nada.`);
    return;
  }
  await db.insert(matches).values([
    { homeTeam: 'Municipal', awayTeam: 'Comunicaciones', status: 'EN_JUEGO' },
    { homeTeam: 'Guatemala', awayTeam: 'Costa Rica', status: 'EN_JUEGO' },
    { homeTeam: 'Barcelona', awayTeam: 'Real Madrid', status: 'EN_JUEGO' },
  ]);
  console.log('3 partidos de demostración registrados correctamente.');
}

seed().catch((error: unknown) => {
  console.error('Primero ejecuta: npm run db:migrate', error);
  process.exitCode = 1;
});
