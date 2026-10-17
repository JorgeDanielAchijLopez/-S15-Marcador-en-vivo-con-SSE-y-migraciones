import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const matches = sqliteTable('matches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  homeTeam: text('home_team').notNull(),
  awayTeam: text('away_team').notNull(),
  status: text('status', { enum: ['PROGRAMADO', 'EN_JUEGO', 'FINALIZADO'] })
    .notNull().default('EN_JUEGO'),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
});

export const matchEvents = sqliteTable('match_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: integer('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute').notNull(),
  type: text('type', { enum: ['GOAL', 'FOUL', 'SUBSTITUTION'] }).notNull(),
  team: text('team', { enum: ['HOME', 'AWAY'] }).notNull(),
  description: text('description').notNull(),
  createdAt: text('created_at').notNull(),
  // Migración 0001: campo nuevo para identificar al jugador.
  player: text('player'),
});

export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
