import type {
  ActionEvent,
  Adapter,
  Author,
  Chat,
  ChatConfig,
  Message,
  ReactionEvent,
  StateAdapter,
  Thread,
} from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { AgentSignalContents } from '../agent/signals';
import type { AgentThreadSubscription } from '../agent/types';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import type { InputProcessor, InputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';
import type { AgentChunkType } from '../stream/types';
import { createTool } from '../tools/tool';
import { runStaticDriver } from './chat-driver-static';
import { runStreamingDriver } from './chat-driver-streaming';
import { getChatModule } from './chat-lazy';
import { resolveSlackTopLevelThreadId } from './compat/slack';

import { formatArgsSummary, formatToolApproved, formatToolDenied, stripToolPrefix } from './formatting';
import {
  buildInlineMediaCheck,
  extractUrls,
  findInlineLinkRule,
  headContentType,
  normalizeInlineLinks,
} from './inline-media';
import type { InlineLinkRule } from './inline-media';
import { ChatChannelProcessor } from './processor';
import { MastraStateAdapter } from './state-adapter';
import type { PendingApprovalRecord } from './stream-helpers';
import type {
  ActionHandlerResult,
  ApprovalSource,
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelContext,
  ChannelHandlers,
  PostableMessage,
  StreamingConfig,
  ThreadHistoryMessage,
  ToolDisplay,
  ToolDisplayFn,
} from './types';
import { defaultTypingStatus } from './typing-status';
import type { TypingStatusContext, TypingStatusFn } from './typing-status';

/**
 * Manages a single Chat SDK instance for an agent, wiring all adapters
 * to the Mastra pipeline (thread mapping → agent.stream → thread.post).
 *
 * One AgentChannels = one bot identity across multiple platforms.
 *
 * @internal Created automatically by the Agent when `channels` config is provided.
 */
export class AgentChannels {
  readonly adapters: Record<string, Adapter>;
  private chat: Chat | null = null;
  /** Stored initialization promise so webhook handlers can await readiness on serverless cold starts. */
  private initPromise: Promise<void> | null = null;
  private agent!: Agent<any, any, any, any>;
  private mastra?: Mastra;
  private logger?: IMastraLogger;
  private customState: StateAdapter | undefined;
  private stateAdapter!: StateAdapter;
  private userName: string;
  /** Normalized per-adapter configs (gateway flags, hooks, etc.). */
  private adapterConfigs: Record<string, ChannelAdapterConfig>;
  /** Handler overrides from config. */
  private handlerOverrides: ChannelHandlers;
  /** Additional Chat SDK options. */
  private chatOptions: Omit<ChatConfig, 'adapters' | 'state' | 'userName'>;
  /** Thread context config for fetching prior messages. */
  private threadContext: { maxMessages?: number };
  /** Determines whether a mime type should be sent inline to the model. */
  private shouldInline: (mimeType: string) => boolean;
  /** Inline-link rules for promoting URLs in message text to file parts. */
  private inlineLinkRules: InlineLinkRule[] | undefined;
  /** Whether channel tools (reactions, etc.) are enabled. */
  private toolsEnabled: boolean;
  /**
   * The original `ChannelConfig` passed to the constructor.
   *
   * Useful for rebuilding `AgentChannels` while preserving existing adapters/handlers,
   * e.g. when a `ChannelProvider` wants to inject its own adapter without clobbering
   * adapters configured by the agent author:
   *
   * @example
   * ```ts
   * const existing = agent.getChannels();
   * existing?.close();
   * const next = new AgentChannels({
   *   ...existing?.channelConfig,
   *   adapters: { ...existing?.channelConfig.adapters, slack: slackAdapter },
   * });
   * agent.setChannels(next);
   * ```
   */
  public readonly channelConfig: ChannelConfig;
  /** Channel tool names whose effects are already visible on the platform (skip rendering cards). */
  private channelToolNames!: Set<string>;
  /** Platforms whose routes are managed externally (e.g., by SlackProvider). */
  private externallyManagedPlatforms: Set<string> = new Set();
  /**
   * Per-Mastra-thread subscriptions. We lazily open one `agent.subscribeToThread()` per channel
   * thread on the first message we route through it, so any signals we send (and any signals
   * other callers send to the same thread) are rendered exactly once to the platform. The
   * subscription stays open until `close()` is called or the consumer errors out — we don't
   * eagerly subscribe at startup because the per-thread chunk consumer needs the `chatThread`
   * handle, which only exists after a platform event arrives.
   */
  private threadSubscriptions = new Map<
    string,
    {
      subscription: AgentThreadSubscription<any>;
      consumer: Promise<void>;
    }
  >();
  /**
   * Tool-approval cards that have been clicked and are about to be resumed via `approveToolCall` /
   * `declineToolCall`. The resumed run's `tool-result` chunks arrive through the thread
   * subscription consumer rather than the click handler, so we stash the approval card's
   * platform `messageId` (plus the tool's display metadata) here for the consumer to pick up
   * when it renders the result. Entries are removed as soon as the consumer consumes them.
   */
  private pendingApprovalCards = new Map<string, PendingApprovalRecord>();

  /**
   * Platforms we've already warned about for misconfigured `toolDisplay` (e.g.
   * `'timeline'` without `streaming: true`). Keeps log output to one warn per
   * platform per AgentChannels instance.
   */
  private warnedToolDisplayFallback = new Set<string>();

  constructor(config: ChannelConfig) {
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
    this.handlerOverrides = config.handlers ?? {};
    this.customState = config.state;
    this.userName = config.userName ?? 'Mastra';
    this.chatOptions = config.chatOptions ?? {};
    this.threadContext = config.threadContext ?? {};
    this.shouldInline = buildInlineMediaCheck(config.inlineMedia);
    this.inlineLinkRules = normalizeInlineLinks(config.inlineLinks);
    this.toolsEnabled = config.tools !== false;
    this.channelConfig = config;
    this.channelToolNames = new Set(Object.keys(this.getTools()));
  }

  /**
   * Bind this AgentChannels to its owning agent. Called by Agent constructor.
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
   * Register an adapter dynamically.
   * When `managesRoutes` is true, AgentChannels will NOT create webhook routes for this platform
   * (the ChannelProvider handles routing and calls handleWebhookEvent directly).
   * @internal
   */
  __registerAdapter(
    platform: string,
    adapter: Adapter,
    config?: ChannelAdapterConfig,
    options?: { managesRoutes?: boolean },
  ): void {
    if (this.adapters[platform]) {
      if (options?.managesRoutes) {
        this.externallyManagedPlatforms.add(platform);
      }
      return;
    }
    this.adapters[platform] = adapter;
    this.adapterConfigs[platform] = config ?? { adapter };
    if (options?.managesRoutes) {
      this.externallyManagedPlatforms.add(platform);
    }
  }

  /**
   * Check if an adapter is registered for the given platform.
   */
  hasAdapter(platform: string): boolean {
    return platform in this.adapters;
  }

  /**
   * Get the underlying Chat SDK instance.
   * Available after Mastra initialization. Use this to register additional
   * event handlers or access adapter-specific methods.
   *
   * @example
   * ```ts
   * agent.channels.sdk.onReaction((thread, reaction) => {
   *   console.log('Reaction received:', reaction);
   * });
   * ```
   */
  get sdk(): Chat | null {
    return this.chat;
  }

  /**
   * Initialize the Chat SDK, register handlers, and start gateway listeners.
   * Called by Mastra.addAgent after the server is ready.
   */
  async initialize(mastra: Mastra): Promise<void> {
    if (this.chat) return;
    if (this.initPromise) {
      return this.initPromise;
    }

    this.mastra = mastra;
    this.initPromise = (async () => {
      // Resolve state adapter: custom > Mastra storage > in-memory fallback
      if (this.customState) {
        this.stateAdapter = this.customState;
      } else {
        const storage = mastra.getStorage();
        const memoryStore = storage ? await storage.getStore('memory') : undefined;
        if (!memoryStore) {
          throw new Error(
            'Channels require storage to be configured on the Mastra instance. Configure a storage provider like LibSQLStore.',
          );
        }
        this.stateAdapter = new MastraStateAdapter(memoryStore);
        this.log('info', 'Using MastraStateAdapter (subscriptions persist across restarts)');
      }

      const { Chat } = await getChatModule();
      const chat = new Chat({
        adapters: this.adapters,
        state: this.stateAdapter,
        userName: this.userName,
        concurrency: { strategy: 'queue' },
        ...this.chatOptions,
      });

      // Default handler that routes messages to the agent
      const defaultHandler = (chatThread: Thread, message: Message) =>
        this.handleChatMessage(chatThread, message, mastra);

      // Register handlers with optional overrides
      const { onDirectMessage, onMention, onSubscribedMessage, onAction, onReaction } = this.handlerOverrides;

      if (onDirectMessage !== false) {
        chat.onDirectMessage((thread, message) => {
          if (typeof onDirectMessage === 'function') {
            return onDirectMessage(thread, message, defaultHandler);
          }
          return defaultHandler(thread, message);
        });
      }

      if (onMention !== false) {
        chat.onNewMention((thread, message) => {
          if (typeof onMention === 'function') {
            return onMention(thread, message, defaultHandler);
          }
          return defaultHandler(thread, message);
        });
      }

      if (onSubscribedMessage !== false) {
        chat.onSubscribedMessage((thread, message) => {
          if (typeof onSubscribedMessage === 'function') {
            return onSubscribedMessage(thread, message, defaultHandler);
          }
          return defaultHandler(thread, message);
        });
      }

      if (onAction !== false) {
        chat.onAction(async event => {
          if (typeof onAction === 'function') {
            await onAction(event, () => this.defaultActionHandler(event));
            return;
          }
          await this.defaultActionHandler(event);
        });
      }

      if (onReaction !== false) {
        chat.onReaction(async event => {
          if (typeof onReaction === 'function') {
            await onReaction(event, async () => {});
          }
        });
      }
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
    })();

    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  /**
   * Returns API routes for receiving webhook events from each adapter.
   * One POST route per adapter at `/api/agents/{agentId}/channels/{platform}/webhook`.
   * Skips platforms that are externally managed (e.g., by SlackProvider).
   */
  getWebhookRoutes(): ApiRoute[] {
    if (!this.agent) return [];

    const agentId = this.agent.id;
    const routes: ApiRoute[] = [];

    for (const platform of Object.keys(this.adapters)) {
      // Skip platforms where routes are managed externally (e.g., SlackProvider)
      if (this.externallyManagedPlatforms.has(platform)) {
        continue;
      }
      const self = this;
      routes.push({
        path: `/api/agents/${agentId}/channels/${platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        _mastraInternal: true,
        cors: this.adapterConfigs[platform]?.cors,
        createHandler: async () => {
          return async c => {
            // Await initialization to handle serverless cold starts where
            // the first request arrives before initialize() completes.
            if (self.initPromise) {
              try {
                await self.initPromise;
              } catch {
                return c.json({ error: 'Chat initialization failed' }, 503);
              }
            }

            const sdkInstance = self.chat;
            if (!sdkInstance) {
              return c.json({ error: 'Chat not initialized' }, 503);
            }
            // `webhooks` is an internal Chat SDK property (not in public typings)
            const webhookHandler = (sdkInstance as any).webhooks?.[platform] as Function | undefined;
            if (!webhookHandler) {
              return c.json({ error: `No webhook handler for ${platform}` }, 404);
            }

            // Pass platform execution context (e.g. Vercel/Cloudflare waitUntil)
            // to the Chat SDK so background processing survives serverless responses.
            // Hono's `executionCtx` getter throws in Node.js when no ExecutionContext exists.
            let execCtx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
            try {
              execCtx = c.executionCtx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
            } catch {
              execCtx = undefined;
            }
            const waitUntilFn = execCtx?.waitUntil?.bind(execCtx);
            return webhookHandler(c.req.raw, waitUntilFn ? { waitUntil: waitUntilFn } : undefined);
          };
        },
      });
    }

    return routes;
  }

  /**
   * Handle a webhook event from an external source (e.g., SlackProvider).
   * Use this when a ChannelProvider manages its own routes but wants AgentChannels
   * to process the actual message handling (threading, agent responses, etc.).
   *
   * @param platform - The platform name (e.g., 'slack')
   * @param request - The raw HTTP request
   * @param options - Optional execution context for serverless environments
   * @returns The response from the Chat SDK webhook handler
   */
  async handleWebhookEvent(
    platform: string,
    request: Request,
    options?: { waitUntil?: (p: Promise<unknown>) => void },
  ): Promise<Response> {
    // Ensure initialization is complete
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch {
        return new Response(JSON.stringify({ error: 'Channel initialization failed' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const sdkInstance = this.chat;
    if (!sdkInstance) {
      return new Response(JSON.stringify({ error: 'Chat not initialized' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Access the internal webhook handler from Chat SDK
    const webhookHandler = (sdkInstance as any).webhooks?.[platform] as Function | undefined;
    if (!webhookHandler) {
      return new Response(JSON.stringify({ error: `No webhook handler for ${platform}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return webhookHandler(request, options);
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
   * Returns generic channel tools (send_message, add_reaction, etc.)
   * that resolve the target adapter from the current request context.
   */
  getTools(): Record<string, unknown> {
    if (!this.toolsEnabled) return {};
    return this.makeChannelTools();
  }

  /**
   * Tear down all live thread subscriptions opened by this AgentChannels. Safe to call
   * multiple times. Useful for tests and for graceful shutdown of long-lived processes —
   * each cached subscription holds a handler in the agent's thread-stream runtime that
   * would otherwise stay registered for the lifetime of the process.
   */
  close(): void {
    for (const entry of this.threadSubscriptions.values()) {
      try {
        entry.subscription.unsubscribe();
      } catch (err) {
        this.log('debug', 'Failed to unsubscribe thread subscription', err);
      }
    }
    this.threadSubscriptions.clear();
    this.pendingApprovalCards.clear();
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
   * Derive the three per-event shapes we hand off to downstream systems from one set of
   * inputs. Keeping this in one place ensures the LLM (`attributes`), input processors
   * (`requestContext`), and memory (`metadata`) all see consistent author / thread facts.
   *
   *   - `channelContext` — goes on `requestContext` under the 'channel' key, consumed by
   *     `ChatChannelProcessor` and other input processors.
   *   - `attributes` — serialized as XML on the signal element the LLM sees (e.g. on
   *     `<user-message messageId=... authorId=... />`). Strings only.
   *   - `providerOptions` — written to the stored message's `content.providerMetadata`
   *     under `mastra.channels.<platform>` so UI/query callers can read author/channel
   *     facts off the message (e.g. show a Slack icon + author name) without unpacking
   *     the signal envelope. The LLM ignores `providerOptions.mastra.*` since only
   *     provider-keyed entries (openai, anthropic, …) are forwarded to the model.
   */
  private buildEventContext(params: {
    chatThread: Thread;
    platform: string;
    eventType: string;
    messageId: string | undefined;
    actor: { userId: string; userName?: string; fullName?: string; isBot?: boolean | 'unknown' };
  }): {
    channelContext: ChannelContext;
    attributes: Record<string, string | undefined>;
    providerOptions: MastraProviderMetadata;
  } {
    const { chatThread, platform, eventType, messageId, actor } = params;
    const adapter = this.adapters[platform]!;
    const botUserId = adapter.botUserId;
    const botMention = botUserId ? chatThread.mentionUser(botUserId) : undefined;
    const actorName = actor.fullName || actor.userName;
    const actorMention = actor.userId ? chatThread.mentionUser(actor.userId) : undefined;

    const channelContext: ChannelContext = {
      platform,
      eventType,
      isDM: chatThread.isDM,
      threadId: chatThread.id,
      channelId: chatThread.channelId,
      messageId,
      userId: actor.userId,
      userName: actorName,
      botUserId,
      botUserName: adapter.userName,
      botMention,
    };

    // Attributes: short, flat, strings only — they're rendered as XML attrs on the signal.
    // In DMs the author is stable for the whole conversation (already in the system message),
    // so we keep this minimal to avoid noise on every turn.
    const attributes: Record<string, string | undefined> = { messageId };
    if (!chatThread.isDM) {
      attributes.authorName = actorName;
      attributes.authorId = actor.userId;
      attributes.authorMention = actorMention;
      if (actor.isBot) attributes.isBot = 'true';
    }

    const providerOptions: MastraProviderMetadata = {
      mastra: {
        channels: {
          [platform]: {
            ...(messageId !== undefined ? { messageId } : {}),
            author: {
              userId: actor.userId,
              ...(actor.userName !== undefined ? { userName: actor.userName } : {}),
              ...(actor.fullName !== undefined ? { fullName: actor.fullName } : {}),
              ...(actorMention !== undefined ? { mention: actorMention } : {}),
              ...(actor.isBot !== undefined ? { isBot: actor.isBot } : {}),
            },
          },
        },
      },
    };

    return { channelContext, attributes, providerOptions };
  }

  /**
   * Resolve the external thread id to use when looking up a Mastra thread for
   * a tool-approval flow. Dispatches to per-platform compat shims that work
   * around quirks in how adapters surface threading on inbound action events.
   * Add new platform branches here as their compat shims land in `./compat/*`.
   */
  private resolveExternalThreadId(params: { platform: string; chatThread: Thread; messageId?: string }): string {
    const { platform, chatThread, messageId } = params;
    const adapter = this.adapters[platform];
    if (!adapter) return chatThread.id;

    switch (platform) {
      case 'slack':
        return (
          resolveSlackTopLevelThreadId({ platform, adapter, chatThreadId: chatThread.id, messageId }) ?? chatThread.id
        );
      default:
        return chatThread.id;
    }
  }

  /**
   * Resolve the `runId` for a suspended tool call by `toolCallId`.
   *
   * Prefers the in-memory `pendingApprovalCards` map (set when the approval
   * card was posted) because it's keyed by `toolCallId` and survives parallel
   * same-tool approvals. Falls back to the persisted `pendingToolApprovals`
   * metadata for cases where the bot restarted between card post and click
   * (the metadata path is lossy for parallel same-tool calls since core keys
   * those by `toolName` — only the latest survives).
   *
   * Returns `null` if no pending approval is found.
   */
  private async resolveApprovalRunId(params: {
    toolCallId: string;
    mastraThreadId: string;
    mastra: Mastra;
  }): Promise<{ runId: string; toolName: string; args: Record<string, unknown> } | null> {
    const { toolCallId, mastraThreadId, mastra } = params;

    const stashed = this.pendingApprovalCards.get(toolCallId);
    if (stashed?.runId) {
      return {
        runId: stashed.runId,
        toolName: stashed.toolName ?? '',
        args: stashed.args ?? {},
      };
    }

    const storage = mastra.getStorage();
    const memoryStore = storage ? await storage.getStore('memory') : undefined;
    if (!memoryStore) {
      throw new Error('Storage is required for tool approval lookups');
    }

    const { messages } = await memoryStore.listMessages({
      threadId: mastraThreadId,
      perPage: 50,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    for (const msg of messages) {
      const pending = msg.content?.metadata?.pendingToolApprovals as
        | Record<string, { toolCallId: string; runId: string; toolName: string; args: Record<string, unknown> }>
        | undefined;
      if (!pending) continue;
      for (const toolData of Object.values(pending)) {
        if (toolData.toolCallId === toolCallId) {
          return { runId: toolData.runId, toolName: toolData.toolName, args: toolData.args };
        }
      }
    }

    return null;
  }

  /**
   * Resume a suspended tool call.
   *
   * Used by both the built-in action handler (for `tool_approve:*` /
   * `tool_deny:*` clicks) and the public `approveTool` / `denyTool` methods.
   * Does NOT edit any UI — callers own message lifecycle.
   *
   * Silently returns (with a log message) if no pending approval is found for
   * the given `toolCallId` (e.g. stale click after bot restart, or the run
   * was already consumed).
   */
  private async resolveApprovalAndResume(params: {
    toolCallId: string;
    approved: boolean;
    chatThread: Thread;
    platform: string;
    actor: Author;
    messageId?: string;
  }): Promise<void> {
    const { toolCallId, approved, chatThread, platform, actor, messageId } = params;
    const mastra = this.mastra;
    if (!mastra) {
      this.log('warn', `approveTool/denyTool called before AgentChannels initialization`);
      return;
    }

    const adapter = this.adapters[platform];
    if (!adapter) {
      this.log('warn', `No adapter for platform "${platform}" — cannot resume tool approval`);
      return;
    }

    const externalThreadId = this.resolveExternalThreadId({ platform, chatThread, messageId });
    const mastraThread = await this.getOrCreateThread({
      externalThreadId,
      channelId: chatThread.channelId,
      platform,
      resourceId: `${platform}:${actor.userId}`,
      mastra,
    });

    const resolved = await this.resolveApprovalRunId({
      toolCallId,
      mastraThreadId: mastraThread.id,
      mastra,
    });

    if (!resolved) {
      this.log('info', `No pending approval found for toolCallId=${toolCallId}`);
      return;
    }

    const { runId } = resolved;
    const { channelContext } = this.buildEventContext({
      chatThread,
      platform,
      eventType: 'action',
      messageId,
      actor,
    });
    const requestContext = new RequestContext();
    requestContext.set('channel', channelContext);

    this.ensureThreadSubscription({
      mastraThreadId: mastraThread.id,
      resourceId: mastraThread.resourceId,
      chatThread,
      platform,
    });

    try {
      const resumed = approved
        ? await this.agent.approveToolCall({
            runId,
            toolCallId,
            requestContext,
            memory: { thread: mastraThread.id, resource: mastraThread.resourceId },
          })
        : await this.agent.declineToolCall({
            runId,
            toolCallId,
            requestContext,
            memory: { thread: mastraThread.id, resource: mastraThread.resourceId },
          });
      void resumed.consumeStream().catch(err => {
        this.log('error', `Error consuming resumed ${approved ? 'approval' : 'decline'} stream`, err);
      });
    } catch (err) {
      const isStaleApproval = err instanceof Error && err.message.includes('No snapshot found');
      if (isStaleApproval) {
        this.log('info', `Ignoring stale tool ${approved ? 'approval' : 'denial'} (runId already consumed)`);
        return;
      }
      throw err;
    } finally {
      if (!approved) {
        // Stash entry is no longer needed; the resumed decline stream
        // won't emit a tool-result for this call.
        this.pendingApprovalCards.delete(toolCallId);
      }
    }
  }

  /**
   * Built-in action handler for tool approval buttons.
   *
   * Handles `tool_approve:<toolCallId>` / `tool_deny:<toolCallId>` action IDs:
   * edits the card to show approved/denied, then resumes the suspended tool
   * via `agent.approveToolCall` / `agent.declineToolCall`.
   *
   * Returns `undefined` for any other action ID (custom `onAction` handlers
   * branch on `event.actionId` directly for their own IDs).
   */
  private async defaultActionHandler(event: ActionEvent): Promise<ActionHandlerResult | undefined> {
    const { actionId } = event;
    if (!actionId.startsWith('tool_approve:') && !actionId.startsWith('tool_deny:')) {
      return undefined;
    }

    const approved = actionId.startsWith('tool_approve:');
    const toolCallId = actionId.split(':')[1];
    if (!toolCallId) {
      this.log('info', `Missing toolCallId in action event actionId=${actionId}`);
      return undefined;
    }

    const chatThread = event.thread as Thread | null;
    if (!chatThread) {
      this.log('info', `No thread in action event for toolCallId=${toolCallId}`);
      return undefined;
    }

    const platform = event.adapter.name;
    const messageId = event.messageId;
    const adapter = this.adapters[platform];
    const adapterConfig = this.adapterConfigs[platform];
    if (!adapter) throw new Error(`No adapter for platform "${platform}"`);

    try {
      // Edit the approval card to show approved/denied (built-in UI). Users
      // who want to own UI should call `approveTool`/`denyTool` directly
      // from their own onAction override instead of delegating to this.
      const stashed = this.pendingApprovalCards.get(toolCallId);
      const displayName = stashed?.toolName ? stripToolPrefix(stashed.toolName) : 'tool';
      const argsSummary = stashed?.args ? formatArgsSummary(stashed.args) : '';
      const { resolved: toolDisplay } = this.resolveToolDisplay(
        platform,
        adapterConfig?.toolDisplay,
        false,
        adapterConfig?.cards,
        adapterConfig?.formatToolCall,
      );
      const useCards = toolDisplay === 'cards';

      if (approved) {
        try {
          await adapter.editMessage(chatThread.id, messageId, formatToolApproved(displayName, argsSummary, useCards));
        } catch (err) {
          this.log('debug', 'Failed to edit approved card', err);
        }

        // Stash messageId so the consumer can edit it in place when the
        // resumed tool-result chunk arrives via the thread subscription.
        this.pendingApprovalCards.set(toolCallId, {
          messageId,
          displayName,
          argsSummary,
          startedAt: Date.now(),
        });
      } else {
        const byUser = chatThread.isDM ? undefined : event.user.fullName || event.user.userName || 'User';
        try {
          await adapter.editMessage(
            chatThread.id,
            messageId,
            formatToolDenied(displayName, argsSummary, byUser, useCards),
          );
        } catch (err) {
          this.log('debug', 'Failed to edit denied card', err);
        }
      }

      await this.resolveApprovalAndResume({
        toolCallId,
        approved,
        chatThread,
        platform,
        actor: event.user,
        messageId,
      });

      return approved ? { kind: 'approved', toolCallId } : { kind: 'denied', toolCallId };
    } catch (err) {
      this.log('error', 'Error handling tool approval action', err);
      try {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const errorMessage = adapterConfig?.formatError
          ? adapterConfig.formatError(errorObj)
          : `❌ Error: ${errorObj.message}`;
        await chatThread.post(errorMessage);
      } catch (postErr) {
        this.log('debug', 'Failed to post error message for action', postErr);
      }
      return approved ? { kind: 'approved', toolCallId } : { kind: 'denied', toolCallId };
    }
  }

  /**
   * Programmatically approve a suspended tool call by `toolCallId`.
   *
   * Looks up the `runId` from the in-memory `pendingApprovalCards` map (or
   * falls back to the persisted `pendingToolApprovals` metadata) and resumes
   * the agent run. The resumed run's chunks fan into the existing thread
   * subscription so the consumer renders the tool result and follow-up output.
   *
   * Does NOT edit any UI — callers own message lifecycle. Pair with
   * `onAction` / `onReaction` overrides (or call from a workflow / scheduled
   * job) to build custom approval flows.
   *
   * Silently returns if no pending approval is found for the given
   * `toolCallId` (e.g. stale click, or the run was already consumed).
   *
   * @example
   * ```ts
   * // From an onReaction handler:
   * onReaction: async (event) => {
   *   const toolCallId = pendingApprovals.get(event.messageId);
   *   if (!toolCallId) return;
   *   if (event.emoji.name === 'white_check_mark') {
   *     await channels.approveTool(toolCallId, event);
   *   }
   * }
   * ```
   */
  async approveTool(toolCallId: string, source: ApprovalSource): Promise<void> {
    const normalized = this.normalizeApprovalSource(source);
    if (!normalized) {
      this.log('warn', `approveTool: no chatThread on source for toolCallId=${toolCallId}`);
      return;
    }
    await this.resolveApprovalAndResume({ toolCallId, approved: true, ...normalized });
  }

  /**
   * Programmatically deny a suspended tool call by `toolCallId`.
   *
   * Same semantics as {@link approveTool} but resumes with `approved: false`
   * so the agent can produce a follow-up message (e.g. acknowledging the
   * rejection) instead of staying suspended.
   */
  async denyTool(toolCallId: string, source: ApprovalSource): Promise<void> {
    const normalized = this.normalizeApprovalSource(source);
    if (!normalized) {
      this.log('warn', `denyTool: no chatThread on source for toolCallId=${toolCallId}`);
      return;
    }
    await this.resolveApprovalAndResume({ toolCallId, approved: false, ...normalized });
  }

  /**
   * Normalize an `ApprovalSource` (ActionEvent | ReactionEvent | manual form)
   * into the args `resolveApprovalAndResume` expects.
   *
   * Returns `null` if the source lacks a `chatThread` (e.g. view-based
   * ActionEvent from a home tab button) — those can't be resumed because we
   * have nowhere to fan the resumed stream into.
   */
  private normalizeApprovalSource(
    source: ApprovalSource,
  ): { chatThread: Thread; platform: string; actor: Author; messageId?: string } | null {
    if ('chatThread' in source) {
      return {
        chatThread: source.chatThread,
        platform: source.platform,
        actor: source.actor,
        ...(source.messageId !== undefined ? { messageId: source.messageId } : {}),
      };
    }
    // ActionEvent or ReactionEvent
    const evt = source as ActionEvent | ReactionEvent;
    const chatThread = evt.thread as Thread | null;
    if (!chatThread) return null;
    return {
      chatThread,
      platform: evt.adapter.name,
      actor: evt.user,
      ...(evt.messageId !== undefined ? { messageId: evt.messageId } : {}),
    };
  }

  /**
   * Core handler wired to Chat SDK's onDirectMessage, onNewMention,
   * and onSubscribedMessage. Streams the Mastra agent response and
   * updates the channel message in real-time via edits.
   */
  private async handleChatMessage(chatThread: Thread, message: Message, mastra: Mastra): Promise<void> {
    try {
      await this.processChatMessage(chatThread, message, mastra);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.log('error', `[${chatThread.adapter.name}] Error handling message`, {
        messageId: message.id,
        authorId: message.author?.userId,
        error: String(err),
      });
      try {
        const adapterConfig = this.adapterConfigs[chatThread.adapter.name];
        const errorMessage = adapterConfig?.formatError
          ? adapterConfig.formatError(error)
          : `❌ Error: ${error.message}`;
        await chatThread.post(errorMessage);
      } catch (postErr) {
        this.log('debug', 'Failed to post error message to thread', postErr);
      }
    }
  }

  private async processChatMessage(chatThread: Thread, message: Message, mastra: Mastra): Promise<void> {
    const platform = chatThread.adapter.name;

    // Map to a Mastra thread for memory/history.
    // chatThread.id encodes channel + threadTs, so it's stable per conversation:
    // each Slack thread (including top-level DM, DM thread reply, channel mention, and
    // channel thread reply) gets its own mastra thread.
    const externalThreadId = chatThread.id;
    const mastraThread = await this.getOrCreateThread({
      externalThreadId,
      channelId: chatThread.channelId,
      platform,
      resourceId: `${platform}:${message.author.userId}`,
      mastra,
    });

    // Use the thread's resourceId for memory, not the current message author.
    // In multi-user threads (e.g. Slack channels), the thread is owned by whoever
    // started it. Other participants' messages are still part of that thread's history.
    const threadResourceId = mastraThread.resourceId;

    // Fetch recent thread history when configured, this is a non-DM mention,
    // AND the agent isn't already subscribed to this thread. If subscribed,
    // the agent already has history via Mastra's memory system.
    // History is prepended to the user message text (not as a separate message)
    // to avoid consecutive user messages which some providers reject (e.g. DeepSeek).
    let historyBlock: string | undefined; // TODO: convert platform thread chat history into Mastra messages instead of one big text block
    const maxMessages = this.threadContext.maxMessages ?? 10;
    if (maxMessages > 0 && !chatThread.isDM) {
      const alreadySubscribed = await chatThread.isSubscribed();
      if (!alreadySubscribed) {
        this.logger?.debug?.(`Fetching thread history (max ${maxMessages}) for first mention in ${chatThread.id}`);
        const history = await this.fetchThreadHistory(chatThread, message.id, maxMessages);
        this.logger?.debug?.(`Fetched ${history.length} messages from thread history`);
        if (history.length > 0) {
          const lines = ['[Thread context — messages in this thread before you joined]'];
          for (const msg of history) {
            const mention = msg.userId ? chatThread.mentionUser(msg.userId) : undefined;
            let prefix = mention ? (msg.author ? `${msg.author} (${mention})` : mention) : msg.author;
            if (msg.isBot) prefix += ' (bot)';
            lines.push(`[${prefix}] (msg:${msg.id}): ${msg.text}`);
          }
          historyBlock = lines.join('\n');
        }
      } else {
        this.logger?.debug?.(`Skipping thread history fetch — already subscribed to ${chatThread.id}`);
      }
    }

    const text = [historyBlock, message.text].filter(Boolean).join('\n\n');
    const parts: Exclude<AgentSignalContents, string> = [{ type: 'text', text }];
    const attachments = message.attachments.filter(a => a.url || a.fetchData);

    // Route attachments based on `inlineMedia` config (see DEFAULT_INLINE_MEDIA_TYPES).
    // Inline types are sent as file parts (the LLM adapter converts image/* to
    // image content automatically). Non-inline types are described as text
    // metadata so the agent is aware of them without crashing models that
    // reject unsupported media (e.g. OpenAI rejects video/mp4).
    this.logger?.debug('[CHANNEL] Attachments', {
      count: attachments.length,
      attachments: attachments.map(a => ({
        type: a.type,
        mimeType: a.mimeType,
        url: a.url,
        hasData: !!a.fetchData,
      })),
    });
    for (const att of attachments) {
      if (!att.url && !att.fetchData) continue;
      const mimeType = att.mimeType || (att.type === 'image' ? 'image/png' : undefined);
      if (!mimeType) continue;

      const inline = this.shouldInline(mimeType);
      const filename = att.name || att.url?.split('/').pop() || 'file';
      if (inline) {
        let data: string | undefined;
        let fetchFailed = false;
        if (att.fetchData) {
          // Prefer authenticated fetch (e.g. Slack CDN requires auth)
          try {
            const buf = await att.fetchData();
            const base64 = Buffer.from(buf).toString('base64');
            data = `data:${mimeType};base64,${base64}`;
          } catch (err) {
            this.logger?.warn('[CHANNEL] fetchData failed', { mimeType, error: String(err) });
            fetchFailed = true;
          }
        } else {
          // Public URL (e.g. Discord CDN) — let the provider fetch directly
          data = att.url;
        }
        if (data) {
          parts.push({
            type: 'text',
            text: `[Attached ${mimeType} file${att.name ? `: ${att.name}` : ''}]`,
          });
          parts.push({
            type: 'file',
            data,
            mediaType: mimeType,
            ...(att.name ? { filename: att.name } : {}),
          });
        } else if (fetchFailed) {
          parts.push({
            type: 'text',
            text: `[Attachment unavailable: ${filename} (${mimeType}) — the file could not be loaded, it may have been deleted before processing]`,
          });
        }
      } else {
        parts.push({
          type: 'text',
          text: `[Attached file: ${filename} (${mimeType})${att.url ? ` — ${att.url}` : ''}]`,
        });
      }
    }

    // Promote URLs in message text to file parts based on `inlineLinks` config.
    if (this.inlineLinkRules && text) {
      const urls = extractUrls(text);
      for (const url of urls) {
        const rule = findInlineLinkRule(url, this.inlineLinkRules);
        if (!rule) continue;

        if (rule.forcedMimeType) {
          // Object entry with forced mime type — skip HEAD, always promote.
          parts.push({ type: 'file', data: url, mediaType: rule.forcedMimeType });
        } else {
          // String entry — HEAD to determine Content-Type, then check inlineMedia.
          const contentType = await headContentType(url, this.logger);
          if (contentType && this.shouldInline(contentType)) {
            parts.push({ type: 'file', data: url, mediaType: contentType });
          }
        }
      }
    }

    // Route the message through the agent's signal pipeline. The subscription is opened
    // lazily on first message per Mastra thread so any signals — ours or others sent to the
    // same thread — render through a single consumer. sendSignal then either delivers the
    // message into an already-running agent loop or wakes the thread with an idle stream
    // using the same options we used to pass to agent.stream().
    const adapterConfig = this.adapterConfigs[platform];
    // Auto-approve suspended tools when there's no way to render an
    // approval card with buttons. Block Kit cards have buttons; plain
    // `'text'` mode has only a "reply approve/deny" hint with no
    // first-class affordance, so we auto-approve to avoid getting stuck.
    const { resolved: toolDisplay, fn: toolDisplayFn } = this.resolveToolDisplay(
      platform,
      adapterConfig?.toolDisplay,
      this.resolveStreaming(adapterConfig?.streaming).enabled,
      adapterConfig?.cards,
      adapterConfig?.formatToolCall,
    );
    const canRenderApprovalButtons =
      toolDisplayFn !== undefined ||
      toolDisplay === 'cards' ||
      toolDisplay === 'timeline' ||
      toolDisplay === 'grouped' ||
      toolDisplay === 'hidden';

    const { channelContext, attributes, providerOptions } = this.buildEventContext({
      chatThread,
      platform,
      eventType: chatThread.isDM ? 'message' : 'mention',
      messageId: message.id,
      actor: message.author,
    });

    const requestContext = new RequestContext();
    requestContext.set('channel', channelContext);

    this.ensureThreadSubscription({
      mastraThreadId: mastraThread.id,
      resourceId: threadResourceId,
      chatThread,
      platform,
    });

    // Subscribe BEFORE sending the signal so the subscription metadata write
    // happens before the agent run loads the thread snapshot. Otherwise the
    // in-flight agent run can read the thread pre-subscribe and later
    // overwrite the `channel_subscribed` field via its own thread persistence.
    await chatThread.subscribe();

    // Refresh the thread snapshot so the agent run sees the post-subscribe
    // metadata. Without this, `prepareMemoryStep`'s deepEqual would detect a
    // metadata mismatch and overwrite the freshly-written `channel_subscribed`
    // with the stale pre-subscribe value.
    const memoryStore = await mastra.getStorage()?.getStore('memory');
    const refreshedThread = memoryStore ? await memoryStore.getThreadById({ threadId: mastraThread.id }) : null;
    const threadForRun = refreshedThread ?? mastraThread;

    // When the message is text-only, pass the bare string to the signal pipeline.
    // Otherwise pass the parts array directly — both shapes match AgentSignalContents.
    const signalContents: AgentSignalContents = parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts;

    this.agent.sendSignal(
      {
        type: 'user-message',
        contents: signalContents,
        attributes,
        providerOptions,
      },
      {
        resourceId: threadResourceId,
        threadId: mastraThread.id,
        ifIdle: {
          behavior: 'wake',
          streamOptions: {
            requestContext,
            memory: {
              thread: threadForRun,
              resource: threadResourceId,
            },
            // Without approval-button rendering, auto-approve tools to
            // avoid getting stuck waiting for input we can't ask for.
            autoResumeSuspendedTools: canRenderApprovalButtons ? undefined : true,
          },
        },
      },
    );
  }

  /**
   * Fetch recent messages from the platform thread to provide context.
   * Returns messages in chronological order (oldest first), excluding the
   * current triggering message.
   */
  private async fetchThreadHistory(
    chatThread: Thread,
    currentMessageId: string,
    maxMessages: number,
  ): Promise<ThreadHistoryMessage[]> {
    const messages: ThreadHistoryMessage[] = [];

    try {
      // chatThread.messages is an async iterator that yields newest-first
      for await (const msg of chatThread.messages) {
        // Skip the current message that triggered this request
        if (msg.id === currentMessageId) continue;

        messages.push({
          id: msg.id,
          author: msg.author.fullName || msg.author.userName || 'Unknown',
          userId: msg.author.userId,
          text: msg.text,
          isBot: msg.author.isBot === true,
        });

        if (messages.length >= maxMessages) break;
      }
    } catch (err) {
      this.logger?.warn?.(`Failed to fetch thread history: ${err}`);
      return [];
    }

    // Reverse to get chronological order (oldest first)
    return messages.reverse();
  }

  /**
   * Lazily open (and cache) an `agent.subscribeToThread()` for a Mastra thread, attaching a
   * background chunk consumer that renders run output to the originating chat platform. We
   * cache by `mastraThreadId` so multiple incoming messages on the same thread share one
   * subscription and run output is never rendered twice.
   *
   * If the underlying consumer throws (e.g. the platform `chatThread` becomes unusable), we
   * tear down the cache entry so the next message can reopen a fresh subscription.
   */
  private ensureThreadSubscription(params: {
    mastraThreadId: string;
    resourceId: string;
    chatThread: Thread;
    platform: string;
  }): AgentThreadSubscription<any> {
    const { mastraThreadId, resourceId, chatThread, platform } = params;
    const existing = this.threadSubscriptions.get(mastraThreadId);
    if (existing) return existing.subscription;

    // subscribeToThread() is synchronous-ish (returns a Promise that resolves on the next
    // microtask); kicking it off here keeps the cache slot reserved so concurrent callers
    // for the same thread don't race to create duplicate subscriptions.
    const subscriptionPromise = this.agent.subscribeToThread({ resourceId, threadId: mastraThreadId });

    // Wrap the eventual async iterator in a passthrough so we can hand callers a synchronous
    // subscription record while the underlying handle is still resolving.
    const stream: AsyncIterable<AgentChunkType<any>> = {
      [Symbol.asyncIterator]: async function* () {
        const sub = await subscriptionPromise;
        for await (const chunk of sub.stream) {
          yield chunk;
        }
      },
    };

    const placeholder: AgentThreadSubscription<any> = {
      stream,
      activeRunId: () => null,
      abort: () => false,
      unsubscribe: () => {
        void subscriptionPromise.then(sub => sub.unsubscribe()).catch(() => {});
      },
    };

    const consumer = this.consumeAgentStream(stream, chatThread, platform).catch(err => {
      this.log('error', `[${platform}] Thread subscription consumer failed`, { error: err });
      // Drop the cache entry so subsequent messages reopen a fresh subscription.
      const entry = this.threadSubscriptions.get(mastraThreadId);
      if (entry?.subscription === placeholder) {
        this.threadSubscriptions.delete(mastraThreadId);
      }
      void subscriptionPromise.then(sub => sub.unsubscribe()).catch(() => {});
    });

    this.threadSubscriptions.set(mastraThreadId, { subscription: placeholder, consumer });
    // Update the placeholder with the real activeRunId/abort once the handle resolves so
    // callers that need them after the first tick get accurate values.
    void subscriptionPromise
      .then(sub => {
        placeholder.activeRunId = sub.activeRunId;
        placeholder.abort = sub.abort;
      })
      .catch(() => {});
    return placeholder;
  }

  private async consumeAgentStream(
    stream: AsyncIterable<AgentChunkType<any>>,
    chatThread: Thread,
    platform: string,
    approvalContext?: { toolCallId: string; messageId: string },
  ): Promise<void> {
    const adapter = this.adapters[platform]!;
    const adapterConfig = this.adapterConfigs[platform];
    const streaming = this.resolveStreaming(adapterConfig?.streaming);
    const { resolved: toolDisplay, fn: toolDisplayFn } = this.resolveToolDisplay(
      platform,
      adapterConfig?.toolDisplay,
      streaming.enabled,
      adapterConfig?.cards,
      adapterConfig?.formatToolCall,
    );

    // Seed the approval-card stash on resumed runs so the driver can resolve
    // `messageId` for the incoming `tool-result` even though it never saw the
    // pre-suspension `tool-call`.
    if (approvalContext) {
      this.pendingApprovalCards.set(approvalContext.toolCallId, {
        messageId: approvalContext.messageId,
        displayName: '',
        argsSummary: '',
        startedAt: Date.now(),
      });
    }

    // The streaming driver flips `typingGate.active = true` while a
    // StreamingPlan post is in flight; the typing-status wrapper reads it
    // and skips `startTyping` during that window.
    const typingGate = { active: false };
    const wrapped = this.withTypingStatus(stream, chatThread, platform, adapterConfig, typingGate);

    const onApprovalPosted = (toolCallId: string, record: PendingApprovalRecord) => {
      this.pendingApprovalCards.set(toolCallId, record);
    };
    const getPendingApproval = (id: string) => this.pendingApprovalCards.get(id);
    const takePendingApproval = (id: string) => {
      const r = this.pendingApprovalCards.get(id);
      if (r) this.pendingApprovalCards.delete(id);
      return r;
    };

    if (streaming.enabled) {
      await runStreamingDriver({
        stream: wrapped,
        chatThread,
        adapter,
        toolDisplay: toolDisplay as 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden',
        toolDisplayFn,
        streamingOptions: streaming.options,
        channelToolNames: this.channelToolNames,
        logger: this.logger,
        onApprovalPosted,
        getPendingApproval,
        takePendingApproval,
        typingGate,
        formatError: adapterConfig?.formatError,
      });
    } else {
      await runStaticDriver({
        stream: wrapped,
        chatThread,
        adapter,
        toolDisplay: toolDisplay as 'cards' | 'text' | 'hidden',
        toolDisplayFn,
        channelToolNames: this.channelToolNames,
        logger: this.logger,
        onApprovalPosted,
        getPendingApproval,
        takePendingApproval,
        formatError: adapterConfig?.formatError,
      });
    }
  }

  /**
   * Normalize the per-adapter `streaming` option (`boolean | { updateIntervalMs? }`)
   * into a flat `{ enabled, options }` shape so call-sites don't have to
   * re-derive both from the raw union.
   */
  private resolveStreaming(raw: StreamingConfig | undefined): {
    enabled: boolean;
    options?: { updateIntervalMs?: number };
  } {
    if (raw === undefined || raw === false) return { enabled: false };
    if (raw === true) return { enabled: true, options: {} };
    return { enabled: true, options: raw };
  }

  /**
   * Pass-through async generator that yields chunks unchanged but emits
   * typing-status updates (`startTyping`) along the way. Lives outside the
   * drivers so both drivers benefit from the same dedup + gate logic.
   *
   * The streaming driver flips `typingGate.active = true` while a
   * `StreamingPlan` post is in flight — Slack's `assistant.threads.setStatus`
   * (what `startTyping` maps to) only auto-clears on `chat.postMessage`, not
   * on `chat.stopStream`, so a status set during streaming would stick after
   * the run ends. The static driver leaves the gate `false` so typing works
   * normally in cards/hidden modes.
   */
  private async *withTypingStatus(
    stream: AsyncIterable<AgentChunkType<any>>,
    chatThread: Thread,
    platform: string,
    adapterConfig: ChannelAdapterConfig | undefined,
    typingGate: { active: boolean },
  ): AsyncGenerator<AgentChunkType<any>> {
    const typingStatusOption = adapterConfig?.typingStatus;
    const typingStatusFn: TypingStatusFn | null =
      typingStatusOption === false
        ? null
        : typeof typingStatusOption === 'function'
          ? typingStatusOption
          : defaultTypingStatus;

    let currentTypingStatus: string | undefined;

    for await (const chunk of stream) {
      if (typingStatusFn && !typingGate.active) {
        let result: ReturnType<TypingStatusFn>;
        try {
          const ctx: TypingStatusContext = {
            platform,
            threadId: chatThread.id,
            toolCalls: new Map(),
            currentStatus: currentTypingStatus,
            channelTools: this.channelToolNames,
          };
          result = typingStatusFn(chunk, ctx);
        } catch (e) {
          this.logger?.debug('[CHANNEL] typingStatus function threw (continuing)', { error: e });
          result = undefined;
        }
        if (typeof result === 'string' && result.length > 0 && result !== currentTypingStatus) {
          currentTypingStatus = result;
          chatThread.startTyping(result).catch(e => {
            this.logger?.debug('[CHANNEL] Typing indicator failed (best-effort)', { error: e });
          });
        }
      }
      // Reset the dedup state on run boundaries so the next run can re-emit
      // its first status even if it matches the previous run's last status.
      if (chunk.type === 'finish' || chunk.type === 'error' || chunk.type === 'abort') {
        currentTypingStatus = undefined;
      }
      yield chunk;
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

  /**
   * Resolve the tool-display mode for a run.
   *
   *  - `'timeline'` / `'grouped'` push `task_update` chunks into a streaming
   *    Plan widget, so they require `streaming: true`. Without streaming we
   *    fall back to `'cards'`.
   *  - `'cards'` posts discrete Block-Kit cards via `chatThread.post`/`edit`,
   *    which the streaming driver doesn't render (everything inside a
   *    `StreamingPlan` post is one message). With streaming enabled we fall
   *    back to `'timeline'`.
   *
   * Both fallbacks log a one-time warning per platform so the misconfiguration
   * is visible without spamming on every run.
   */
  private resolveToolDisplay(
    platform: string,
    requested: ToolDisplay | undefined,
    streamingEnabled: boolean,
    deprecatedCards?: boolean,
    deprecatedFormatToolCall?: (info: {
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
      isError?: boolean;
    }) => PostableMessage | null,
  ): { resolved: 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden'; fn?: ToolDisplayFn } {
    // Function form: drivers call the fn directly. The resolved mode is
    // the default `'cards'` — drivers use it only for any event the fn
    // doesn't render (returns `undefined`).
    let fn = typeof requested === 'function' ? requested : undefined;
    const requestedMode = typeof requested === 'function' ? undefined : requested;
    // Deprecated `cards: boolean` only applies when `toolDisplay` is not set
    // (in any form — string mode or function): `cards: true` → `'cards'`,
    // `cards: false` → `'text'`. The `@deprecated` JSDoc surfaces in IDEs so
    // we don't bother with a runtime warning. The discriminated union also
    // makes `cards` + `toolDisplay` a type error, but we still guard at
    // runtime so casts/JS callers don't get surprising fallback behavior
    // when the fn returns `undefined`.
    const fromDeprecatedCards =
      requested === undefined && deprecatedCards !== undefined ? (deprecatedCards ? 'cards' : 'text') : undefined;
    // Deprecated `formatToolCall` is shimmed into a `ToolDisplayFn`. The old
    // callback only fired on `tool-result`/`tool-error` and returned a
    // message (or `null` to skip), so the shim mirrors that contract: emit
    // `{ kind: 'post', message }` for those two events and `undefined` for
    // everything else so the built-in renderer handles the `running` /
    // `approval` events.
    if (!fn && deprecatedFormatToolCall) {
      fn = event => {
        if (event.kind !== 'result' && event.kind !== 'error') return undefined;
        const value = event.kind === 'result' ? event.result : event.error;
        const message = deprecatedFormatToolCall({
          toolName: event.toolName,
          args: (event.args ?? {}) as Record<string, unknown>,
          result: value,
          isError: event.kind === 'error' ? true : event.isError,
        });
        if (message == null) return undefined;
        return { kind: 'post', message };
      };
    }
    // Default is always `'cards'`: `'timeline'`/`'grouped'` need
    // `StreamingPlan` (not supported on every platform) so users opt in
    // explicitly. `'cards'` works under both streaming and static modes
    // — the streaming driver closes the session, posts the card, and
    // reopens on the next chunk.
    const toolDisplay = requestedMode ?? fromDeprecatedCards ?? 'cards';

    // `'timeline'` and `'grouped'` push `task_update`/`plan_update` chunks
    // that only render inside a chat-SDK `StreamingPlan`. Without streaming
    // there's no Plan to push into, so warn and fall back to `'cards'`.
    // `'cards'` and `'text'` work under both streaming and static modes:
    // the streaming driver closes the session, posts the per-tool message,
    // and reopens on the next chunk — same lifecycle as a `ToolDisplayFn`
    // returning `{ kind: 'post' }`.
    const isStreamingOnlyMode = toolDisplay === 'timeline' || toolDisplay === 'grouped';
    if (isStreamingOnlyMode && !streamingEnabled) {
      if (!this.warnedToolDisplayFallback.has(platform)) {
        this.warnedToolDisplayFallback.add(platform);
        this.log(
          'warn',
          `[${platform}] toolDisplay: '${toolDisplay}' requires streaming: true; falling back to 'cards'.`,
        );
      }
      return { resolved: 'cards', fn };
    }
    return { resolved: toolDisplay, fn };
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, ...args: unknown[]): void {
    if (!this.logger) return;
    if (level === 'error') {
      this.logger.error(message, { args });
    } else if (level === 'warn') {
      this.logger.warn(message, { args });
    } else if (level === 'debug') {
      this.logger.debug(message, { args });
    } else {
      this.logger.info(message, { args });
    }
  }
}
