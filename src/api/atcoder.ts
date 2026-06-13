import { ContestType } from '../data/store';

const CONTESTS_URL = 'https://kenkoooo.com/atcoder/resources/contests.json';
const SUBMISSIONS_URL = 'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions';
const ATCODER_CONTESTS_PAGE = 'https://atcoder.jp/contests/?lang=ja';
const ATCODER_AWC_ARCHIVE = 'https://atcoder.jp/contests/archive?lang=ja&ratedType=0&category=20&keyword=';

export interface Contest {
  id: string;
  title: string;
  start_epoch_second: number;
  duration_second: number;
  rate_change: string;
}

export interface Submission {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  user_id: string;
  result: string;
}

let contestsCache: Contest[] | null = null;
let contestsCachedAt = 0;
let atcoderPageCache: Contest[] | null = null;
let atcoderPageCachedAt = 0;
let awcArchiveCache: Contest[] | null = null;
let awcArchiveCachedAt = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchContests(): Promise<Contest[]> {
  const now = Date.now();
  if (contestsCache && now - contestsCachedAt < CACHE_TTL_MS) return contestsCache;

  const res = await fetch(CONTESTS_URL);
  if (!res.ok) throw new Error(`コンテスト一覧の取得に失敗しました: ${res.status}`);
  contestsCache = (await res.json()) as Contest[];
  contestsCachedAt = now;
  return contestsCache;
}

export async function fetchRecentContests(): Promise<Contest[]> {
  const [kenkoooo, atcoderPage, awcArchive] = await Promise.all([
    fetchContests(),
    fetchContestsFromAtCoderJp().catch(() => [] as Contest[]),
    fetchAwcArchive().catch(() => [] as Contest[]),
  ]);

  const now = Date.now() / 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60;
  const oneWeekLater = now + 7 * 24 * 60 * 60;

  const merged = new Map<string, Contest>();
  for (const c of kenkoooo) {
    if (c.start_epoch_second >= twoWeeksAgo && c.start_epoch_second <= oneWeekLater)
      merged.set(c.id, c);
  }
  for (const c of [...atcoderPage, ...awcArchive]) {
    if (c.start_epoch_second >= twoWeeksAgo && c.start_epoch_second <= oneWeekLater && !merged.has(c.id))
      merged.set(c.id, c);
  }
  return Array.from(merged.values());
}

async function fetchContestsFromAtCoderJp(): Promise<Contest[]> {
  const now = Date.now();
  if (atcoderPageCache && now - atcoderPageCachedAt < CACHE_TTL_MS) return atcoderPageCache;

  const res = await fetch(ATCODER_CONTESTS_PAGE, { headers: { 'User-Agent': 'atcoder-discord-bot' } });
  if (!res.ok) return atcoderPageCache ?? [];
  const html = await res.text();
  atcoderPageCache = parseContestsHtml(html);
  atcoderPageCachedAt = now;
  return atcoderPageCache;
}

async function fetchAwcArchive(): Promise<Contest[]> {
  const now = Date.now();
  if (awcArchiveCache && now - awcArchiveCachedAt < CACHE_TTL_MS) return awcArchiveCache;

  const res = await fetch(ATCODER_AWC_ARCHIVE, { headers: { 'User-Agent': 'atcoder-discord-bot' } });
  if (!res.ok) return awcArchiveCache ?? [];
  const html = await res.text();
  awcArchiveCache = parseContestsHtml(html);
  awcArchiveCachedAt = now;
  return awcArchiveCache;
}

function parseContestsHtml(html: string): Contest[] {
  const contests: Contest[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  const timeRe = /fixtime-full['"]>([\d-]+ [\d:]+\+\d+)<\/time>/;
  const linkRe = /href="\/contests\/([a-z0-9_-]+)">([^<]+)<\/a>/;
  const durRe = /<td[^>]*>(\d+:\d+)<\/td>/;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];
    const timeMatch = timeRe.exec(row);
    const linkMatch = linkRe.exec(row);
    const durMatch = durRe.exec(row);
    if (!timeMatch || !linkMatch || !durMatch) continue;

    const startEpoch = Math.floor(new Date(timeMatch[1]).getTime() / 1000);
    const [h, min] = durMatch[1].split(':').map(Number);
    contests.push({
      id: linkMatch[1],
      title: linkMatch[2].trim(),
      start_epoch_second: startEpoch,
      duration_second: h * 3600 + min * 60,
      rate_change: '-',
    });
  }
  return contests;
}

export function detectContestType(contest: Contest): ContestType | null {
  const id = contest.id.toLowerCase();
  if (id.startsWith('abc')) return 'ABC';
  if (id.startsWith('arc')) return 'ARC';
  if (id.startsWith('agc')) return 'AGC';
  if (id.startsWith('awc')) return 'AWC';
  if (id.startsWith('ahc')) {
    return contest.duration_second < 86400 ? 'AHC-Short' : 'AHC-Long';
  }
  return null;
}

export async function fetchProblemIds(contestId: string): Promise<string[]> {
  const all = await fetchContests();
  const contest = all.find(c => c.id === contestId);
  if (!contest) return [];

  const res = await fetch(`https://kenkoooo.com/atcoder/resources/contest-problem.json`);
  if (!res.ok) return [];
  const pairs = (await res.json()) as { contest_id: string; problem_id: string }[];
  const problems = pairs
    .filter(p => p.contest_id === contestId)
    .map(p => p.problem_id);

  // problem_id は "abc400_a" のような形式。末尾のアルファベット部分を大文字で返す
  const labels = problems
    .map(pid => {
      const parts = pid.split('_');
      return parts[parts.length - 1].toUpperCase();
    })
    .sort();
  return labels;
}

export async function fetchAcceptedProblems(atcoderId: string, contestId: string, startEpoch: number): Promise<string[]> {
  const submissions = await fetchUserSubmissions(atcoderId, startEpoch);
  if (!submissions) return [];

  const accepted = new Set<string>();
  for (const s of submissions) {
    if (s.contest_id === contestId && s.result === 'AC') {
      const parts = s.problem_id.split('_');
      accepted.add(parts[parts.length - 1].toUpperCase());
    }
  }
  return Array.from(accepted);
}

async function fetchUserSubmissions(atcoderId: string, fromSecond: number): Promise<Submission[] | null> {
  const url = `${SUBMISSIONS_URL}?user=${encodeURIComponent(atcoderId)}&from_second=${fromSecond}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'atcoder-discord-bot' } });
  if (!res.ok) return null;
  return res.json() as Promise<Submission[]>;
}
