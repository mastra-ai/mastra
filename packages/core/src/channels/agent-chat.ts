import { createMemoryState } from '@chat-adapter/state-memory';
import type { Adapter, CardElement, Message, SentMessage, StateAdapter, Thread } from 'chat';
import { Actions, Button, Card, CardText, Chat, ThreadImpl } from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';
import type { MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools/tool';

import { MastraStateAdapter } from './state-adapter';
import type { ChannelContext } from './types';

/** Message content that can be posted to a channel. */
export type PostableMessage = string | CardElement;

/** Per-adapter configuration. */
export interface ChannelAdapterConfig {
  adapter: Adapter;
  /**
   * Start a persistent Gateway WebSocket listener for this adapter
   * (default: `true`).
   *
   * Only relevant for adapters that support it (e.g. Discord).
   * Required for receiving DMs, @mentions, and reactions. Set to `false` for
   * serverless deployments that only need slash commands via HTTP Interactions.
   */
  gateway?: boolean;

  /**
   * Override how tool calls are rendered in the chat.
   * Called once per tool invocation after the result is available.
   * Return `null` to suppress the message entirely.
   *
   * @default - A Card showing the function-call signature and result.
   */
  formatToolCall?: (info: {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    isError?: boolean;
  }) => PostableMessage | null;

  /**
   * Override how errors are rendered in the chat.
   * Return a user-friendly message instead of exposing the raw error.
   *
   * @default `"❌ Error: <error.message>"`
   */
  formatError?: (error: Error) => PostableMessage;
}

/** Global options for configuring channel behavior. */
export interface ChannelOptions {
  /** State adapter for deduplication, locking, and subscriptions. Defaults to in-memory. */
  state?: StateAdapter;
  /** The bot's display name (default: `'Mastra'`). */
  userName?: string;
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
  /** Normalized per-adapter configs (gateway flags, hooks, etc.). */
  private adapterConfigs: Record<string, ChannelAdapterConfig>;
  /** Names of auto-generated channel tools whose effects are already visible. */
  private channelToolNames: Set<string>;

  constructor(config: { adapters: Record<string, Adapter | ChannelAdapterConfig> } & ChannelOptions) {
    // Normalize: extract adapters and per-adapter configs
    const adapters: Record<string, Adapter> = {};
    const adapterConfigs: Record<string, ChannelAdapterConfig> = {};

    for (const [name, value] of Object.entries(config.adapters)) {
      if (value && typeof value === 'object' && 'adapter' in value) {
        const cfg = value as ChannelAdapterConfig;
        adapters[name] = cfg.adapter;
        adapterConfigs[name] = cfg;
      } else {
        adapters[name] = value as Adapter;
        adapterConfigs[name] = { adapter: value as Adapter };
      }
    }

    this.adapters = adapters;
    this.adapterConfigs = adapterConfigs;
    this.customState = config.state;
    this.userName = config.userName ?? 'Mastra';

    this.channelToolNames = new Set([
      'send_message',
      'edit_message',
      'delete_message',
      'add_reaction',
      'remove_reaction',
    ]);
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
    this.logger =
      'child' in logger && typeof (logger as any).child === 'function' ? (logger as any).child('CHANNEL') : logger;
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

    // Tool approval buttons
    chat.onAction(['tool_approve', 'tool_deny'], async event => {
      try {
        if (!event.value) return;
        const {
          runId,
          toolCallId,
          threadId,
          platform: storedPlatform,
          toolName: storedToolName,
          argsSummary: storedArgsSummary,
        } = JSON.parse(event.value) as {
          runId: string;
          toolCallId: string;
          threadId: string;
          platform: string;
          toolName: string;
          argsSummary: string;
        };
        const approved = event.actionId === 'tool_approve';
        const platform = storedPlatform || event.adapter.name;

        // Reconstruct the original conversation thread from the encoded data.
        // We can't use event.thread because Slack roots it on the card message,
        // creating unwanted sub-threads in DMs.
        const adapter = this.adapters[platform];
        if (!adapter) throw new Error(`No adapter for platform "${platform}"`);
        const parts = threadId.split(':');
        const sdkThread: Thread = new ThreadImpl({
          adapter,
          stateAdapter: this.stateAdapter,
          id: threadId,
          channelId: parts[1] || '',
          isDM: event.thread?.isDM,
        });

        // Update the approval card to remove buttons
        if (event.messageId) {
          const isDM = event.thread?.isDM ?? sdkThread.isDM;
          const suffix = isDM ? '' : ` by ${event.user.fullName || event.user.userName || 'User'}`;
          const statusText = approved ? `✅ Approved${suffix}` : `🚫 Denied${suffix}`;
          try {
            await adapter.editMessage(
              sdkThread.id,
              event.messageId,
              Card({
                children: [
                  CardText(
                    storedArgsSummary ? `**${storedToolName}** \`${storedArgsSummary}\`` : `**${storedToolName}**`,
                  ),
                  CardText(statusText),
                ],
              }),
            );
          } catch {
            // best-effort — some platforms may not support editing
          }
        }

        // Build request context for the resumed stream
        const requestContext = new RequestContext();
        requestContext.set('channel', {
          platform,
          eventType: 'action',
          isDM: sdkThread.isDM,
          threadId: sdkThread.id,
          channelId: sdkThread.channelId,
          messageId: event.messageId,
          userId: event.user.userId,
          userName: event.user.fullName || event.user.userName,
        } satisfies ChannelContext);

        // Resume the agent stream
        const method = approved ? 'approveToolCall' : 'declineToolCall';
        const resumedStream = await this.agent[method]({
          runId,
          toolCallId,
          requestContext,
        });

        // Lazy typing for the resumed stream
        let typingStarted = false;
        const ensureTyping = async () => {
          if (!typingStarted) {
            typingStarted = true;
            await sdkThread.startTyping();
          }
        };

        await this.consumeAgentStream(
          resumedStream,
          sdkThread,
          platform,
          ensureTyping,
          approved && event.messageId
            ? { messageId: event.messageId, toolName: storedToolName, argsSummary: storedArgsSummary }
            : undefined,
        );
      } catch (err) {
        this.log('error', 'Error handling tool approval action', err);
        try {
          const thread = event.thread;
          if (thread) {
            const error = err instanceof Error ? err : new Error(String(err));
            const adapterConfig = this.adapterConfigs[event.adapter.name];
            const errorMessage = adapterConfig?.formatError
              ? adapterConfig.formatError(error)
              : `❌ Error: ${error.message}`;
            await thread.post(errorMessage);
          }
        } catch {
          // best-effort
        }
      }
    });

    // TODO:
    // chat.onSlashCommand()
    // chat.onReaction()
    await chat.initialize();
    this.chat = chat;

    // Start gateway listeners for adapters that support it (e.g. Discord)
    for (const [name, adapter] of Object.entries(this.adapters)) {
      if (!(this.adapterConfigs[name]?.gateway ?? true)) continue;

      const adapterAny = adapter as unknown as Record<string, unknown>;
      if (typeof adapterAny.startGatewayListener === 'function') {
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
   * Returns generic channel tools (send_message, add_reaction, etc.)
   * that resolve the target adapter from the current request context.
   */
  getTools(): Record<string, unknown> {
    return this.makeChannelTools();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Resolve the adapter for the current conversation from request context.
   */
  private getAdapterFromContext(context: { requestContext?: RequestContext }): { adapter: Adapter; threadId: string } {
    const channel = context.requestContext?.get('channel') as ChannelContext | undefined;
    if (!channel?.platform || !channel?.threadId) {
      throw new Error('No channel context — cannot determine platform or thread');
    }
    const adapter = this.adapters[channel.platform];
    if (!adapter) {
      throw new Error(`No adapter registered for platform "${channel.platform}"`);
    }
    return { adapter, threadId: channel.threadId };
  }

  /**
   * Core handler wired to Chat SDK's onDirectMessage, onNewMention,
   * and onSubscribedMessage. Streams the Mastra agent response and
   * updates the channel message in real-time via edits.
   */
  private async handleChatMessage(sdkThread: Thread, message: Message, mastra: Mastra): Promise<void> {
    try {
      await this.processChatMessage(sdkThread, message, mastra);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log('error', `[${sdkThread.adapter.name}] Error handling message`, err);
      try {
        const adapterConfig = this.adapterConfigs[sdkThread.adapter.name];
        const errorMessage = adapterConfig?.formatError
          ? adapterConfig.formatError(error)
          : `❌ Error: ${error.message}`;
        await sdkThread.post(errorMessage);
      } catch {
        // best-effort — if we can't post the error, just log it
      }
    }
  }

  private async processChatMessage(sdkThread: Thread, message: Message, mastra: Mastra): Promise<void> {
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

    // Lazy typing indicator — only trigger when actual content arrives
    let typingStarted = false;
    const ensureTyping = async () => {
      if (!typingStarted) {
        typingStarted = true;
        await sdkThread.startTyping();
      }
    };

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
    if (message.author.isBot && authorPrefix) {
      authorPrefix += ' (bot)';
    }
    const rawText = authorPrefix ? `[${authorPrefix}]: ${message.text}` : message.text;

    // Build multimodal content if the message has image/file attachments,
    // otherwise pass a plain string. Use fetchData() when available (e.g. Slack
    // private URLs that require auth), falling back to the public URL.
    const usableAttachments = message.attachments.filter(a => a.url || a.fetchData);

    let streamInput: Parameters<typeof agent.stream>[0];
    if (usableAttachments.length > 0) {
      type ContentPart =
        | { type: 'text'; text: string }
        | { type: 'image'; image: URL | Uint8Array; mimeType?: string }
        | { type: 'file'; data: URL | Uint8Array; mimeType: string };
      const parts: ContentPart[] = [{ type: 'text', text: rawText }];

      for (const att of usableAttachments) {
        const data = att.fetchData ? await att.fetchData() : undefined;
        if (att.type === 'image') {
          parts.push({
            type: 'image',
            image: data ?? new URL(att.url!),
            ...(att.mimeType && { mimeType: att.mimeType }),
          });
        } else if (att.mimeType) {
          parts.push({
            type: 'file',
            data: data ?? new URL(att.url!),
            mimeType: att.mimeType,
          });
        }
        // Skip non-image attachments without a mimeType — FilePart requires it
      }

      streamInput = { role: 'user' as const, content: parts };
    } else {
      streamInput = rawText;
    }

    // Stream the agent response
    const stream = await agent.stream(streamInput, {
      requestContext,
      memory: {
        thread: mastraThread,
        resource: threadResourceId,
      },
    });

    await this.consumeAgentStream(stream, sdkThread, platform, ensureTyping);

    // Subscribe so follow-up messages also get handled
    await sdkThread.subscribe();
  }

  /**
   * Consume an agent stream (initial or resumed), posting text, tool cards,
   * and approval prompts to the SDK thread.
   */
  private async consumeAgentStream(
    stream: MastraModelOutput,
    sdkThread: Thread,
    platform: string,
    ensureTyping: () => Promise<void>,
    approvalContext?: { messageId: string; toolName: string; argsSummary: string },
  ): Promise<void> {
    const adapterConfig = this.adapterConfigs[platform];

    // Track tool calls: store metadata + the sent message so we can edit it if approval comes
    interface TrackedToolCall {
      toolName: string;
      args: Record<string, unknown>;
      argsSummary: string;
      sentMessage?: SentMessage;
    }
    const toolCalls = new Map<string, TrackedToolCall>();

    let text = '';
    const flushText = async () => {
      if (text.trim()) {
        await sdkThread.post(text);
        text = '';
      }
    };

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call') {
        if (this.channelToolNames.has(chunk.payload.toolName)) continue;
        await ensureTyping();
        await flushText();

        const displayName = stripToolPrefix(chunk.payload.toolName);
        const rawArgs = (
          typeof chunk.payload.args === 'object' && chunk.payload.args != null ? chunk.payload.args : {}
        ) as Record<string, unknown>;
        const argsSummary = formatArgsSummary(rawArgs);

        const sentMessage = adapterConfig?.formatToolCall
          ? undefined
          : await sdkThread.post(
              Card({
                children: [CardText(argsSummary ? `**${displayName}** \`${argsSummary}\`` : `**${displayName}**`)],
              }),
            );

        toolCalls.set(chunk.payload.toolCallId, { toolName: displayName, args: rawArgs, argsSummary, sentMessage });
      } else if (chunk.type === 'tool-result') {
        const entry = toolCalls.get(chunk.payload.toolCallId);
        const displayName = entry?.toolName ?? stripToolPrefix(chunk.payload.toolName);
        const args = entry?.args ?? ((chunk.payload.args ?? {}) as Record<string, unknown>);
        const argsSummary = entry?.argsSummary ?? formatArgsSummary(args);
        toolCalls.delete(chunk.payload.toolCallId);

        if (adapterConfig?.formatToolCall) {
          const custom = adapterConfig.formatToolCall({
            toolName: displayName,
            args,
            result: chunk.payload.result,
            isError: chunk.payload.isError,
          });
          if (custom != null) {
            await sdkThread.post(custom);
          }
        } else {
          const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
          const resultCard = buildToolResultCard(displayName, argsSummary, resultText, chunk.payload.isError);

          // Try to edit the existing message (call message or approval card) into the result card
          const editTarget = entry?.sentMessage ?? (approvalContext ? null : undefined);
          if (editTarget) {
            try {
              await editTarget.edit(resultCard);
            } catch {
              await sdkThread.post(resultCard);
            }
          } else if (approvalContext) {
            // Resumed after approval — edit the approval card via adapter
            try {
              const adapter = this.adapters[platform]!;
              await adapter.editMessage(sdkThread.id, approvalContext.messageId, resultCard);
            } catch {
              await sdkThread.post(resultCard);
            }
            approvalContext = undefined; // Only use it for the first tool-result
          } else {
            await sdkThread.post(resultCard);
          }
        }
      } else if (chunk.type === 'tool-call-approval') {
        await ensureTyping();
        await flushText();

        const { toolCallId, toolName, args } = chunk.payload;
        const entry = toolCalls.get(toolCallId);
        const displayName = entry?.toolName ?? stripToolPrefix(toolName);
        const argsSummary = entry?.argsSummary ?? formatArgsSummary(args);
        toolCalls.delete(toolCallId);

        const approvalData = JSON.stringify({
          runId: stream.runId,
          toolCallId,
          threadId: sdkThread.id,
          platform,
          toolName: displayName,
          argsSummary,
        });

        const header = argsSummary ? `**${displayName}** \`${argsSummary}\`` : `**${displayName}**`;
        const approvalCard = Card({
          children: [
            CardText(header),
            CardText('Requires approval to run.'),
            Actions([
              Button({ id: 'tool_approve', label: 'Approve', style: 'primary', value: approvalData }),
              Button({ id: 'tool_deny', label: 'Deny', style: 'danger', value: approvalData }),
            ]),
          ],
        });

        // If we already posted a call message, edit it into the approval card;
        // otherwise post a new one
        if (entry?.sentMessage) {
          try {
            await entry.sentMessage.edit(approvalCard);
          } catch {
            await sdkThread.post(approvalCard);
          }
        } else {
          await sdkThread.post(approvalCard);
        }
        // Stream is suspended — the onAction handler will resume it
        return;
      } else if (chunk.type === 'text-delta') {
        if (chunk.payload.text) await ensureTyping();
        text += chunk.payload.text;
      } else if (chunk.type === 'reasoning-delta') {
        await ensureTyping();
      } else if (chunk.type === 'step-finish') {
        await flushText();
      }
    }
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
   * Generate generic channel tools that resolve the adapter from request context.
   * Tool names are platform-agnostic (e.g. `send_message`, not `discord_send_message`).
   */
  private makeChannelTools() {
    return {
      send_message: createTool({
        id: 'send_message',
        description: 'Send a message in the current conversation.',
        inputSchema: z.object({
          text: z.string().describe('The message text to send'),
        }),
        execute: async ({ text }, context) => {
          const { adapter, threadId } = this.getAdapterFromContext(context);
          const result = await adapter.postMessage(threadId, { markdown: text });
          return { ok: true, messageId: result.id };
        },
      }),

      edit_message: createTool({
        id: 'edit_message',
        description: 'Edit a previously sent message.',
        inputSchema: z.object({
          messageId: z.string().describe('The ID of the message to edit'),
          text: z.string().describe('The new message text'),
        }),
        execute: async ({ messageId, text }, context) => {
          const { adapter, threadId } = this.getAdapterFromContext(context);
          await adapter.editMessage(threadId, messageId, { markdown: text });
          return { ok: true };
        },
      }),

      delete_message: createTool({
        id: 'delete_message',
        description: 'Delete a message.',
        inputSchema: z.object({
          messageId: z.string().describe('The ID of the message to delete'),
        }),
        execute: async ({ messageId }, context) => {
          const { adapter, threadId } = this.getAdapterFromContext(context);
          await adapter.deleteMessage(threadId, messageId);
          return { ok: true };
        },
      }),

      add_reaction: createTool({
        id: 'add_reaction',
        description: 'Add an emoji reaction to a message.',
        inputSchema: z.object({
          messageId: z.string().describe('The ID of the message to react to'),
          emoji: z.string().describe('The emoji to react with (e.g. "thumbsup")'),
        }),
        execute: async ({ messageId, emoji }, context) => {
          const { adapter, threadId } = this.getAdapterFromContext(context);
          await adapter.addReaction(threadId, messageId, emoji);
          return { ok: true };
        },
      }),

      remove_reaction: createTool({
        id: 'remove_reaction',
        description: 'Remove an emoji reaction from a message.',
        inputSchema: z.object({
          messageId: z.string().describe('The ID of the message to remove reaction from'),
          emoji: z.string().describe('The emoji to remove'),
        }),
        execute: async ({ messageId, emoji }, context) => {
          const { adapter, threadId } = this.getAdapterFromContext(context);
          await adapter.removeReaction(threadId, messageId, emoji);
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

const MAX_RESULT_LENGTH = 300;

/**
 * Strip known prefixes from tool names for cleaner display.
 * e.g. "mastra_workspace_list_files" → "list_files"
 */
const TOOL_PREFIXES = ['mastra_workspace_'];

function stripToolPrefix(name: string): string {
  for (const prefix of TOOL_PREFIXES) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

const MAX_ARG_SUMMARY_LENGTH = 40;

/**
 * Build a compact summary of tool arguments for display in the card title.
 * Shows only the first meaningful argument value, truncated.
 * e.g. "." for list_files, "ls -la" for execute_command.
 */
function formatArgsSummary(args: unknown): string {
  try {
    const obj = typeof args === 'string' ? JSON.parse(args) : args;
    if (!obj || typeof obj !== 'object') return '';

    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([key, val]) => key !== '__mastraMetadata' && val != null && val !== false && val !== '',
    );
    if (entries.length === 0) return '';

    const [, first] = entries[0]!;
    let display = typeof first === 'string' ? first : JSON.stringify(first);
    if (display.length > MAX_ARG_SUMMARY_LENGTH) {
      display = display.slice(0, MAX_ARG_SUMMARY_LENGTH) + '…';
    }
    return display;
  } catch {
    return '';
  }
}

/**
 * Format a tool result for display. Truncates long output.
 */
function formatResult(result: unknown, isError?: boolean): string {
  const prefix = isError ? 'Error: ' : '';
  if (result == null) return `${prefix}(no output)`;
  let text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  text = text.trim();
  if (text.length > MAX_RESULT_LENGTH) {
    text = text.slice(0, MAX_RESULT_LENGTH) + '…';
  }
  return `${prefix}${text}`;
}

/**
 * Build a Card for a tool result.
 * Title = tool name, subtitle = first arg in inline code, body = result in code block.
 */
function buildToolResultCard(
  toolName: string,
  argsSummary: string,
  resultText: string,
  isError?: boolean,
): CardElement {
  const header = argsSummary ? `**${toolName}** \`${argsSummary}\`` : `**${toolName}**`;
  const resultBody = isError ? resultText : `\`\`\`\n${resultText}\n\`\`\``;
  return Card({
    children: [CardText(header), CardText(resultBody, { style: isError ? 'bold' : 'plain' })],
  });
}
