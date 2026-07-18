const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore DMs for now
  if (message.channel.type === ChannelType.DM) return;

  // Command: !ping
  if (message.content === '!ping') {
    await message.reply('Pong! 🏓');
  }

  // Command: !hello
  if (message.content === '!hello') {
    await message.reply(`Hello ${message.author}! 👋`);
  }

  // Command: !help
  if (message.content === '!help') {
    await message.reply(
      `**Available Commands:**\n` +
      `\`!ping\` - Replies with Pong\n` +
      `\`!hello\` - Greets you\n` +
      `\`!help\` - Shows this message`
    );
  }
});

client.login(process.env.DISCORD_TOKEN);

