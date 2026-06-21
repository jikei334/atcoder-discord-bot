import { getPool } from './db';

export interface UserRecord {
  atcoderId: string;
  discordDisplayName: string;
}

export interface ReportRecord {
  id: string;
  discordUserId: string;
  discordDisplayName: string;
  contestId: string;
  contestName: string;
  contestType: ContestType;
  contestStartDate: string; // YYYY-MM-DD（JST）
  solvedProblems: string[];
  comment: string;
  reportedAt: string;
}

export type ContestType = 'ABC' | 'ARC' | 'AGC' | 'AHC-Short' | 'AHC-Long' | 'AWC' | 'Other';

export interface ConfigRecord {
  periodStartDate: string | null;
}

type UsersData = Record<string, UserRecord>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToReport(row: any): ReportRecord {
  return {
    id: row.id,
    discordUserId: row.discord_user_id,
    discordDisplayName: row.discord_display_name,
    contestId: row.contest_id,
    contestName: row.contest_name,
    contestType: row.contest_type as ContestType,
    contestStartDate: row.contest_start_date,
    solvedProblems: row.solved_problems as string[],
    comment: row.comment,
    reportedAt: row.reported_at,
  };
}

export async function getUsers(): Promise<UsersData> {
  const db = getPool();
  const { rows } = await db.query('SELECT discord_user_id, atcoder_id, discord_display_name FROM users');
  const result: UsersData = {};
  for (const row of rows) {
    result[row.discord_user_id] = {
      atcoderId: row.atcoder_id,
      discordDisplayName: row.discord_display_name,
    };
  }
  return result;
}

export async function getUser(discordUserId: string): Promise<UserRecord | null> {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT atcoder_id, discord_display_name FROM users WHERE discord_user_id = $1',
    [discordUserId],
  );
  if (rows.length === 0) return null;
  return { atcoderId: rows[0].atcoder_id, discordDisplayName: rows[0].discord_display_name };
}

export async function setUser(discordUserId: string, record: UserRecord): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO users (discord_user_id, atcoder_id, discord_display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (discord_user_id) DO UPDATE SET atcoder_id = $2, discord_display_name = $3`,
    [discordUserId, record.atcoderId, record.discordDisplayName],
  );
}

export async function getReports(): Promise<ReportRecord[]> {
  const db = getPool();
  const { rows } = await db.query('SELECT * FROM reports ORDER BY reported_at DESC');
  return rows.map(rowToReport);
}

export async function findReport(discordUserId: string, contestId: string): Promise<ReportRecord | null> {
  const db = getPool();
  const { rows } = await db.query(
    'SELECT * FROM reports WHERE discord_user_id = $1 AND contest_id = $2',
    [discordUserId, contestId],
  );
  if (rows.length === 0) return null;
  return rowToReport(rows[0]);
}

export async function upsertReport(record: ReportRecord): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO reports (
       id, discord_user_id, discord_display_name, contest_id, contest_name,
       contest_type, contest_start_date, solved_problems, comment, reported_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (discord_user_id, contest_id) DO UPDATE SET
       id = $1,
       discord_display_name = $3,
       contest_name = $5,
       contest_type = $6,
       contest_start_date = $7,
       solved_problems = $8,
       comment = $9,
       reported_at = $10`,
    [
      record.id,
      record.discordUserId,
      record.discordDisplayName,
      record.contestId,
      record.contestName,
      record.contestType,
      record.contestStartDate,
      record.solvedProblems,
      record.comment,
      record.reportedAt,
    ],
  );
}

export async function getConfig(): Promise<ConfigRecord> {
  const db = getPool();
  const { rows } = await db.query("SELECT value FROM config WHERE key = 'periodStartDate'");
  return { periodStartDate: rows.length > 0 ? rows[0].value : null };
}

export async function saveConfig(config: ConfigRecord): Promise<void> {
  const db = getPool();
  await db.query(
    `INSERT INTO config (key, value) VALUES ('periodStartDate', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [config.periodStartDate],
  );
}
