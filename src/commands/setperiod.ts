import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  Interaction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { saveConfig } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('setperiod')
  .setDescription('集計期間の開始日を設定します（管理者専用）');

const ADMIN_ROLE_NAME = '管理者';

function yearOptions() {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1].map(y => ({
    label: `${y}年`,
    value: String(y),
  }));
}

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: String(i + 1).padStart(2, '0'),
}));

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const sessions = new Map<string, { year?: string; month?: string }>();

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
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

    const lastDay = getDaysInMonth(parseInt(session.year, 10), parseInt(session.month, 10));
    const modal = new ModalBuilder()
      .setCustomId('setperiod:day_modal')
      .setTitle('集計開始日の設定')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('day_input')
            .setLabel(`日（1〜${lastDay}）`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(2)
            .setPlaceholder(`1〜${lastDay}`)
        )
      );
    await interaction.showModal(modal);
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const [, action] = interaction.customId.split(':');
  if (action !== 'day_modal') return;

  const session = sessions.get(interaction.user.id);
  if (!session?.year || !session?.month) {
    await interaction.reply({ content: 'セッションが切れました。もう一度 /setperiod を実行してください。', ephemeral: true });
    return;
  }

  sessions.delete(interaction.user.id);

  const dayInput = interaction.fields.getTextInputValue('day_input').trim();
  const dayNum = parseInt(dayInput, 10);
  const lastDay = getDaysInMonth(parseInt(session.year, 10), parseInt(session.month, 10));

  if (isNaN(dayNum) || dayNum < 1 || dayNum > lastDay) {
    await interaction.reply({ content: `「${dayInput}」は無効な日付です。1〜${lastDay} の数字を入力してください。`, ephemeral: true });
    return;
  }

  const day = String(dayNum).padStart(2, '0');
  const dateStr = `${session.year}-${session.month}-${day}`;

  await saveConfig({ periodStartDate: dateStr });

  if (interaction.isFromMessage()) {
    await interaction.update({ content: `集計期間の開始日を **${dateStr}** に設定しました。`, components: [] });
  } else {
    await interaction.reply({ content: `集計期間の開始日を **${dateStr}** に設定しました。`, flags: MessageFlags.Ephemeral });
  }
}
