import { MastraChannel } from '@mastra/core/channels';
import type { ChannelSendParams, ChannelSendResult } from '@mastra/core/channels';
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
    super({ name: 'slack', commands: config.commands });
    this.#signingSecret = config.signingSecret;
    this.#botToken = config.botToken;
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
        path: `/api/agents/${this.agent.id}/channels/slack/webhook`,
        method: 'POST',
        requiresAuth: false,
        createHandler: async ({ mastra }: { mastra: Mastra }) => {
          return async (c: Context) => {
            // 1. Verify the request signature
            const { verified, body } = await verifySlackRequest(c.req.raw, channel.#signingSecret);

            if (!verified) {
              return c.json({ error: 'Invalid signature' }, 401);
            }

            const payload: SlackEventPayload = JSON.parse(body!);

            // 2. Handle Slack URL verification challenge
            if (payload.type === 'url_verification') {
              return c.json({ challenge: payload.challenge });
            }

            // 3. Parse the event
            const event = parseSlackEvent(payload);
            if (!event) {
              return c.json({ ok: true });
            }

            // 4. Ignore bot messages to prevent loops
            if (payload.event?.bot_id) {
              return c.json({ ok: true });
            }

            // 5. Process via base class pipeline (agent → thread → generate → send)
            await channel.processWebhookEvent({ event, mastra });

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
