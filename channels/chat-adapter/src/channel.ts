import { MastraChannel } from '@mastra/core/channels';
import type { ChannelSendParams, ChannelSendResult } from '@mastra/core/channels';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute } from '@mastra/core/server';
import { createTool } from '@mastra/core/tools';
import type { Adapter, StateAdapter } from 'chat';
import type { Context } from 'hono';
import { z } from 'zod';

import { MastraChatInstance } from './chat-instance-shim';
import { InMemoryStateShim } from './state-shim';
import type { ChatAdapterChannelConfig } from './types';

/**
 * Bridge that wraps a Vercel Chat SDK adapter as a Mastra channel.
 *
 * This lets you use any `@chat-adapter/*` package (Slack, Discord, Teams,
 * Telegram, etc.) with Mastra's agent pipeline — webhook verification,
 * event parsing, thread management, and outbound messaging are all handled
 * by the Chat SDK adapter.
 *
 * @example
 * ```ts
 * import { ChatAdapterChannel } from '@mastra/channel-chat-adapter';
 * import { createSlackAdapter } from '@chat-adapter/slack';
 *
 * const myAgent = new Agent({
 *   name: 'myAgent',
 *   channels: {
 *     slack: new ChatAdapterChannel({
 *       adapter: createSlackAdapter(),
 *     }),
 *   },
 * });
 * ```
 */
export class ChatAdapterChannel extends MastraChannel {
  readonly platform: string;

  private adapter: Adapter;
  private state: StateAdapter;
  private userName: string;
  private chatInstance: MastraChatInstance | null = null;

  /**
   * Exposes the internal logger for use by the ChatInstance shim.
   * @internal
   */
  get channelLogger() {
    return this.logger;
  }

  constructor(config: ChatAdapterChannelConfig) {
    super({
      name: config.platform ?? config.adapter.name,
      commands: config.commands,
    });

    this.adapter = config.adapter;
    this.platform = config.platform ?? config.adapter.name;
    this.state = config.state ?? new InMemoryStateShim();
    this.userName = config.userName ?? 'Mastra';
  }

  /**
   * Returns tools that let the agent interact with this channel.
   * Tools are prefixed with the platform name (e.g. `discord_delete_message`).
   */
  getTools() {
    const adapter = this.adapter;
    const platform = this.platform;

    return {
      [`${platform}_send_message`]: createTool({
        id: `${platform}_send_message`,
        description: `Send a message to a ${platform} channel or thread.`,
        inputSchema: z.object({
          channelId: z.string().describe('The channel ID to send the message to'),
          threadId: z.string().optional().describe('The thread ID to reply in (omit for a new message)'),
          text: z.string().describe('The message text to send'),
        }),
        execute: async ({ channelId, threadId, text }) => {
          const encodedThreadId = threadId
            ? `${platform}:${channelId}:${threadId}`
            : `${platform}:${channelId}:`;
          const result = await adapter.postMessage(encodedThreadId, { markdown: text });
          return { ok: true, messageId: result.id };
        },
      }),

      [`${platform}_edit_message`]: createTool({
        id: `${platform}_edit_message`,
        description: `Edit a previously sent message on ${platform}.`,
        inputSchema: z.object({
          channelId: z.string().describe('The channel ID containing the message'),
          threadId: z.string().optional().describe('The thread ID containing the message'),
          messageId: z.string().describe('The ID of the message to edit'),
          text: z.string().describe('The new message text'),
        }),
        execute: async ({ channelId, threadId, messageId, text }) => {
          const encodedThreadId = threadId
            ? `${platform}:${channelId}:${threadId}`
            : `${platform}:${channelId}:`;
          await adapter.editMessage(encodedThreadId, messageId, { markdown: text });
          return { ok: true };
        },
      }),

      [`${platform}_delete_message`]: createTool({
        id: `${platform}_delete_message`,
        description: `Delete a message on ${platform}.`,
        inputSchema: z.object({
          channelId: z.string().describe('The channel ID containing the message'),
          threadId: z.string().optional().describe('The thread ID containing the message'),
          messageId: z.string().describe('The ID of the message to delete'),
        }),
        execute: async ({ channelId, threadId, messageId }) => {
          const encodedThreadId = threadId
            ? `${platform}:${channelId}:${threadId}`
            : `${platform}:${channelId}:`;
          await adapter.deleteMessage(encodedThreadId, messageId);
          return { ok: true };
        },
      }),

      [`${platform}_add_reaction`]: createTool({
        id: `${platform}_add_reaction`,
        description: `Add an emoji reaction to a message on ${platform}.`,
        inputSchema: z.object({
          channelId: z.string().describe('The channel ID containing the message'),
          threadId: z.string().optional().describe('The thread ID containing the message'),
          messageId: z.string().describe('The ID of the message to react to'),
          emoji: z.string().describe('The emoji to react with (e.g. "thumbsup", "🎉")'),
        }),
        execute: async ({ channelId, threadId, messageId, emoji }) => {
          const encodedThreadId = threadId
            ? `${platform}:${channelId}:${threadId}`
            : `${platform}:${channelId}:`;
          await adapter.addReaction(encodedThreadId, messageId, emoji);
          return { ok: true };
        },
      }),

      [`${platform}_remove_reaction`]: createTool({
        id: `${platform}_remove_reaction`,
        description: `Remove an emoji reaction from a message on ${platform}.`,
        inputSchema: z.object({
          channelId: z.string().describe('The channel ID containing the message'),
          threadId: z.string().optional().describe('The thread ID containing the message'),
          messageId: z.string().describe('The ID of the message to remove reaction from'),
          emoji: z.string().describe('The emoji to remove'),
        }),
        execute: async ({ channelId, threadId, messageId, emoji }) => {
          const encodedThreadId = threadId
            ? `${platform}:${channelId}:${threadId}`
            : `${platform}:${channelId}:`;
          await adapter.removeReaction(encodedThreadId, messageId, emoji);
          return { ok: true };
        },
      }),
    };
  }

