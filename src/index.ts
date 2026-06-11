import { Client, GatewayIntentBits, Interaction, Collection } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { startWeeklyRankingTask } from './tasks/weeklyRanking';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = new Collection<string, { data: { name: string }; execute: (interaction: Interaction) => Promise<void> }>();

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  commands.set(command.data.name, command);
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user?.tag}`);
  startWeeklyRankingTask(client);
});

client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'エラーが発生しました。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
      }
    }
  } else if (interaction.isStringSelectMenu() || interaction.isButton()) {
    const [commandName] = interaction.customId.split(':');
    const command = commands.get(commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'エラーが発生しました。', ephemeral: true });
      } else {
        await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
