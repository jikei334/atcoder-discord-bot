import { ChatInputCommandInteraction, Interaction, SlashCommandBuilder } from 'discord.js';
import { setUser } from '../data/store';

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
  await setUser(interaction.user.id, {
    atcoderId,
    discordDisplayName: interaction.user.displayName,
  });

  await interaction.reply({
    content: `AtCoder ID \`${atcoderId}\` を登録しました。`,
    ephemeral: true,
  });
}
