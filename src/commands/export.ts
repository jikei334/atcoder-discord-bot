import { AttachmentBuilder, ChatInputCommandInteraction, Interaction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getReports, ContestType } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('export')
  .setDescription('参加データを CSV でエクスポートします');

const CONTEST_TYPES: ContestType[] = ['ABC', 'ARC', 'AGC', 'AHC-Short', 'AHC-Long', 'AWC', 'Other'];

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction);
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reports = await getReports();

  // ユーザーごとに種別ごとの参加数を集計
  const userMap = new Map<string, { name: string; counts: Partial<Record<ContestType, number>> }>();
  for (const r of reports) {
    if (!userMap.has(r.discordUserId)) {
      userMap.set(r.discordUserId, { name: r.discordDisplayName, counts: {} });
    }
    const entry = userMap.get(r.discordUserId)!;
    entry.counts[r.contestType] = (entry.counts[r.contestType] ?? 0) + 1;
  }

  const header = ['Discord名', ...CONTEST_TYPES, '合計'].join(',');
  const rows = [...userMap.values()].map(({ name, counts }) => {
    const typeCounts = CONTEST_TYPES.map(t => counts[t] ?? 0);
    const total = typeCounts.reduce((a, b) => a + b, 0);
    return [escapeCsv(name), ...typeCounts, total].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const buffer = Buffer.from('﻿' + csv, 'utf-8'); // BOM付きUTF-8（Excelで文字化けしないよう）

  const attachment = new AttachmentBuilder(buffer, { name: 'atcoder_report.csv' });
  await interaction.editReply({ content: '参加データをエクスポートしました。', files: [attachment] });
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
