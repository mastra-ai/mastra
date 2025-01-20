import { createTool } from '@mastra/core';
import { z } from 'zod';

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  thread_ts?: string;
}

export const listChannelsTool = createTool({
  id: 'list-slack-channels',
  description: 'List all channels in a Slack workspace',
  inputSchema: z.object({
    token: z.string().describe('Slack Bot User OAuth Token'),
  }),
  outputSchema: z.object({
    channels: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    return await listChannels(context.token);
  },
});

export const getChannelMessagesTool = createTool({
  id: 'get-slack-messages',
  description: 'Get messages from a specific Slack channel',
  inputSchema: z.object({
    token: z.string().describe('Slack Bot User OAuth Token'),
    channelId: z.string().describe('Channel ID to fetch messages from'),
    limit: z.number().optional().describe('Number of messages to fetch (default: 100)'),
  }),
  outputSchema: z.object({
    messages: z.array(
      z.object({
        ts: z.string(),
        text: z.string(),
        user: z.string(),
        originalUrl: z.string().optional(),
      }),
    ),
  }),
  execute: async ({ context }) => {
    return await getChannelMessages(context.token, context.channelId, context.limit);
  },
});

async function listChannels(token: string): Promise<{ channels: SlackChannel[] }> {
  try {
    const response = await fetch('https://slack.com/api/conversations.list', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    return {
      channels: data.channels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
      })),
    };
  } catch (error) {
    console.log(error);
    console.error('Error getting channels from Slack', { token });
    throw error;
  }
}

async function getChannelMessages(
  token: string,
  channelId: string,
  limit: number = 100,
): Promise<{ messages: SlackMessage[] }> {
  try {
    const response = await fetch(`https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }

    const onlyMessages = data.messages.filter((msg: any) => msg.type === 'message');

    return {
      messages: onlyMessages.map((msg: any) => ({
        ts: msg.ts,
        text: msg.text,
        user: msg.user,
        originalUrl: msg?.attachments?.[0]?.original_url,
      })),
    };
  } catch (error) {
    console.log(error);
    console.error('Error getting messages from Slack channel', { channelId, limit });
    throw error;
  }
}
