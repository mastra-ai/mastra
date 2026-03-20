import type { Adapter, Message, Thread } from 'chat';
import { Chat } from 'chat';
import type { Context } from 'hono';
import { z } from 'zod';

import type { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import type { ApiRoute } from '../../server/types';
import { createTool } from '../../tools/tool';
import { MastraChannel } from '../base';
import type { ChannelContext, ChannelSendParams, ChannelSendResult } from '../types';

import { InMemoryStateShim } from './state-shim';
import type { ChatAdapterChannelConfig } from './types';

/**
 * Bridge that wraps a Vercel Chat SDK adapter as a Mastra channel.
 *
 * Uses the real `Chat` class from the SDK for routing, deduplication,
 * thread locking, and self-message filtering. Mastra handlers are
 * registered via `onDirectMessage`, `onNewMention`, and `onSubscribedMessage`.
 *
 * @example
 * ```ts
 * import { DiscordAdapter } from '@chat-adapter/discord';
 *
 * const myAgent = new Agent({
 *   name: 'myAgent',
 *   channels: {
 *     discord: new DiscordAdapter({ ... }),
 *   },
 * });
 * ```
 */
export class ChatAdapterChannel extends MastraChannel {
  readonly platform: string;

  private adapter: Adapter;
  private stateAdapter;
  private userName: string;
  private chat: Chat | null = null;

  /**
   * Exposes the internal logger for use by the Chat SDK logger bridge.
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
    this.stateAdapter = config.state ?? new InMemoryStateShim();
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
          const encodedThreadId = threadId ? `${platform}:${channelId}:${threadId}` : `${platform}:${channelId}:`;
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
          const encodedThreadId = threadId ? `${platform}:${channelId}:${threadId}` : `${platform}:${channelId}:`;
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
          const encodedThreadId = threadId ? `${platform}:${channelId}:${threadId}` : `${platform}:${channelId}:`;
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
          emoji: z.string().describe('The emoji to react with (e.g. "thumbsup")'),
        }),
        execute: async ({ channelId, threadId, messageId, emoji }) => {
          const encodedThreadId = threadId ? `${platform}:${channelId}:${threadId}` : `${platform}:${channelId}:`;
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
          const encodedThreadId = threadId ? `${platform}:${channelId}:${threadId}` : `${platform}:${channelId}:`;
          await adapter.removeReaction(encodedThreadId, messageId, emoji);
          return { ok: true };
        },
      }),
    };
  }

  /** Minimum interval between message edits to avoid rate limits. */
  private editIntervalMs = 1000;

  /**
   * Core handler wired to Chat SDK's onDirectMessage, onNewMention,
   * and onSubscribedMessage. Streams the Mastra agent response and
   * updates the channel message in real-time via edits.
   */
  private async handleChatMessage(sdkThread: Thread, message: Message, mastra: Mastra): Promise<void> {
    const agent = this.agent;

    // Map to a Mastra thread for memory/history
    const mastraThread = await this.getOrCreateThread({
      externalThreadId: sdkThread.id,
      channelId: sdkThread.channelId,
      resourceId: `${this.platform}:${message.author.userId}`,
      mastra,
    });

    // Build request context with channel info
    const requestContext = new RequestContext();
    requestContext.set('channel', {
      platform: this.platform,
      eventType: sdkThread.isDM ? 'message' : 'mention',
      isDM: sdkThread.isDM,
      threadId: sdkThread.id,
      channelId: sdkThread.channelId,
      messageId: message.id,
      userId: message.author.userId,
      userName: message.author.fullName || message.author.userName,
    } satisfies ChannelContext);

    // Show typing indicator while generating
    await sdkThread.startTyping();

    // Stream the agent response
    const stream = await agent.stream(message.text, {
      requestContext,
      memory: {
        thread: mastraThread,
        resource: `${this.platform}:${message.author.userId}`,
      },
    });

    // Post an initial placeholder and stream edits
    let sentMessage: Awaited<ReturnType<typeof sdkThread.post>> | null = null;
    let accumulated = '';
    let lastEditTime = 0;
    let pendingEdit: ReturnType<typeof setTimeout> | null = null;

    const flushEdit = async () => {
      if (pendingEdit) {
        clearTimeout(pendingEdit);
        pendingEdit = null;
      }
      if (!sentMessage || !accumulated) return;
      try {
        sentMessage = await sentMessage.edit(accumulated);
        lastEditTime = Date.now();
      } catch (err) {
        this.channelLogger.error(`[${this.platform}] Failed to edit message`, err);
      }
    };

    const reader = stream.textStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += value;

        if (!sentMessage) {
          // Post the first message as soon as we have content
          sentMessage = await sdkThread.post(accumulated);
          lastEditTime = Date.now();
          continue;
        }

        // Debounce edits to respect rate limits
        const elapsed = Date.now() - lastEditTime;
        if (elapsed >= this.editIntervalMs) {
          await flushEdit();
        } else if (!pendingEdit) {
          pendingEdit = setTimeout(() => {
            pendingEdit = null;
            void flushEdit();
          }, this.editIntervalMs - elapsed);
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final edit with the complete response
    await flushEdit();

    // Subscribe so follow-up messages also get handled
    await sdkThread.subscribe();
  }

  /**
   * Initialize the Chat SDK with the real Chat class and register handlers.
   */
  async initialize(mastra: Mastra): Promise<void> {
    const chat = new Chat({
      adapters: { [this.platform]: this.adapter },
      state: this.stateAdapter,
      userName: this.userName,
    });

    const handler = (sdkThread: Thread, message: Message) => this.handleChatMessage(sdkThread, message, mastra);

    chat.onDirectMessage(handler);
    chat.onNewMention(handler);
    chat.onSubscribedMessage(handler);

    await chat.initialize();

    this.chat = chat;

    // If the adapter supports Gateway mode (e.g. Discord), start a persistent listener.
    const adapterWithGateway = this.adapter as unknown as Record<string, unknown>;
    if (typeof adapterWithGateway.startGatewayListener === 'function') {
      this.channelLogger.info(`[${this.platform}] Starting Gateway listener`);
      const startGateway = adapterWithGateway.startGatewayListener.bind(this.adapter) as (
        options: { waitUntil: (p: Promise<unknown>) => void },
        durationMs?: number,
      ) => Promise<Response>;

      const reconnect = async () => {
        const DURATION = 24 * 60 * 60 * 1000;
        while (true) {
          try {
            this.channelLogger.info(`[${this.platform}] Gateway connecting...`);
            let resolve: () => void;
            const done = new Promise<void>(r => {
              resolve = r;
            });
            await startGateway(
              {
                waitUntil: (p: Promise<unknown>) => {
                  void p.then(() => resolve!());
                },
              },
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
      void reconnect();
    }
  }

  /**
   * Returns webhook routes that delegate to the Chat SDK's webhook handler.
   */
  getWebhookRoutes(): ApiRoute[] {
    const channel = this;
    return [
      {
        path: `/api/agents/${this.agent.id}/channels/${this.platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        createHandler: async ({ mastra }: { mastra: Mastra }) => {
          if (!channel.chat) {
            await channel.initialize(mastra);
          }

          return async (c: Context) => {
            channel.channelLogger.info(`[${channel.platform}] Incoming webhook request: ${c.req.method} ${c.req.url}`);
            try {
              // Delegate directly to the Chat SDK's webhook handler
              const response = await channel.chat!.webhooks[channel.platform]!(c.req.raw);
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
   * Send a message through the Chat SDK adapter (for outbound/proactive messages).
   */
  async send(params: ChannelSendParams): Promise<ChannelSendResult> {
    try {
      const threadId = params.threadId
        ? `${this.platform}:${params.channelId}:${params.threadId}`
        : `${this.platform}:${params.channelId}:`;

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
