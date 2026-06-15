import { createTool } from '@mastra/core/tools';
import { getToken } from '@vercel/connect';
import { z } from 'zod';

/**
 * Vercel Connect connector name for Slack.
 * Create this via: `vercel connect create slack --name <your-connector-name>`
 * Then set VERCEL_CONNECT_SLACK_CONNECTOR in your env.
 */
const slackConnector = process.env.VERCEL_CONNECT_SLACK_CONNECTOR || 'slack/my-slack';

export const slackPostMessage = createTool({
  id: 'slack-post-message',
  description: 'Post a message to a Slack channel using Vercel Connect for authentication',
  inputSchema: z.object({
    channel: z.string().describe('The Slack channel to post to (e.g. #general)'),
    text: z.string().describe('The message text to post'),
  }),
  execute: async ({ channel, text }) => {
    const token = await getToken(slackConnector, {
      subject: { type: 'app' },
      scopes: ['chat:write'],
    });

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
    return { success: true, channel, ts: result.ts };
  },
});

export const slackListChannels = createTool({
  id: 'slack-list-channels',
  description: 'List available Slack channels using Vercel Connect for authentication',
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe('Max channels to return'),
  }),
  execute: async ({ limit }) => {
    const token = await getToken(slackConnector, {
      subject: { type: 'app' },
      scopes: ['channels:read'],
    });

    const response = await fetch(
      `https://slack.com/api/conversations.list?limit=${limit}&types=public_channel`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`);
    }
    return result.channels.map((ch: { id: string; name: string; topic?: { value: string } }) => ({
      id: ch.id,
      name: ch.name,
      topic: ch.topic?.value || '',
    }));
  },
});
