import { createMemoryState } from '@chat-adapter/state-memory';
import type { Adapter, Message, StateAdapter, Thread } from 'chat';
import { Chat } from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';
import { createTool } from '../tools/tool';

import { MastraStateAdapter } from './state-adapter';
import type { ChannelContext } from './types';

/** Options for configuring channel behavior. */
export interface ChannelOptions {
  /** State adapter for deduplication, locking, and subscriptions. Defaults to in-memory. */
  state?: StateAdapter;
  /** The bot's display name (default: `'Mastra'`). */
  userName?: string;
  /**
   * Stream response chunks as live message edits (default: `true`).
   * When `false`, shows a typing indicator and posts the final message once complete.
   */
  streamingEdits?: boolean;
  /** Minimum interval (ms) between message edits to avoid rate limits (default: `1000`). */
  editIntervalMs?: number;
  /**
   * Start persistent Gateway WebSocket listeners for adapters that support it,
   * e.g. Discord (default: `true`).
   *
   * Required for receiving DMs, @mentions, and reactions. Set to `false` for
   * serverless deployments that only need slash commands via HTTP Interactions.
   */
  gateway?: boolean;
}

/**
 * Manages a single Chat SDK instance for an agent, wiring all adapters
 * to the Mastra pipeline (thread mapping → agent.stream → thread.post).
 *
 * One AgentChat = one bot identity across multiple platforms.
 *
 * @internal Created automatically by the Agent when `channels` config is provided.
 */
export class AgentChat {
  readonly adapters: Record<string, Adapter>;
  private chat: Chat | null = null;
  private agent!: Agent<any, any, any, any>;
  private logger?: IMastraLogger;
  private customState: StateAdapter | undefined;
  private stateAdapter!: StateAdapter;
  private userName: string;
  private streamingEdits: boolean;
  private editIntervalMs: number;
  private gateway: boolean;
  /** Names of auto-generated channel tools whose effects are already visible. */
  private channelToolNames: Set<string>;

  constructor(config: { adapters: Record<string, Adapter> } & ChannelOptions) {
    this.adapters = config.adapters;
    this.customState = config.state;
    this.userName = config.userName ?? 'Mastra';
    this.streamingEdits = config.streamingEdits ?? false;
    this.editIntervalMs = config.editIntervalMs ?? 1000;
    this.gateway = config.gateway ?? true;

    const suffixes = ['send_message', 'edit_message', 'delete_message', 'add_reaction', 'remove_reaction'];
    this.channelToolNames = new Set(Object.keys(this.adapters).flatMap(p => suffixes.map(s => `${p}_${s}`)));
  }

  /**
   * Bind this AgentChat to its owning agent. Called by Agent constructor.
   * @internal
   */
  __setAgent(agent: Agent<any, any, any, any>): void {
    this.agent = agent;
  }

  /**
   * Set the logger. Called by Mastra.addAgent.
   * @internal
   */
  __setLogger(logger: IMastraLogger): void {
    this.logger = logger;
  }

  /**
   * Initialize the Chat SDK, register handlers, and start gateway listeners.
   * Called by Mastra.addAgent after the server is ready.
   */
  async initialize(mastra: Mastra): Promise<void> {
    // Resolve state adapter: custom > Mastra storage > in-memory fallback
    if (this.customState) {
      this.stateAdapter = this.customState;
    } else {
      const storage = mastra.getStorage();
      const memoryStore = storage ? await storage.getStore('memory') : undefined;
      if (memoryStore) {
        this.stateAdapter = new MastraStateAdapter(memoryStore);
        this.log('info', 'Using MastraStateAdapter (subscriptions persist across restarts)');
      } else {
        this.stateAdapter = createMemoryState();
        this.log('info', 'Using in-memory state (subscriptions will not persist across restarts)');
      }
    }

    const chat = new Chat({
      adapters: this.adapters,
      state: this.stateAdapter,
      userName: this.userName,
    });

    const handler = (sdkThread: Thread, message: Message) => this.handleChatMessage(sdkThread, message, mastra);

    chat.onDirectMessage(handler);
    chat.onNewMention(handler);
    chat.onSubscribedMessage(handler);

    await chat.initialize();
    this.chat = chat;

    // Start gateway listeners for adapters that support it (e.g. Discord)
    if (!this.gateway) return;

    for (const [name, adapter] of Object.entries(this.adapters)) {
      const adapterAny = adapter as unknown as Record<string, unknown>;
      if (typeof adapterAny.startGatewayListener === 'function') {
        this.log('info', `[${name}] Starting Gateway listener`);
        const startGateway = adapterAny.startGatewayListener.bind(adapter) as (
          options: { waitUntil: (p: Promise<unknown>) => void },
          durationMs?: number,
        ) => Promise<Response>;

        this.startGatewayLoop(name, startGateway);
      }
    }
  }

