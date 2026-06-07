import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

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
  solvedProblems: string[];
  comment: string;
  reportedAt: string;
}

export type ContestType = 'ABC' | 'ARC' | 'AGC' | 'AHC-Short' | 'AHC-Long' | 'AWC' | 'Other';

export interface ConfigRecord {
  periodStartDate: string | null;
}

type UsersData = Record<string, UserRecord>;

function readJson<T>(filename: string, defaultValue: T): T {
  const filepath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filepath)) return defaultValue;
  const raw = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(raw) as T;
}

function writeJson<T>(filename: string, data: T): void {
  const filepath = path.join(DATA_DIR, filename);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getUsers(): UsersData {
  return readJson<UsersData>('users.json', {});
}

export function saveUsers(users: UsersData): void {
  writeJson('users.json', users);
}

export function getReports(): ReportRecord[] {
  return readJson<ReportRecord[]>('reports.json', []);
}

export function saveReports(reports: ReportRecord[]): void {
  writeJson('reports.json', reports);
}

export function getConfig(): ConfigRecord {
  return readJson<ConfigRecord>('config.json', { periodStartDate: null });
}

export function saveConfig(config: ConfigRecord): void {
  writeJson('config.json', config);
}
