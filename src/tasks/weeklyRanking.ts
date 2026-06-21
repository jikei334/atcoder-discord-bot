import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { getReports, ReportRecord, ContestType } from '../data/store';

export function startWeeklyRankingTask(client: Client): void {
  // 毎週月曜 9:00 JST（UTC 0:00）
  cron.schedule('0 0 * * 1', () => postWeeklyRanking(client), { timezone: 'Asia/Tokyo' });
}

async function postWeeklyRanking(client: Client): Promise<void> {
  const channelId = process.env.RANKING_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !(channel instanceof TextChannel)) return;

  const { start, end } = getLastWeekRange();
  const startDate = start.slice(0, 10);
  const endDate = end.slice(0, 10);
  const reports = (await getReports()).filter(r => {
    const d = r.contestStartDate ?? r.reportedAt.slice(0, 10);
    return d >= startDate && d < endDate;
  });

  if (reports.length === 0) return;

  const ranking = buildRanking(reports);
  if (ranking.length === 0) return;

  const startLabel = start.slice(0, 10).replace(/-/g, '/').replace(/^[0-9]+\//, m => m);
  const endLabel = new Date(new Date(end).getTime() - 1).toISOString().slice(0, 10).replace(/-/g, '/');

  const summaryMessage = await channel.send(`📊 今週のランキング（${formatDate(start)}〜${formatDate(end, -1)}）`);
  const thread = await summaryMessage.startThread({ name: `週次ランキング ${formatDate(start)}〜${formatDate(end, -1)}` });

  const medals = ['🥇', '🥈', '🥉'];
  const lines: string[] = [`📊 **週次ランキング**（${formatDate(start)}〜${formatDate(end, -1)}）`, ''];

  for (const entry of ranking.filter(r => r.rank <= 3)) {
    const medal = medals[entry.rank - 1];
    const breakdown = Object.entries(entry.counts)
      .map(([type, count]) => `${type}×${count}`)
      .join(', ');
    lines.push(`${medal} **${entry.name}**　${breakdown}　計${entry.total}回`);
  }

  await thread.send(lines.join('\n'));
}

function getLastWeekRange(): { start: string; end: string } {
  const now = new Date();
  // 直前の月曜 0:00 JST を起点にする
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const dayOfWeek = jstNow.getUTCDay(); // 月曜=1
  const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const lastMonday = new Date(jstNow);
  lastMonday.setUTCDate(jstNow.getUTCDate() - daysToLastMonday - 7);
  lastMonday.setUTCHours(0, 0, 0, 0);

  const nextMonday = new Date(lastMonday);
  nextMonday.setUTCDate(lastMonday.getUTCDate() + 7);

  // JST の文字列として扱うため UTC 時刻からオフセットを引く
  const toJstIso = (d: Date) => new Date(d.getTime() - jstOffset).toISOString().replace('Z', '+09:00');

  return { start: toJstIso(lastMonday), end: toJstIso(nextMonday) };
}

function formatDate(isoStr: string, offsetDays = 0): string {
  const d = new Date(isoStr);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildRanking(reports: ReportRecord[]) {
  const userMap = new Map<string, { name: string; counts: Partial<Record<ContestType, number>>; total: number }>();
  for (const r of reports) {
    if (!userMap.has(r.discordUserId)) {
      userMap.set(r.discordUserId, { name: r.discordDisplayName, counts: {}, total: 0 });
    }
    const entry = userMap.get(r.discordUserId)!;
    entry.counts[r.contestType] = (entry.counts[r.contestType] ?? 0) + 1;
    entry.total += 1;
  }

  const sorted = [...userMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const result: Array<{ rank: number; name: string; counts: Partial<Record<ContestType, number>>; total: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const [, data] = sorted[i];
    const rank = i === 0 ? 1
      : data.total === sorted[i - 1][1].total ? result[i - 1].rank
      : result[i - 1].rank + 1;
    result.push({ rank, ...data });
  }
  return result;
}