  /**
   * Returns API routes for receiving webhook events from each adapter.
   * One POST route per adapter at `/api/agents/{agentId}/channels/{platform}/webhook`.
   */
  getWebhookRoutes(): ApiRoute[] {
    if (!this.agent) return [];

    const agentId = this.agent.id;
    const routes: ApiRoute[] = [];

    for (const platform of Object.keys(this.adapters)) {
      const chat = this;
      routes.push({
        path: `/api/agents/${agentId}/channels/${platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        createHandler: async () => {
          return async c => {
            if (!chat.chat) {
              return c.json({ error: 'Chat not initialized' }, 503);
            }
            const webhookHandler = (chat.chat.webhooks as Record<string, Function>)[platform];
            if (!webhookHandler) {
              return c.json({ error: `No webhook handler for ${platform}` }, 404);
            }
            return webhookHandler(c.req.raw);
          };
        },
      });
    }

    return routes;
  }

  /**
   * Returns tools that let the agent interact with all connected channels.
   * Tools are prefixed with the platform name (e.g. `discord_send_message`).
   */
  getTools(): Record<string, unknown> {
    const tools: Record<string, unknown> = {};

    for (const [platform, adapter] of Object.entries(this.adapters)) {
      Object.assign(tools, this.makeAdapterTools(platform, adapter));
    }

    return tools;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Core handler wired to Chat SDK's onDirectMessage, onNewMention,
   * and onSubscribedMessage. Streams the Mastra agent response and
   * updates the channel message in real-time via edits.
   */
  private async handleChatMessage(sdkThread: Thread, message: Message, mastra: Mastra): Promise<void> {
    const agent = this.agent;
    const platform = sdkThread.adapter.name;

    // Map to a Mastra thread for memory/history
    const mastraThread = await this.getOrCreateThread({
      externalThreadId: sdkThread.id,
      channelId: sdkThread.channelId,
      platform,
      resourceId: `${platform}:${message.author.userId}`,
      mastra,
    });

    // Use the thread's resourceId for memory, not the current message author.
    // In multi-user threads (e.g. Slack channels), the thread is owned by whoever
    // started it. Other participants' messages are still part of that thread's history.
    const threadResourceId = mastraThread.resourceId;

    // Build request context with channel info
    const requestContext = new RequestContext();
    requestContext.set('channel', {
      platform,
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

    // Prefix the message with the author so the agent can distinguish
    // who said what in multi-user threads and mention them if needed.
    // Uses the platform's native mention format (e.g. <@U123|Name> for Slack).
    const authorName = message.author.fullName || message.author.userName;
    const authorId = message.author.userId;
    let authorPrefix = '';
    if (authorId) {
      const mention = sdkThread.mentionUser(authorId);
      authorPrefix = authorName ? `${authorName} (${mention})` : mention;
    } else if (authorName) {
      authorPrefix = authorName;
    }
    const messageText = authorPrefix ? `[${authorPrefix}]: ${message.text}` : message.text;

    // Stream the agent response
    const stream = await agent.stream(messageText, {
      requestContext,
      memory: {
        thread: mastraThread,
        resource: threadResourceId,
      },
    });

    // Track tool call messages so we can edit them with results
    type SentMessage = Awaited<ReturnType<typeof sdkThread.post>>;
    const toolCallMessages = new Map<string, { sent: SentMessage; toolName: string; argsText: string }>();

    if (this.streamingEdits) {
      // Post an initial message and edit it as chunks arrive
      let sentMessage: SentMessage | null = null;
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
          this.log('error', `[${platform}] Failed to edit message`, err);
        }
      };

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call') {
          // Skip channel tools — their effects are already visible in the chat
          if (this.channelToolNames.has(chunk.payload.toolName)) continue;

          // Flush any pending text edit before the tool message
          await flushEdit();

          const displayName = stripToolPrefix(chunk.payload.toolName);
          const argsText = formatArgs(chunk.payload.args);
          const toolMsg = await sdkThread.post(`🔧 \`${displayName}\`(${argsText})`);
          toolCallMessages.set(chunk.payload.toolCallId, {
            sent: toolMsg,
            toolName: displayName,
            argsText,
          });
        } else if (chunk.type === 'tool-result') {
          const entry = toolCallMessages.get(chunk.payload.toolCallId);
          if (entry) {
            const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
            try {
              await entry.sent.edit(`🔧 \`${entry.toolName}\`(${entry.argsText})\n> ${resultText}`);
            } catch (err) {
              this.log('error', `[${platform}] Failed to edit tool result`, err);
            }
            toolCallMessages.delete(chunk.payload.toolCallId);
          }
        } else if (chunk.type === 'text-delta') {
          accumulated += chunk.payload.text;

          if (!sentMessage) {
            sentMessage = await sdkThread.post(accumulated);
            lastEditTime = Date.now();
            continue;
          }

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
      }

      // Final edit with the complete response
      await flushEdit();
    } else {
      // Collect the full response, then send once. Post tool calls in real-time.
      let text = '';

      for await (const chunk of stream.fullStream) {
        if (chunk.type === 'tool-call') {
          // Skip channel tools — their effects are already visible in the chat
          if (this.channelToolNames.has(chunk.payload.toolName)) continue;

          const displayName = stripToolPrefix(chunk.payload.toolName);
          const argsText = formatArgs(chunk.payload.args);
          const toolMsg = await sdkThread.post(`🔧 \`${displayName}\`(${argsText})`);
          toolCallMessages.set(chunk.payload.toolCallId, {
            sent: toolMsg,
            toolName: displayName,
            argsText,
          });
        } else if (chunk.type === 'tool-result') {
          const entry = toolCallMessages.get(chunk.payload.toolCallId);
          if (entry) {
            const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
            try {
              await entry.sent.edit(`🔧 \`${entry.toolName}\`(${entry.argsText})\n> ${resultText}`);
            } catch (err) {
              this.log('error', `[${platform}] Failed to edit tool result`, err);
            }
            toolCallMessages.delete(chunk.payload.toolCallId);
          }
        } else if (chunk.type === 'text-delta') {
          text += chunk.payload.text;
        }
      }

      if (text) {
        await sdkThread.post(text);
      }
    }

    // Subscribe so follow-up messages also get handled
    await sdkThread.subscribe();
  }

