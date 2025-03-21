import { ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';
import { config } from 'dotenv';
import { mastra } from './mastra';
config();

let client: Client | null = null;

async function getDiscordClient(): Promise<Client> {
  if (client && client.isReady()) {
    console.log('Using existing Discord client');
    return client;
  }

  console.log('Creating new Discord client');
  // Create a new client if one doesn't exist or isn't ready
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      //   GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  // Log in to Discord
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
  }

  console.log('Logging in to Discord...');
  return new Promise((resolve, reject) => {
    // Add message listener here, before the 'ready' event
    client!.on('messageCreate', async message => {
      // Ignore messages from bots and non-DM channels
      if (message.author.bot || message.channel.type !== ChannelType.DM) return;

      const agent = await mastra.getAgent('discordMCPBotAgent');
      const { fullStream } = await agent.stream(message.content, {
        maxSteps: 10,
      });

      let messageBuffer = '';
      let filesToSend: string[] = []; // Array to collect file paths

      for await (const part of fullStream) {
        switch (part.type) {
          case 'text-delta':
            messageBuffer += part.textDelta;
            break;
          case 'tool-call':
            console.log('tool call', part.toolName);
            if (part.toolName.includes('mastra_mastra')) {
              const toolName = part.toolName.replace('mastra_mastra', '');
              await message.reply(`Checking ${toolName}. Please wait...`);
            }
            break;
          case 'tool-result':
            console.log('tool result', part.toolName);
            if (part.toolName.includes('codeFileTool')) {
              try {
                const filepath = part.result;
                if (filepath && typeof filepath === 'string') {
                  filesToSend.push(filepath);
                }
              } catch (error) {
                console.error('Error handling tool result:', error);
                await message.reply('Sorry, there was an error processing the code file.');
              }
            }
            console.log('finished tool call');
            break;
          case 'error':
            console.error('Tool error:', part.error);
            await message.reply('Sorry, there was an error executing the tool.');
            break;
          case 'finish':
            // Send all collected files together
            if (filesToSend.length > 0) {
              await message.reply({
                content: 'Here are the code examples:',
                files: filesToSend,
              });
              filesToSend = []; // Clear the array
            }
            break;
        }
        if (messageBuffer.length > 1990) {
          await message.reply(messageBuffer);
          messageBuffer = '';
        }
      }

      if (messageBuffer.length > 0) {
        await message.reply(messageBuffer);
      }
      messageBuffer = '';
    });

    client!.once('ready', () => {
      console.log(`Logged in as ${client!.user!.tag}`);
      resolve(client!);
    });

    client!.once('error', error => {
      console.error('Discord client error:', error);
      reject(error);
    });

    client!.login(token).catch(error => {
      console.error('Discord login error:', error);
      reject(error);
    });
  });
}

async function main() {
  try {
    const discord = await getDiscordClient();
    console.log('Bot is ready!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the bot
main();
