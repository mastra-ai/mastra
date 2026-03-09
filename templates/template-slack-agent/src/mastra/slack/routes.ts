/**
 * Slack events routes for Mastra - supports multiple Slack apps
 */
import { registerApiRoute } from '@mastra/core/server';
import { WebClient } from '@slack/web-api';
import { verifySlackRequest } from './verify';
import { streamToSlack } from './streaming';

interface SlackAppConfig {
  name: string; // Route path: /slack/{name}/events
  botToken: string;
  signingSecret: string;
  agentName: string;
}

/**
 * Factory function to create a Slack events route for a specific app
 */
function createSlackEventsRoute(config: SlackAppConfig) {
  return registerApiRoute(`/slack/${config.name}/events`, {
    method: 'POST',
    handler: async c => {
      try {
        const body = await c.req.text();
        const payload = JSON.parse(body);

        // Handle URL verification challenge
        if (payload.type === 'url_verification') {
          console.log(`✅ [${config.name}] URL verification challenge received`);
          return c.json({ challenge: payload.challenge });
        }

        if (!config.botToken || !config.signingSecret) {
          console.error(`❌ [${config.name}] Missing bot token or signing secret`);
          return c.json({ error: 'Server misconfigured' }, 500);
        }

        // Get Slack signature headers
        const slackSignature = c.req.header('x-slack-signature');
        const slackTimestamp = c.req.header('x-slack-request-timestamp');

        if (!slackSignature || !slackTimestamp) {
          return c.json({ error: 'Missing Slack signature headers' }, 401);
        }

        // Verify the request signature
        const isValid = verifySlackRequest(config.signingSecret, slackSignature, slackTimestamp, body);

        if (!isValid) {
          console.error(`❌ [${config.name}] Invalid Slack signature`);
          return c.json({ error: 'Invalid signature' }, 401);
        }

        // Handle event
        if (payload.event) {
          const event = payload.event;

          // Ignore bot messages and message edits
          if (event.bot_id || event.subtype) {
            return c.json({ ok: true });
          }

          // Handle app mentions and direct messages
          if (event.type === 'app_mention' || event.type === 'message') {
            let messageText = event.text || '';
            const userId = event.user;
            const channelId = event.channel;
            const threadTs = event.thread_ts || event.ts;
            const teamId = payload.team_id;

            console.log(`📨 [${config.name}] Message received:`, {
              agent: config.agentName,
              text: messageText,
              user: userId,
            });

            // Strip out bot mention from message
            messageText = messageText.replace(/<@[A-Z0-9]+>/g, '').trim();

            // Process message asynchronously (don't block Slack's 3s timeout)
            const mastra = c.get('mastra');
            const slackClient = new WebClient(config.botToken);

            (async () => {
              try {
                await streamToSlack({
                  mastra,
                  slackClient,
                  channel: channelId,
                  threadTs,
                  agentName: config.agentName,
                  message: messageText,
                  resourceId: `slack-${teamId}-${userId}`,
                  threadId: `slack-${channelId}-${threadTs}`,
                });
              } catch (error) {
                console.error(`❌ [${config.name}] Error processing message:`, error);
                // streamToSlack already posts errors to Slack, so we just log here
              }
            })();
          }
        }

        return c.json({ ok: true });
      } catch (error) {
        console.error(`Error handling Slack event [${config.name}]:`, error);
        return c.json({ error: 'Failed to handle event' }, 500);
      }
    },
  });
}

// Define your Slack apps - each with its own credentials and agent
const slackApps: SlackAppConfig[] = [
  {
    name: 'reverse',
    botToken: process.env.SLACK_REVERSE_BOT_TOKEN!,
    signingSecret: process.env.SLACK_REVERSE_SIGNING_SECRET!,
    agentName: 'reverseAgent',
  },
  {
    name: 'caps',
    botToken: process.env.SLACK_CAPS_BOT_TOKEN!,
    signingSecret: process.env.SLACK_CAPS_SIGNING_SECRET!,
    agentName: 'capsAgent',
  },
];

// Generate routes for all configured apps
export const slackRoutes = slackApps.map(createSlackEventsRoute);
