import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Interaction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('mypage')
  .setDescription('参加記録の確認・追加ができる個人ページを開きます');

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const url = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

  const button = new ButtonBuilder()
    .setLabel('📊 参加記録を開く')
    .setStyle(ButtonStyle.Link)
    .setURL(url);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.reply({
    content: '以下のボタンから参加記録ページにアクセスできます。',
    components: [row],
    ephemeral: true,
  });
}
