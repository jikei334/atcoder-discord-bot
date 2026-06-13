import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildTextBasedChannel,
  Interaction,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { fetchRecentContests, fetchProblemIds, fetchAcceptedProblems, detectContestType, Contest } from '../api/atcoder';
import { getUsers, getReports, saveReports, ContestType } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('コンテストへの参加を報告します');

// インタラクション間で状態を保持するための一時ストア（メモリ内）
const sessions = new Map<string, {
  contest: Contest;
  contestType: ContestType;
  problemLabels: string[];
  selected: Set<string>;
}>();

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  let contests: Contest[];
  try {
    contests = await fetchRecentContests();
  } catch {
    await interaction.editReply('コンテスト一覧の取得に失敗しました。時間をおいて再試行してください。');
    return;
  }

  if (contests.length === 0) {
    await interaction.editReply('直近のコンテストが見つかりませんでした。');
    return;
  }

  contests.sort((a, b) => b.start_epoch_second - a.start_epoch_second);
  const options = contests.slice(0, 25).map(c => ({
    label: c.title,
    value: c.id,
    description: new Date(c.start_epoch_second * 1000).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }),
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('report:contest')
    .setPlaceholder('コンテストを選択してください')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  await interaction.editReply({ content: 'コンテストを選択してください：', components: [row] });
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const [, action] = interaction.customId.split(':');
  if (action !== 'contest') return;

  await interaction.deferUpdate();

  const contestId = interaction.values[0];

  let contests: Contest[];
  let problemLabels: string[];
  try {
    [contests, problemLabels] = await Promise.all([
      fetchRecentContests(),
      fetchProblemIds(contestId).catch(() => [] as string[]),
    ]);
  } catch {
    await interaction.editReply({ content: 'コンテスト情報の取得に失敗しました。', components: [] });
    return;
  }

  const contest = contests.find(c => c.id === contestId);
  if (!contest) {
    await interaction.editReply({ content: 'コンテストが見つかりませんでした。', components: [] });
    return;
  }

  const detectedType = detectContestType(contest);
  const contestType: ContestType = detectedType ?? 'Other';

  if (problemLabels.length === 0) {
    problemLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  }

  // AtCoder ID が登録済みなら AC 済み問題を自動チェック
  const users = getUsers();
  const user = users[interaction.user.id];
  let autoChecked = new Set<string>();
  if (user?.atcoderId) {
    try {
      const accepted = await fetchAcceptedProblems(user.atcoderId, contestId, contest.start_epoch_second);
      autoChecked = new Set(accepted);
    } catch (err) {
      console.error(`[report] fetchAcceptedProblems failed:`, err);
    }
  }

  sessions.set(interaction.user.id, { contest, contestType, problemLabels, selected: autoChecked });

  await interaction.editReply(buildProblemSelectionMessage(problemLabels, autoChecked, contest.title));
}

function buildProblemSelectionMessage(
  problemLabels: string[],
  selected: Set<string>,
  contestTitle: string,
) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  // 問題ボタン（1行に最大5個）
  for (let i = 0; i < problemLabels.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const label of problemLabels.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`report:toggle:${label}`)
          .setLabel(label)
          .setStyle(selected.has(label) ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  // 感想 + 送信ボタン行
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('report:comment')
      .setLabel('感想を入力')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('report:submit')
      .setLabel('送信')
      .setStyle(ButtonStyle.Danger),
  );
  rows.push(actionRow);

  const checkedList = problemLabels.filter(l => selected.has(l)).join(', ') || 'なし';
  return {
    content: `**${contestTitle}** に参加した問題を選択してください。\n現在の選択: ${checkedList}`,
    components: rows,
  };
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, param] = interaction.customId.split(':');

  if (action === 'toggle') {
    const session = sessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({ content: 'セッションが切れました。もう一度 /report を実行してください。', ephemeral: true });
      return;
    }
    if (session.selected.has(param)) {
      session.selected.delete(param);
    } else {
      session.selected.add(param);
    }
    await interaction.update(buildProblemSelectionMessage(session.problemLabels, session.selected, session.contest.title));
    return;
  }

  if (action === 'comment') {
    const modal = new ModalBuilder()
      .setCustomId('report:comment_modal')
      .setTitle('一言感想（任意）')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('comment_input')
            .setLabel('感想')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(200)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'submit') {
    await submitReport(interaction, '');
    return;
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const [, action] = interaction.customId.split(':');
  if (action !== 'comment_modal') return;

  const comment = interaction.fields.getTextInputValue('comment_input').trim();
  await submitReport(interaction, comment);
}

async function submitReport(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  comment: string,
): Promise<void> {
  const session = sessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: 'セッションが切れました。もう一度 /report を実行してください。', ephemeral: true });
    return;
  }

  sessions.delete(interaction.user.id);

  const solvedProblems = session.problemLabels.filter(l => session.selected.has(l));
  const displayName = interaction.user.displayName;

  const reports = getReports();
  const existingIndex = reports.findIndex(
    r => r.discordUserId === interaction.user.id && r.contestId === session.contest.id
  );

  const contestStartDate = new Date(session.contest.start_epoch_second * 1000)
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }); // YYYY-MM-DD

  const record = {
    id: existingIndex >= 0 ? reports[existingIndex].id : uuidv4(),
    discordUserId: interaction.user.id,
    discordDisplayName: displayName,
    contestId: session.contest.id,
    contestName: session.contest.title,
    contestType: session.contestType,
    contestStartDate,
    solvedProblems,
    comment,
    reportedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    reports[existingIndex] = record;
  } else {
    reports.push(record);
  }
  saveReports(reports);

  const solvedText = solvedProblems.length > 0
    ? `${solvedProblems.join(', ')}（${solvedProblems.length}完）`
    : 'なし';

  const lines = [
    `🎉 ${displayName} が ${session.contest.title} に参加！`,
    `✅ 解いた問題: ${solvedText}`,
  ];
  if (comment) lines.push(`💬「${comment}」`);

  const publicMessage = lines.join('\n');

  if (interaction.isButton()) {
    await interaction.update({ content: '報告を受け付けました！', components: [] });
  } else {
    await interaction.reply({ content: '報告を受け付けました！', ephemeral: true });
  }

  await (interaction.channel as GuildTextBasedChannel).send(publicMessage);
}