  /**
   * Resolves an existing Mastra thread for the given external IDs, or creates one.
   */
  private async getOrCreateThread({
    externalThreadId,
    channelId,
    platform,
    resourceId,
    mastra,
  }: {
    externalThreadId: string;
    channelId: string;
    platform: string;
    resourceId: string;
    mastra: Mastra;
  }): Promise<StorageThreadType> {
    const storage = mastra.getStorage();
    if (!storage) {
      throw new Error('Storage is required for channel thread mapping. Configure storage in your Mastra instance.');
    }

    const memoryStore = await storage.getStore('memory');
    if (!memoryStore) {
      throw new Error(
        'Memory store is required for channel thread mapping. Configure storage in your Mastra instance.',
      );
    }

    const metadata = {
      channel_platform: platform,
      channel_externalThreadId: externalThreadId,
      channel_externalChannelId: channelId,
    };

    const { threads } = await memoryStore.listThreads({
      filter: { metadata },
      perPage: 1,
    });

    if (threads.length > 0) {
      return threads[0]!;
    }

    return memoryStore.saveThread({
      thread: {
        id: crypto.randomUUID(),
        title: `${platform} conversation`,
        resourceId,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
      },
    });
  }

  /**
   * Generate platform-prefixed tools for one adapter.
   */
  private makeAdapterTools(platform: string, adapter: Adapter) {
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

  /**
   * Persistent reconnection loop for Gateway-based adapters (e.g. Discord).
   */
  private startGatewayLoop(
    name: string,
    startGateway: (options: { waitUntil: (p: Promise<unknown>) => void }, durationMs?: number) => Promise<Response>,
  ): void {
    const DURATION = 24 * 60 * 60 * 1000;

    const reconnect = async () => {
      while (true) {
        try {
          this.log('info', `[${name}] Gateway connecting...`);
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
          this.log('info', `[${name}] Gateway session ended, reconnecting...`);
        } catch (err) {
          this.log('error', `[${name}] Gateway listener error`, err);
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    };

    void reconnect();
  }

  private log(level: 'info' | 'error' | 'debug', message: string, ...args: unknown[]): void {
    if (!this.logger) return;
    if (level === 'error') {
      this.logger.error(message, { args });
    } else if (level === 'debug') {
      this.logger.debug(message, { args });
    } else {
      this.logger.info(message, { args });
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const MAX_ARG_VALUE_LENGTH = 60;
const MAX_RESULT_LENGTH = 200;

/**
 * Strip platform/namespace prefixes from tool names.
 * e.g. "mastra_workspace_list_files" → "list_files"
 *      "discord_send_message" → "send_message"
 */
function stripToolPrefix(name: string): string {
  // Remove up to two underscore-separated prefixes
  const parts = name.split('_');
  if (parts.length <= 2) return name;
  // Heuristic: known prefixes are single-word (platform or namespace)
  // Try dropping first segment, then first two if the second is also a known namespace word
  const knownPrefixes = new Set([
    'mastra',
    'discord',
    'slack',
    'teams',
    'gchat',
    'telegram',
    'github',
    'linear',
    'whatsapp',
  ]);
  if (knownPrefixes.has(parts[0]!)) {
    const rest = parts.slice(1);
    if (rest.length > 1 && knownPrefixes.has(rest[0]!)) {
      return rest.slice(1).join('_');
    }
    return rest.join('_');
  }
  return name;
}

/**
 * Format tool call args as compact key: value pairs.
 * Strips internal metadata, skips false/null values, and truncates long strings.
 */
function formatArgs(args: unknown): string {
  if (args == null) return '';
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    if (!obj || typeof obj !== 'object') return String(args);

    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([key, val]) => key !== '__mastraMetadata' && val != null && val !== false,
    );

    if (entries.length === 0) return '';

    const parts = entries.map(([key, val]) => {
      if (typeof val === 'string') {
        const truncated = val.length > MAX_ARG_VALUE_LENGTH ? val.slice(0, MAX_ARG_VALUE_LENGTH) + '…' : val;
        return `${key}: "${truncated}"`;
      }
      return `${key}: ${JSON.stringify(val)}`;
    });

    return parts.join(', ');
  } catch {
    return String(args);
  }
}

/**
 * Format a tool result for display. Truncates long output.
 */
function formatResult(result: unknown, isError?: boolean): string {
  const prefix = isError ? '❌ ' : '';
  if (result == null) return `${prefix}(no output)`;
  let text = typeof result === 'string' ? result : JSON.stringify(result);
  // Collapse to single line for blockquote
  text = text.replace(/\n/g, ' ').trim();
  if (text.length > MAX_RESULT_LENGTH) {
    text = text.slice(0, MAX_RESULT_LENGTH) + '…';
  }
  return `${prefix}${text}`;
}
