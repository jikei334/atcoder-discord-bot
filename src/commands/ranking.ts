import { ChatInputCommandInteraction, Interaction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getReports, getConfig, ReportRecord, ContestType } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('ranking')
  .setDescription('参加回数ランキングを表示します');

type Category = 'algo' | 'abc' | 'heuristic';

const ALGO_TYPES: ContestType[] = ['ABC', 'ARC', 'AGC', 'AWC', 'Other'];
const HEURISTIC_TYPES: ContestType[] = ['AHC-Short', 'AHC-Long'];

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction);
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const [config, reports] = await Promise.all([getConfig(), getReports()]);

  const filtered = config.periodStartDate
    ? reports.filter(r => (r.contestStartDate ?? r.reportedAt.slice(0, 10)) >= config.periodStartDate!)
    : reports;

  const periodLabel = config.periodStartDate
    ? `${config.periodStartDate} 〜 現在`
    : '全期間';

  const lines: string[] = [`📊 **参加回数ランキング**（${periodLabel}）`];

  lines.push('');
  lines.push(...buildCategorySection('🧮 アルゴリズム全体', filtered, r => ALGO_TYPES.includes(r.contestType), interaction.user.id));
  lines.push('');
  lines.push(...buildCategorySection('🔵 ABC のみ', filtered, r => r.contestType === 'ABC', interaction.user.id));
  lines.push('');
  lines.push(...buildCategorySection('🟡 ヒューリスティック', filtered, r => HEURISTIC_TYPES.includes(r.contestType), interaction.user.id));

  await interaction.editReply(lines.join('\n'));
}

function buildCategorySection(
  title: string,
  reports: ReportRecord[],
  filter: (r: ReportRecord) => boolean,
  requesterId: string,
): string[] {
  const target = reports.filter(filter);

  // ユーザーごとの集計
  const userMap = new Map<string, { name: string; counts: Partial<Record<ContestType, number>>; total: number }>();
  for (const r of target) {
    if (!userMap.has(r.discordUserId)) {
      userMap.set(r.discordUserId, { name: r.discordDisplayName, counts: {}, total: 0 });
    }
    const entry = userMap.get(r.discordUserId)!;
    entry.counts[r.contestType] = (entry.counts[r.contestType] ?? 0) + 1;
    entry.total += 1;
  }

  const sorted = [...userMap.entries()].sort((a, b) => b[1].total - a[1].total);
  const ranking: Array<{ id: string; rank: number; name: string; counts: Partial<Record<ContestType, number>>; total: number }> = [];
  for (let i = 0; i < sorted.length; i++) {
    const [id, data] = sorted[i];
    const rank = i === 0 ? 1
      : data.total === sorted[i - 1][1].total ? ranking[i - 1].rank
      : ranking[i - 1].rank + 1;
    ranking.push({ id, rank, ...data });
  }

  const lines: string[] = [`**${title}**`];

  if (ranking.length === 0) {
    lines.push('　参加者がいません');
    return lines;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const topEntries = ranking.filter(r => r.rank <= 3);
  const self = ranking.find(r => r.id === requesterId);
  const selfInTop = topEntries.some(r => r.id === requesterId);

  const toShow = selfInTop || !self ? topEntries : [...topEntries, self];

  for (const entry of toShow) {
    const medal = entry.rank <= 3 ? medals[entry.rank - 1] : `${entry.rank}位`;
    const breakdown = Object.entries(entry.counts)
      .map(([type, count]) => `${type}×${count}`)
      .join(', ');
    lines.push(`${medal} **${entry.name}**　${breakdown}　計${entry.total}回`);
  }

  return lines;
}
