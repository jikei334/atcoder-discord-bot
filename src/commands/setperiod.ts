import {
  ActionRowBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { getConfig, saveConfig } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('setperiod')
  .setDescription('集計期間の開始日を設定します（管理者専用）');

const ADMIN_ROLE_NAME = '管理者';

// 年の選択肢（現在年から前後2年）
function yearOptions() {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1].map(y => ({
    label: `${y}年`,
    value: String(y),
  }));
}

// 月の選択肢
const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: String(i + 1).padStart(2, '0'),
}));

// 日の選択肢（1〜31）
const dayOptions = Array.from({ length: 31 }, (_, i) => ({
  label: `${i + 1}日`,
  value: String(i + 1).padStart(2, '0'),
}));

// ユーザーごとの入力途中状態
const sessions = new Map<string, { year?: string; month?: string }>();

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます。', flags: MessageFlags.Ephemeral });
    return;
  }

  const isAdmin = interaction.member.roles.cache.some(r => r.name === ADMIN_ROLE_NAME);
  if (!isAdmin) {
    await interaction.reply({ content: '「管理者」ロールが必要です。', flags: MessageFlags.Ephemeral });
    return;
  }

  sessions.set(interaction.user.id, {});

  const select = new StringSelectMenuBuilder()
    .setCustomId('setperiod:year')
    .setPlaceholder('年を選択してください')
    .addOptions(yearOptions());

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.reply({ content: '集計開始日の**年**を選択してください：', components: [row], flags: MessageFlags.Ephemeral });
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, step] = interaction.customId.split(':');

  if (step === 'year') {
    const session = sessions.get(interaction.user.id) ?? {};
    session.year = interaction.values[0];
    sessions.set(interaction.user.id, session);

    const select = new StringSelectMenuBuilder()
      .setCustomId('setperiod:month')
      .setPlaceholder('月を選択してください')
      .addOptions(monthOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.update({ content: `${session.year}年 ✅\n集計開始日の**月**を選択してください：`, components: [row] });
    return;
  }

  if (step === 'month') {
    const session = sessions.get(interaction.user.id);
    if (!session?.year) {
      await interaction.update({ content: 'セッションが切れました。もう一度 /setperiod を実行してください。', components: [] });
      return;
    }
    session.month = interaction.values[0];

    const select = new StringSelectMenuBuilder()
      .setCustomId('setperiod:day')
      .setPlaceholder('日を選択してください')
      .addOptions(dayOptions);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.update({ content: `${session.year}年${session.month}月 ✅\n集計開始日の**日**を選択してください：`, components: [row] });
    return;
  }

  if (step === 'day') {
    const session = sessions.get(interaction.user.id);
    if (!session?.year || !session?.month) {
      await interaction.update({ content: 'セッションが切れました。もう一度 /setperiod を実行してください。', components: [] });
      return;
    }

    sessions.delete(interaction.user.id);

    const day = interaction.values[0];
    const dateStr = `${session.year}-${session.month}-${day}`;

    // 日付の妥当性確認
    const date = new Date(`${dateStr}T00:00:00+09:00`);
    if (isNaN(date.getTime()) || date.getDate() !== parseInt(day, 10)) {
      await interaction.update({ content: `「${dateStr}」は存在しない日付です。もう一度 /setperiod を実行してください。`, components: [] });
      return;
    }

    const config = getConfig();
    config.periodStartDate = dateStr;
    saveConfig(config);

    await interaction.update({ content: `集計期間の開始日を **${dateStr}** に設定しました。`, components: [] });
  }
}
