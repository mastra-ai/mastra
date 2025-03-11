import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Client, GatewayIntentBits, Partials, Collection, TextChannel, Message } from 'discord.js';

// Create a Discord client instance
let client: Client | null = null;

// Function to initialize the Discord client
async function getDiscordClient(): Promise<Client> {
  if (client && client.isReady()) {
    console.log('Using existing Discord client');
    return client;
  }

  console.log('Creating new Discord client');
  // Create a new client if one doesn't exist or isn't ready
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message],
  });

  // Log in to Discord
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
  }

  console.log('Logging in to Discord...');
  return new Promise((resolve, reject) => {
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

// Function to fetch messages from a Discord channel
async function fetchMessages(channelId: string, limit: number, startDate?: string, endDate?: string): Promise<any[]> {
  try {
    console.log(`Fetching messages from channel ${channelId}`);

    // Get the Discord client
    const discordClient = await getDiscordClient();

    // Get the channel
    console.log(`Fetching channel ${channelId}...`);
    const channel = (await discordClient.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }
    console.log(`Found channel: ${channel.name}`);

    // Fetch messages
    console.log(`Fetching up to ${limit} messages...`);
    const messages: Collection<string, Message> = await channel.messages.fetch({ limit });
    console.log(`Retrieved ${messages.size} messages`);

    // Convert to our format and apply date filters
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      author: msg.author.username,
      timestamp: msg.createdAt.toISOString(),
      channelId: msg.channelId,
    }));

    // Apply date filters if provided
    let filteredMessages = [...formattedMessages];

    if (startDate) {
      const startTimestamp = new Date(startDate).getTime();
      filteredMessages = filteredMessages.filter(msg => new Date(msg.timestamp).getTime() >= startTimestamp);
    }

    if (endDate) {
      const endTimestamp = new Date(endDate).getTime();
      filteredMessages = filteredMessages.filter(msg => new Date(msg.timestamp).getTime() <= endTimestamp);
    }

    return filteredMessages;
  } catch (error) {
    console.error('Error fetching Discord messages:', error);
    throw error;
  }
}

// Tool for scraping Discord messages
export const discordScraperTool = createTool({
  id: 'discord-scraper-tool',
  description: 'Scrapes messages from a Discord help forum',
  inputSchema: z.object({
    channelId: z.string().describe('The ID of the Discord channel to scrape'),
    limit: z.number().optional().default(100).describe('Maximum number of messages to retrieve'),
    startDate: z.string().optional().describe('Start date for message retrieval (ISO format)'),
    endDate: z.string().optional().describe('End date for message retrieval (ISO format)'),
  }),
  execute: async ({ context }) => {
    console.log('Scraping Discord messages...');
    console.log(context);

    const { channelId, limit, startDate, endDate } = context;

    if (!process.env.DISCORD_BOT_TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
    }

    // Use Discord API to fetch messages
    return await fetchMessages(channelId, limit, startDate, endDate);
  },
});
