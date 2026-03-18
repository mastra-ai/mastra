import { MastraChannel } from '@mastra/core/channels';
import type { ChannelEvent, ChannelSendParams, ChannelSendResult } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import { parseSlackEvent } from './events';
import type { SlackChannelConfig, SlackEventPayload, SlackPostMessageResponse } from './types';
import { verifySlackRequest } from './verify';

export class SlackChannel extends MastraChannel {
  readonly platform = 'slack';

  #signingSecret: string;
  #botToken: string;

  constructor(config: SlackChannelConfig) {
    super({ name: 'slack', routes: config.routes });
    this.#signingSecret = config.signingSecret;
    this.#botToken = config.botToken;
  }

  async verifyWebhook(request: Request): Promise<boolean> {
    const { verified } = await verifySlackRequest(request, this.#signingSecret);
    return verified;
  }

  async parseWebhookEvent(request: Request): Promise<ChannelEvent> {
    const body = await request.text();
    const payload: SlackEventPayload = JSON.parse(body);
    const event = parseSlackEvent(payload);
    if (!event) {
      throw new Error('Failed to parse Slack event');
    }
    return event;
  }

  async send({ channelId, threadId, content }: ChannelSendParams): Promise<ChannelSendResult> {
    const body: Record<string, unknown> = {
      channel: channelId,
      text: content.text,
    };

    if (threadId) {
      body.thread_ts = threadId;
    }

    if (content.blocks) {
      body.blocks = content.blocks;
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.#botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });

    const result = (await response.json()) as SlackPostMessageResponse;

    return {
      ok: result.ok,
      externalMessageId: result.ts,
      error: result.error,
    };
  }

  getWebhookRoutes(): ApiRoute[] {
    const channel = this;
    return [
      {
        path: '/channels/slack/webhook',
        method: 'POST',
        requiresAuth: false,
        createHandler: async ({ mastra }: { mastra: Mastra }) => {
          return async (c: Context) => {
            // 1. Read body once, use for both verification and parsing
            const rawBody = await c.req.raw.clone().text();
            const { verified, body } = await verifySlackRequest(c.req.raw, channel.#signingSecret);

            if (!verified) {
              return c.json({ error: 'Invalid signature' }, 401);
            }

            const payload: SlackEventPayload = JSON.parse(body || rawBody);

            // 2. Handle Slack URL verification challenge
            if (payload.type === 'url_verification') {
              return c.json({ challenge: payload.challenge });
            }

            // 3. Parse the event
            const event = parseSlackEvent(payload);
            if (!event) {
              return c.json({ error: 'Unrecognized event' }, 400);
            }

            // Ignore bot messages to prevent loops
            if (payload.event?.bot_id || payload.event?.subtype === 'bot_message') {
              return c.json({ ok: true });
            }

            // 4. Resolve which agent handles this event
            const agentName = channel.resolveAgentForEvent(event.type);
            if (!agentName) {
              channel.logger.debug(`No agent configured for event type: ${event.type}`);
              return c.json({ ok: true });
            }

            const agent = mastra.getAgent(agentName);

            // 5. Resolve or create the Mastra thread
            const slackThreadId = event.externalThreadId;
            const thread = await channel.getOrCreateThread({
              externalThreadId: slackThreadId,
              channelId: event.externalChannelId,
              resourceId: event.userId,
              mastra,
            });

            // 6. Run the agent with thread context
            const result = await agent.generate(event.text || '', {
              memory: {
                thread: thread,
                resource: event.userId,
              },
            });

            // 7. Send the response back to Slack
            if (result.text) {
              await channel.send({
                channelId: event.externalChannelId,
                threadId: slackThreadId,
                content: { text: result.text },
              });
            }

            return c.json({ ok: true });
          };
        },
      },
    ];
  }
}

export type { SlackChannelConfig, SlackEvent, SlackEventPayload } from './types';
export { verifySlackRequest } from './verify';
export { parseSlackEvent } from './events';
