import { createMemoryState } from '@chat-adapter/state-memory';
import type { Adapter, CardElement, Message, StateAdapter, Thread } from 'chat';
import { Actions, Button, Card, CardText, Chat } from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import type {
  InputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessor,
  OutputProcessorOrWorkflow,
} from '../processors';
import { isProcessorWorkflow } from '../processors';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';
import type { MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools/tool';

import {
  buildToolResultCard,
  ChatChannelProcessor,
  formatArgsSummary,
  formatResult,
  stripToolPrefix,
} from './processor';
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
      concurrency: { strategy: 'queue' },
    });

    const handler = (sdkThread: Thread, message: Message) => this.handleChatMessage(sdkThread, message, mastra);

    chat.onDirectMessage(handler);
    chat.onNewMention(handler);
    chat.onSubscribedMessage(handler);

    // Tool approval buttons — id is "tool_approve:<toolCallId>" or "tool_deny:<toolCallId>"
    chat.onAction(async event => {
      const { actionId } = event;
      if (!actionId.startsWith('tool_approve:') && !actionId.startsWith('tool_deny:')) return;
      try {
        const approved = actionId.startsWith('tool_approve:');
        const toolCallId = actionId.split(':')[1];

        // In Slack DMs, event.thread points to the approval card message rather
        // than the top-level conversation, which can cause sub-threading.
        // This is a known Slack adapter limitation.
        const sdkThread = event.thread as Thread | null;
        if (!sdkThread) {
          this.log('info', `No thread in action event for toolCallId=${toolCallId}`);
          return;
        }
        const platform = event.adapter.name;
        const messageId = event.messageId;
        const adapter = this.adapters[platform];
        if (!adapter) throw new Error(`No adapter for platform "${platform}"`);

        // Look up the Mastra thread to find the runId and tool metadata from pending approvals
        // Note: In Slack DMs, sdkThread.id may point to the card message, not the conversation.
        // We use sdkThread.channelId as the stable identifier for DMs.
        const externalThreadId = sdkThread.isDM ? sdkThread.channelId : sdkThread.id;
        const mastraThread = await this.getOrCreateThread({
          externalThreadId,
          channelId: sdkThread.channelId,
          platform,
          resourceId: `${platform}:${event.user.userId}`,
          mastra,
        });

        // Find the runId from pendingToolApprovals in message history
        const storage = mastra.getStorage();
        const memoryStore = storage ? await storage.getStore('memory') : undefined;
        if (!memoryStore) {
          throw new Error('Storage is required for tool approval lookups');
        }

        const { messages } = await memoryStore.listMessages({
          threadId: mastraThread.id,
          perPage: 50,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        // Search for the pendingToolApprovals metadata containing our toolCallId
        let runId: string | undefined;
        let toolName: string | undefined;
        let toolArgs: Record<string, unknown> | undefined;
        for (const msg of messages) {
          const pending = msg.content?.metadata?.pendingToolApprovals as
            | Record<string, { toolCallId: string; runId: string; toolName: string; args: Record<string, unknown> }>
            | undefined;
          if (pending) {
            for (const toolData of Object.values(pending)) {
              if (toolData.toolCallId === toolCallId) {
                runId = toolData.runId;
                toolName = toolData.toolName;
                toolArgs = toolData.args;
                break;
              }
            }
            if (runId) break;
          }
        }

        if (!runId) {
          this.log('info', `No pending approval found for toolCallId=${toolCallId}`);
          return;
        }

        // Build the card header with tool name and args
        const displayName = toolName ? stripToolPrefix(toolName) : 'tool';
        const argsSummary = toolArgs ? formatArgsSummary(toolArgs) : '';
        const header = argsSummary ? `*${displayName}* \`${argsSummary}\`` : `*${displayName}*`;

        if (!approved) {
          const isDM = sdkThread.isDM;
          const suffix = isDM ? '' : ` by ${event.user.fullName || event.user.userName || 'User'}`;
          try {
            await adapter.editMessage(
              sdkThread.id,
              messageId,
              Card({ children: [CardText(`${header} ✗`), CardText(`✗ Denied${suffix}`)] }),
            );
          } catch {
            // best-effort
          }
          return;
        }

        // Immediately edit the card to show "Approved" and remove the buttons
        try {
          await adapter.editMessage(
            sdkThread.id,
            messageId,
            Card({ children: [CardText(`${header} ⋯`), CardText(`✓ Approved`)] }),
          );
        } catch {
          // best-effort — continue with the stream even if edit fails
        }

        // Build request context for the resumed stream
        const requestContext = new RequestContext();
        requestContext.set('channel', {
          platform,
          eventType: 'action',
          isDM: sdkThread.isDM,
          threadId: sdkThread.id,
          channelId: sdkThread.channelId,
          messageId,
          userId: event.user.userId,
          userName: event.user.fullName || event.user.userName,
        } satisfies ChannelContext);
        // Resume the agent stream BEFORE editing the card —
        // if the snapshot is gone (e.g. duplicate click), we bail without mangling the card
        const resumedStream = await this.agent.approveToolCall({
          runId,
          toolCallId,
          requestContext,
        });

        await this.consumeAgentStream(
          resumedStream,
          sdkThread,
          platform,
          toolCallId ? { toolCallId, messageId } : undefined,
        );
      } catch (err) {
        const isStaleApproval = err instanceof Error && err.message.includes('No snapshot found');
        if (isStaleApproval) {
          this.log('info', `Ignoring stale tool approval action (runId already consumed)`);
          return;
        }
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
   * Returns channel input processors (e.g. system prompt injection).
   * Skips if the user already added a processor with the same id.
   */
  getInputProcessors(configuredProcessors: InputProcessorOrWorkflow[] = []): InputProcessor[] {
    const hasProcessor = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'chat-channel-context');
    if (hasProcessor) return [];
    return [new ChatChannelProcessor()];
  }

  /**
   * Returns channel output processors.
   * Currently none — all output rendering is handled by `consumeAgentStream`.
   */
  getOutputProcessors(_configuredProcessors: OutputProcessorOrWorkflow[] = []): OutputProcessor[] {
    return [];
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
      this.log('error', `[${sdkThread.adapter.name}] Error handling message`, JSON.stringify(message, null, 2), err);
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
    // In Slack DMs, sdkThread.id can vary (points to message threads), so use channelId as stable ID.
    const externalThreadId = sdkThread.isDM ? sdkThread.channelId : sdkThread.id;
    const mastraThread = await this.getOrCreateThread({
      externalThreadId,
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
      savePerStep: true,
      memory: {
        thread: mastraThread,
        resource: threadResourceId,
      },
    });

    await this.consumeAgentStream(stream, sdkThread, platform);

    // Subscribe so follow-up messages also get handled
    await sdkThread.subscribe();
  }

  /**
   * Consume the agent stream and render all chunks to the chat platform.
   *
   * Iterates the outer `fullStream` to handle all chunk types:
   * - `text-delta`: Accumulates text and posts when flushed.
   * - `tool-call`: Posts a "Running…" card eagerly.
   * - `tool-result`: Edits the "Running…" card with the result.
   * - `tool-call-approval`: Edits the card to show Approve/Deny buttons.
   * - `step-finish` / `finish`: Flushes accumulated text.
   */
  private async consumeAgentStream(
    stream: MastraModelOutput,
    sdkThread: Thread,
    platform: string,
    approvalContext?: { toolCallId: string; messageId: string },
  ): Promise<void> {
    const adapter = this.adapters[platform]!;
    const adapterConfig = this.adapterConfigs[platform];

    // Per-stream rendering state
    let textBuffer = '';
    let typingStarted = false;
    interface TrackedTool {
      displayName: string;
      argsSummary: string;
      startedAt: number;
      messageId?: string; // platform message ID for editing
    }
    const toolCalls = new Map<string, TrackedTool>();

    // Pre-seed the approved tool so its result can edit the approval card
    if (approvalContext) {
      toolCalls.set(approvalContext.toolCallId, {
        displayName: '',
        argsSummary: '',
        startedAt: Date.now(),
        messageId: approvalContext.messageId,
      });
    }

    const ensureTyping = async () => {
      if (!typingStarted) {
        typingStarted = true;
        await sdkThread.startTyping();
      }
    };

    const flushText = async () => {
      if (textBuffer.trim()) {
        await sdkThread.post(textBuffer);
        textBuffer = '';
      }
    };

    for await (const chunk of stream.fullStream) {
      // --- Text accumulation ---
      if (chunk.type === 'text-delta') {
        if (chunk.payload.text) await ensureTyping();
        textBuffer += chunk.payload.text;
        continue;
      }

      if (chunk.type === 'reasoning-delta') {
        await ensureTyping();
        continue;
      }

      // --- Text flush triggers ---
      if (chunk.type === 'step-finish' || chunk.type === 'finish') {
        await flushText();
        continue;
      }

      // --- Tool call: post eager "Running…" card ---
      if (chunk.type === 'tool-call') {
        if (this.channelToolNames.has(chunk.payload.toolName)) continue;
        await ensureTyping();
        await flushText();

        const displayName = stripToolPrefix(chunk.payload.toolName);
        const rawArgs = (
          typeof chunk.payload.args === 'object' && chunk.payload.args != null ? chunk.payload.args : {}
        ) as Record<string, unknown>;
        const argsSummary = formatArgsSummary(rawArgs);

        let messageId: string | undefined;
        if (!adapterConfig?.formatToolCall) {
          const sentMessage = await sdkThread.post(
            Card({
              children: [CardText(argsSummary ? `*${displayName}* \`${argsSummary}\` ⋯` : `*${displayName}* ⋯`)],
            }),
          );
          messageId = sentMessage?.id;
        }

        toolCalls.set(chunk.payload.toolCallId, {
          displayName,
          argsSummary,
          startedAt: Date.now(),
          messageId,
        });
        continue;
      }

      // --- Tool result: edit the "Running…" card with the outcome ---
      if (chunk.type === 'tool-result') {
        if (this.channelToolNames.has(chunk.payload.toolName)) continue;

        const tracked = toolCalls.get(chunk.payload.toolCallId);
        const displayName = tracked?.displayName || stripToolPrefix(chunk.payload.toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(chunk.payload.args ?? {});
        const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
        const channelMsgId = tracked?.messageId;
        const durationMs = tracked?.startedAt != null ? Date.now() - tracked.startedAt : undefined;

        if (adapterConfig?.formatToolCall) {
          const custom = adapterConfig.formatToolCall({
            toolName: displayName,
            args: (chunk.payload.args ?? {}) as Record<string, unknown>,
            result: chunk.payload.result,
            isError: chunk.payload.isError,
          });
          if (custom != null) {
            if (channelMsgId) {
              try {
                await adapter.editMessage(sdkThread.id, channelMsgId, custom);
              } catch {
                await sdkThread.post(custom);
              }
            } else {
              await sdkThread.post(custom);
            }
          }
        } else {
          const resultCard = buildToolResultCard(
            displayName,
            argsSummary,
            resultText,
            chunk.payload.isError,
            durationMs,
          );
          if (channelMsgId) {
            try {
              await adapter.editMessage(sdkThread.id, channelMsgId, resultCard);
            } catch {
              await sdkThread.post(resultCard);
            }
          } else {
            await sdkThread.post(resultCard);
          }
        }
        continue;
      }

      // --- Tool approval: edit the "Running…" card to show Approve/Deny ---
      if (chunk.type === 'tool-call-approval') {
        const { toolCallId, toolName, args: toolArgs } = chunk.payload;
        const tracked = toolCalls.get(toolCallId);
        const displayName = tracked?.displayName || stripToolPrefix(toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(toolArgs);
        const channelMsgId = tracked?.messageId;

        const header = argsSummary ? `*${displayName}* \`${argsSummary}\`` : `*${displayName}*`;
        const approvalCard = Card({
          children: [
            CardText(header),
            CardText('Requires approval to run.'),
            Actions([
              Button({ id: `tool_approve:${toolCallId}`, label: 'Approve', style: 'primary' }),
              Button({ id: `tool_deny:${toolCallId}`, label: 'Deny', style: 'danger' }),
            ]),
          ],
        });

        if (channelMsgId) {
          try {
            await adapter.editMessage(sdkThread.id, channelMsgId, approvalCard);
          } catch {
            await sdkThread.post(approvalCard);
          }
        } else {
          await sdkThread.post(approvalCard);
        }
        continue;
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
    const RETRY_DELAY = 5000;

    const reconnect = async () => {
      while (true) {
        try {
          let resolve: () => void;
          let reject: (err: unknown) => void;
          const done = new Promise<void>((res, rej) => {
            resolve = res;
            reject = rej;
          });
          await startGateway(
            {
              waitUntil: (p: Promise<unknown>) => {
                void p.then(
                  () => resolve!(),
                  err => reject!(err),
                );
              },
            },
            DURATION,
          );
          await done;
          this.log('info', `[${name}] Gateway session ended, reconnecting...`);
        } catch (err) {
          this.log('error', `[${name}] Gateway error, retrying in ${RETRY_DELAY / 1000}s`, err);
          await new Promise(r => setTimeout(r, RETRY_DELAY));
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
