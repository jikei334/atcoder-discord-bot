import { ChatInputCommandInteraction, Interaction, SlashCommandBuilder } from 'discord.js';
import { getUsers, saveUsers } from '../data/store';

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('AtCoder ID を登録します')
  .addStringOption(option =>
    option.setName('atcoder_id').setDescription('あなたの AtCoder ID').setRequired(true)
  );

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  await _execute(interaction);
}

async function _execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const atcoderId = interaction.options.getString('atcoder_id', true).trim();
  const users = getUsers();

  users[interaction.user.id] = {
    atcoderId,
    discordDisplayName: interaction.user.displayName,
  };
  saveUsers(users);

  await interaction.reply({
    content: `AtCoder ID \`${atcoderId}\` を登録しました。`,
    ephemeral: true,
  });
}