  /**
   * Initialize the Chat SDK adapter with a Mastra instance.
   * Called automatically when the channel is registered with Mastra.
   */
  async initialize(mastra: Mastra): Promise<void> {
    this.chatInstance = new MastraChatInstance({
      state: this.state,
      userName: this.userName,
      channel: this,
      mastra,
    });

    await this.adapter.initialize(this.chatInstance);

    // If the adapter supports Gateway mode (e.g. Discord), start a persistent listener.
    // This is a duck-type check — startGatewayListener is not part of the Adapter interface.
    const adapterWithGateway = this.adapter as unknown as Record<string, unknown>;
    if (typeof adapterWithGateway.startGatewayListener === 'function') {
      this.channelLogger.info(`[${this.platform}] Starting Gateway listener`);
      const startGateway = adapterWithGateway.startGatewayListener.bind(this.adapter) as (
        options: { waitUntil: (p: Promise<unknown>) => void },
        durationMs?: number,
      ) => Promise<Response>;

      // Keep reconnecting indefinitely
      const reconnect = async () => {
        const DURATION = 24 * 60 * 60 * 1000; // 24 hours
        while (true) {
          try {
            this.channelLogger.info(`[${this.platform}] Gateway connecting...`);
            let resolve: () => void;
            const done = new Promise<void>(r => { resolve = r; });
            await startGateway(
              { waitUntil: (p: Promise<unknown>) => { p.then(() => resolve!()); } },
              DURATION,
            );
            await done;
            this.channelLogger.info(`[${this.platform}] Gateway listener ended, reconnecting...`);
          } catch (err) {
            this.channelLogger.error(`[${this.platform}] Gateway error, reconnecting in 5s...`, err);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      };
      reconnect();
    }
  }

  /**
   * Returns webhook routes that delegate to the Chat SDK adapter's handleWebhook.
   * The adapter handles all platform-specific verification and event routing.
   */
  getWebhookRoutes(): ApiRoute[] {
    const channel = this;
    return [
      {
        path: `/api/agents/${this.agent.id}/channels/${this.platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        createHandler: async ({ mastra }: { mastra: Mastra }) => {
          // Initialize on first route registration if not already done
          if (!channel.chatInstance) {
            await channel.initialize(mastra);
          }

          return async (c: Context) => {
            channel.channelLogger.info(`[${channel.platform}] Incoming webhook request: ${c.req.method} ${c.req.url}`);
            try {
              const response = await channel.adapter.handleWebhook(c.req.raw);
              channel.channelLogger.info(`[${channel.platform}] Webhook response: ${response.status}`);
              return response;
            } catch (err) {
              channel.channelLogger.error(`[${channel.platform}] Webhook error:`, err);
              throw err;
            }
          };
        },
      },
    ];
  }

  /**
   * Send a message through the Chat SDK adapter.
   */
  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    try {
      // Build a threadId from the channel and thread IDs.
      // Chat SDK adapters encode thread IDs as platform-specific strings.
      const threadId = params.threadId
        ? `${this.platform}:${params.channelId}:${params.threadId}`
        : `${this.platform}:${params.channelId}:`;

      // Use PostableMarkdown format — the adapter will render to platform format
      const result = await this.adapter.postMessage(threadId, {
        markdown: params.content.text,
      });

      return {
        ok: true,
        externalMessageId: result.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send message via ${this.platform}`, { error: message });
      return {
        ok: false,
        error: message,
      };
    }
  }
}
