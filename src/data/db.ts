import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function initDb(): Promise<void> {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      discord_user_id TEXT PRIMARY KEY,
      atcoder_id TEXT NOT NULL,
      discord_display_name TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      discord_user_id TEXT NOT NULL,
      discord_display_name TEXT NOT NULL,
      contest_id TEXT NOT NULL,
      contest_name TEXT NOT NULL,
      contest_type TEXT NOT NULL,
      contest_start_date TEXT NOT NULL,
      solved_problems TEXT[] NOT NULL DEFAULT '{}',
      comment TEXT NOT NULL DEFAULT '',
      reported_at TEXT NOT NULL,
      UNIQUE(discord_user_id, contest_id)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}
