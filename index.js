const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Store queue and player per guild
const queue = new Map();
const players = new Map();

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Ignore DMs
  if (message.channel.type === ChannelType.DM) return;

  const args = message.content.slice(1).split(/ +/);
  const command = args.shift().toLowerCase();

  // Command: !play <song name or URL>
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) {
      return message.reply('❌ Please provide a song name or YouTube URL!');
    }

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) {
      return message.reply('❌ You must be in a voice channel to play music!');
    }

    try {
      await message.reply(`🔍 Searching for: **${query}**...`);

      // Search and get the first result
      let stream;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        stream = await play.stream(query);
      } else {
        const searchResults = await play.search(query, { limit: 1 });
        if (searchResults.length === 0) {
          return message.reply('❌ No results found!');
        }
        stream = await play.stream(searchResults[0].url);
      }

      const guildId = message.guildId;
      if (!queue.has(guildId)) {
        queue.set(guildId, []);
      }

      queue.get(guildId).push({
        stream,
        title: query,
        requestedBy: message.author.username,
      });

      // Join voice channel if not already connected
      if (!players.has(guildId)) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        players.set(guildId, { player, connection });

        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
          queue.get(guildId).shift(); // Remove played song
          if (queue.get(guildId).length > 0) {
            playNextSong(guildId);
          }
        });

        player.on('error', (error) => {
          console.error('Player error:', error);
        });
      }

      // Play if nothing is playing
      if (queue.get(guildId).length === 1) {
        playNextSong(guildId);
        message.reply(`▶️ Now playing: **${query}**`);
      } else {
        message.reply(`⏳ Added to queue: **${query}** (Position: ${queue.get(guildId).length})`);
      }
    } catch (error) {
      console.error('Play error:', error);
      message.reply(`❌ Error playing song: ${error.message}`);
    }
  }

  // Command: !skip
  if (command === 'skip') {
    const guildId = message.guildId;
    if (!players.has(guildId)) {
      return message.reply('❌ No music is playing!');
    }

    const player = players.get(guildId).player;
    player.stop();
    message.reply('⏭️ Skipped to next song!');
  }

  // Command: !stop
  if (command === 'stop') {
    const guildId = message.guildId;
    if (!players.has(guildId)) {
      return message.reply('❌ No music is playing!');
    }

    const player = players.get(guildId).player;
    const connection = players.get(guildId).connection;

    player.stop();
    connection.disconnect();
    queue.delete(guildId);
    players.delete(guildId);

    message.reply('⏹️ Music stopped and bot disconnected!');
  }

  // Command: !queue
  if (command === 'queue') {
    const guildId = message.guildId;
    if (!queue.has(guildId) || queue.get(guildId).length === 0) {
      return message.reply('📭 Queue is empty!');
    }

    const queueList = queue.get(guildId)
      .slice(0, 10)
      .map((song, index) => `${index + 1}. ${song.title} (requested by ${song.requestedBy})`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎵 Music Queue')
      .setDescription(queueList || 'Queue is empty');

    message.reply({ embeds: [embed] });
  }

  // Command: !help
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎵 Music Bot Commands')
      .addFields(
        { name: '!play <song/URL>', value: 'Play a song from YouTube', inline: false },
        { name: '!skip', value: 'Skip to next song', inline: false },
        { name: '!stop', value: 'Stop music and disconnect', inline: false },
        { name: '!queue', value: 'Show current queue', inline: false }
      );

    message.reply({ embeds: [embed] });
  }
});

function playNextSong(guildId) {
  const queueArray = queue.get(guildId);
  if (!queueArray || queueArray.length === 0) return;

  const song = queueArray[0];
  const player = players.get(guildId).player;

  try {
    const resource = createAudioResource(song.stream);
    player.play(resource);
  } catch (error) {
    console.error('Error creating audio resource:', error);
  }
}

client.login(process.env.DISCORD_TOKEN);

