import { Interaction, MessageFlags, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Bot の使い方を表示します');

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const content = [
    '## AtCoder Bot の使い方',
    '',
    '### `/register <atcoder_id>`',
    'AtCoder ID を登録します。登録しておくと `/report` でコンテストの解答状況が自動補完されます。',
    '',
    '### `/report`',
    'コンテスト参加を報告します。',
    '1. 直近のコンテスト一覧から参加したものを選択',
    '2. 解いた問題をボタンで選択（登録済みなら AC 済みを自動チェック）',
    '3. 必要なら「感想を入力」で一言追加',
    '4. 「送信」でチャンネルに投稿',
    '> 同じコンテストに再報告すると上書きされます。',
    '',
    '### `/ranking`',
    '集計期間内の参加回数ランキングを表示します（自分にだけ見えます）。',
    '- アルゴリズム全体・ABC のみ・ヒューリスティックの 3 カテゴリを表示',
    '- 上位 3 人 ＋ 自分の順位を表示',
    '',
    '### `/export`',
    '参加データを CSV ファイルでダウンロードします。',
    '',
    '### `/setperiod`（管理者専用）',
    '集計期間の開始日を設定します。「管理者」ロールが必要です。',
  ].join('\n');

  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}
