import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const token = process.env.DISCORD_TOKEN!;
const guildId = process.env.GUILD_ID!;
const clientId = process.env.CLIENT_ID!;

const commands: object[] = [];
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js') || f.endsWith('.ts'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(token);

(async () => {
  console.log(`${commands.length} 個のコマンドを登録中...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('コマンドの登録が完了しました。');
})();
