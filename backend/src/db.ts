import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';

// La ruta del archivo SQLite se resuelve desde backend/.
mkdirSync(resolve('data'), { recursive: true });
export const db = drizzle(process.env.DB_FILE_NAME ?? 'file:./data/football.db');
