import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  TextChannel,
  Message,
  ChannelType,
  ForumChannel,
} from 'discord.js';

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
      console.log(`Logged in as ${client!.user?.tag}`);
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
async function fetchMessages(
  discordClient: Client,
  channelId: string,
  limit: number,
  startDate?: string,
  endDate?: string,
): Promise<any[]> {
  try {
    console.log(`Fetching messages from channel ${channelId}`);

    // Get the channel
    const channel = (await discordClient.channels.fetch(channelId)) as TextChannel | ForumChannel;
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    // Fetch messages
    console.log(`Fetching up to ${limit} messages...`);

    let messages: Collection<string, Message>;

    // Handle forum channels differently
    if (channel.type === ChannelType.GuildForum) {
      console.log('Fetching forum posts...');
      const threads = await channel.threads.fetch();

      // Fetch messages from each active thread
      const threadMessages = await Promise.all(
        threads.threads.map(async thread => {
          const msgs = await thread.messages.fetch({ limit });
          return msgs;
        }),
      );

      // Combine all messages
      messages = threadMessages.reduce((acc, msgs) => {
        msgs.forEach(msg => acc.set(msg.id, msg));
        return acc;
      }, new Collection<string, Message>());
    } else {
      // Regular channel
      messages = await channel.messages.fetch({ limit });
    }
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

    console.log(`Filtered ${filteredMessages.length} messages`);

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
    channelIds: z.array(z.string()).describe('Array of Discord channel IDs to scrape'),
    limit: z.number().optional().default(100).describe('Maximum number of messages to retrieve'),
    startDate: z.string().optional().describe('Start date for message retrieval (ISO format)'),
    endDate: z.string().optional().describe('End date for message retrieval (ISO format)'),
    timeRange: z.string().optional().describe('Relative time range like "past 24 hours", "past week", "past month"'),
  }),
  execute: async ({ context }) => {
    console.log('Scraping Discord messages...');

    let { channelIds, limit, startDate, endDate, timeRange } = context;

    // Handle relative time ranges
    if (timeRange && (!startDate || !endDate)) {
      const now = new Date();
      const endDateObj = new Date(now);
      let startDateObj = new Date(now);

      // Parse common time ranges
      if (timeRange.includes('hour')) {
        const hours = parseInt(timeRange.match(/\d+/)?.[0] || '24');
        startDateObj.setHours(startDateObj.getHours() - hours);
      } else if (timeRange.includes('day') || timeRange.includes('24 hour')) {
        const days = parseInt(timeRange.match(/\d+/)?.[0] || '1');
        startDateObj.setDate(startDateObj.getDate() - days);
      } else if (timeRange.includes('week')) {
        const weeks = parseInt(timeRange.match(/\d+/)?.[0] || '1');
        startDateObj.setDate(startDateObj.getDate() - weeks * 7);
      } else if (timeRange.includes('month')) {
        const months = parseInt(timeRange.match(/\d+/)?.[0] || '1');
        startDateObj.setMonth(startDateObj.getMonth() - months);
      }

      // Format dates as ISO strings
      startDate = startDateObj.toISOString();
      endDate = endDateObj.toISOString();

      console.log(`Calculated date range from "${timeRange}": ${startDate} to ${endDate}`);
    }

    console.log('Date range: ', startDate, endDate);

    if (!process.env.DISCORD_BOT_TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
    }

    // Get the Discord client
    const discordClient = await getDiscordClient();

    // Use Discord API to fetch messages
    const messagePromises = channelIds.map(channelId =>
      fetchMessages(discordClient, channelId, limit, startDate, endDate),
    );
    const channelMessages = await Promise.all(messagePromises);

    // Combine and sort all messages by timestamp
    const allMessages = channelMessages
      .flat()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return allMessages;
  },
});
