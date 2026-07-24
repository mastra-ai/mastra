import type { Chat, Adapter, ChatConfig, Message, StateAdapter, Thread } from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { AgentSignalContents } from '../agent/signals';
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
import type { AgentChunkType } from '../stream/types';
import { createTool } from '../tools/tool';

import { chatModule, getChatModule } from './chat-lazy';
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
import { ChatChannelOutputProcessor, CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';
import { ChatChannelProcessor } from './processor';
import { MastraStateAdapter } from './state-adapter';
import type { PendingApprovalRecord } from './stream-helpers';
import type {
  ChannelAdapterConfig,
  ChannelConfig,
  ChannelContext,
  ChannelHandlers,
  PostableMessage,
  ResolveResourceId,
  ResolveThreadId,
  StreamingConfig,
  ThreadHistoryMessage,
  ToolDisplay,
  ToolDisplayFn,
} from './types';
import { defaultTypingStatus } from './typing-status';
import type { TypingStatusContext, TypingStatusFn } from './typing-status';
import { resolveWaitUntil } from './wait-until';

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
  /** Optional hook to resolve the memory resourceId (owner) for newly-created channel threads. */
  private resolveResourceId: ResolveResourceId | undefined;
  /** Optional hook to resolve the internal thread id for newly-created channel threads. */
  private resolveThreadId: ResolveThreadId | undefined;
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
   * Tool-approval cards that have been posted and are awaiting user action. When the user
   * clicks approve/decline, the `onAction` handler looks up the card's `messageId` and
   * tool metadata here so it can edit the card in place and resume the run with the right
   * context. Entries are removed after the resume completes.
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
    this.resolveResourceId = config.resolveResourceId;
    this.resolveThreadId = config.resolveThreadId;
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
        // Dispatch every incoming message immediately. Concurrency and queueing
        // for the same thread are handled by the agent signals layer
        // (ifActive/ifIdle behaviors), so chat-sdk's own lock-based queue would
        // be redundant — and in serverless runtimes a stale lock from a frozen
        // Lambda can cause subsequent messages to be queued forever.
        concurrency: { strategy: 'concurrent' },
        ...this.chatOptions,
      });

      // Default handler that routes messages to the agent
      const defaultHandler = (chatThread: Thread, message: Message) =>
        this.handleChatMessage(chatThread, message, mastra);

      // Register handlers with optional overrides
      const { onDirectMessage, onMention, onSubscribedMessage } = this.handlerOverrides;

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

      // Tool approval buttons — id is "tool_approve:<toolCallId>" or "tool_deny:<toolCallId>"
      chat.onAction(async event => {
        const { actionId } = event;
        if (!actionId.startsWith('tool_approve:') && !actionId.startsWith('tool_deny:')) return;
        try {
          const approved = actionId.startsWith('tool_approve:');
          const toolCallId = actionId.split(':')[1];
          if (!toolCallId) {
            this.log('info', `Missing toolCallId in action event actionId=${actionId}`);
            return;
          }

          const chatThread = event.thread as Thread | null;
          if (!chatThread) {
            this.log('info', `No thread in action event for toolCallId=${toolCallId}`);
            return;
          }
          const platform = event.adapter.name;
          const messageId = event.messageId;
          const adapter = this.adapters[platform];
          const adapterConfig = this.adapterConfigs[platform];
          if (!adapter) throw new Error(`No adapter for platform "${platform}"`);

          const externalThreadId = this.resolveExternalThreadId({ platform, chatThread, messageId });
          const mastraThread = await this.getOrCreateThread({
            externalThreadId,
            channelId: chatThread.channelId,
            platform,
            resourceId: `${platform}:${event.user.userId}`,
            mastra,
          });

          // Look up the runId for this toolCallId. Prefer the in-memory
          // `pendingApprovalCards` map (set when the approval card was posted)
          // because it's keyed by toolCallId and survives parallel same-tool
          // approvals. Fall back to the persisted `pendingToolApprovals`
          // metadata for cases where the bot restarted between card post and
          // click (the metadata path is lossy for parallel same-tool calls
          // since core keys those by toolName — only the latest survives).
          let runId: string | undefined;
          let toolName: string | undefined;
          let toolArgs: Record<string, unknown> | undefined;

          const stashed = this.pendingApprovalCards.get(toolCallId);
          if (stashed?.runId) {
            runId = stashed.runId;
            toolName = stashed.toolName;
            toolArgs = stashed.args;
          } else {
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

            for (const msg of messages) {
              const pending = msg.content?.metadata?.pendingToolApprovals as
                | Record<
                    string,
                    {
                      toolCallId: string;
                      runId: string;
                      parentRunId?: string;
                      toolName: string;
                      args: Record<string, unknown>;
                    }
                  >
                | undefined;
              if (pending) {
                for (const toolData of Object.values(pending)) {
                  if (toolData.toolCallId === toolCallId) {
                    runId = toolData.parentRunId ?? toolData.runId;
                    toolName = toolData.toolName;
                    toolArgs = toolData.args;
                    break;
                  }
                }
                if (runId) break;
              }
            }
          }

          if (!runId) {
            this.log('info', `No pending approval found for toolCallId=${toolCallId}`);
            return;
          }

          // Build the card header with tool name and args
          const displayName = toolName ? stripToolPrefix(toolName) : 'tool';
          const argsSummary = toolArgs ? formatArgsSummary(toolArgs) : '';
          // Resolve the tool display mode so the approve/deny edit matches
          // the original card's rendering (cards → Block Kit, text → plain).
          // Streaming is irrelevant here — we're outside the agent loop.
          const { resolved: toolDisplay } = this.resolveToolDisplay(
            platform,
            adapterConfig?.toolDisplay,
            false,
            adapterConfig?.cards,
            adapterConfig?.formatToolCall,
          );
          const useCards = toolDisplay === 'cards';

          if (!approved) {
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

            // Resume the suspended run with a denial so the agent can produce a
            // follow-up message (e.g. acknowledging the rejection). Stash the
            // render context so `ChatChannelOutputProcessor` renders the output
            // inline — same path as processChatMessage and the approve branch.
            const { channelContext } = this.buildEventContext({
              chatThread,
              platform,
              eventType: 'action',
              messageId,
              actor: event.user,
            });
            const requestContext = new RequestContext();
            requestContext.set('channel', channelContext);

            const renderContext = this._buildRenderContext(chatThread, platform);
            requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext);

            try {
              const resumed = await this.agent.declineToolCall({
                runId,
                toolCallId,
                requestContext,
                memory: {
                  thread: mastraThread.id,
                  resource: mastraThread.resourceId,
                },
              });
              // Drive the run to completion so serverless runtimes don't kill it.
              void resumed.consumeStream().catch(err => {
                this.log('error', 'Error consuming resumed decline stream', err);
              });
            } catch (err) {
              const isStaleApproval = err instanceof Error && err.message.includes('No snapshot found');
              if (isStaleApproval) {
                this.log('info', `Ignoring stale tool denial action (runId already consumed)`);
              } else {
                throw err;
              }
            } finally {
              // Stash entry is no longer needed; the resumed decline stream
              // won't emit a tool-result for this call.
              this.pendingApprovalCards.delete(toolCallId);
            }
            return;
          }

          // Immediately edit the card to show "Approved" and remove the buttons
          try {
            await adapter.editMessage(chatThread.id, messageId, formatToolApproved(displayName, argsSummary, useCards));
          } catch (err) {
            this.log('debug', 'Failed to edit approved card', err);
          }

          // Build request context for the resumed stream. Stash the render
          // context so `ChatChannelOutputProcessor` renders the tool-result
          // and any follow-up output inline — same path as processChatMessage.
          const { channelContext } = this.buildEventContext({
            chatThread,
            platform,
            eventType: 'action',
            messageId,
            actor: event.user,
          });
          const requestContext = new RequestContext();
          requestContext.set('channel', channelContext);

          const renderContext = this._buildRenderContext(chatThread, platform, { toolCallId, messageId });
          requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext);

          const resumed = await this.agent.approveToolCall({
            runId,
            toolCallId,
            requestContext,
            memory: {
              thread: mastraThread.id,
              resource: mastraThread.resourceId,
            },
          });
          // Drive the run to completion so serverless runtimes don't kill it.
          void resumed.consumeStream().catch(err => {
            this.log('error', 'Error consuming resumed approval stream', err);
          });
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
          } catch (err) {
            this.log('debug', 'Failed to post error message for action', err);
          }
        }
      });
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
            // Resolution order: bare `waitUntil` fn from config → user resolver → default.
            const waitUntilFn =
              self.channelConfig.waitUntil ?? self.channelConfig.resolveWaitUntil?.(c) ?? resolveWaitUntil(c);
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
   *
   * - Skipped entirely when `channels.threadContext.addSystemMessage` is `false`.
   * - Skipped if the user already added a processor with the same id.
   */
  getInputProcessors(configuredProcessors: InputProcessorOrWorkflow[] = []): InputProcessor[] {
    if (this.channelConfig.threadContext?.addSystemMessage === false) return [];
    const hasProcessor = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'chat-channel-context');
    if (hasProcessor) return [];
    return [new ChatChannelProcessor()];
  }

  /**
   * Returns channel output processors that render the agent's stream to the
   * originating chat platform. The processor resolves its render context from
   * the inbound `requestContext` marker set by `processChatMessage` when
   * present, and otherwise reconstructs it from the run's thread via the bound
   * `AgentChannels` (so schedule / Studio / custom-UI runs on a channel-backed
   * thread still post back). Non-channel runs pass through untouched.
   *
   * Skipped if the user already added a processor with the same id.
   */
  /**
   * @deprecated No longer needed — `AgentChannels` no longer holds stateful resources that require cleanup.
   * Kept as a no-op for backwards compatibility with existing `ChannelProvider` implementations.
   */
  close(): void {
    // no-op
  }

  getOutputProcessors(configuredProcessors: OutputProcessorOrWorkflow[] = []): OutputProcessor[] {
    const hasProcessor = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'chat-channel-render');
    if (hasProcessor) return [];
    return [new ChatChannelOutputProcessor(this)];
  }

  /**
   * Returns generic channel tools (send_message, add_reaction, etc.)
   * that resolve the target adapter from the current request context.
   */
  getTools(): Record<string, unknown> {
    if (!this.toolsEnabled) return {};
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
   * Derive the three per-event shapes we hand off to downstream systems from one set of
   * inputs. Keeping this in one place ensures the LLM (`attributes`), input processors
   * (`requestContext`), and memory (`metadata`) all see consistent author / thread facts.
   *
   *   - `channelContext` — goes on `requestContext` under the 'channel' key, consumed by
   *     `ChatChannelProcessor` and other input processors.
   *   - `attributes` — serialized as XML on the user message element the LLM sees (e.g. on
   *     `<user messageId=... authorId=... />`). Strings only.
   *   - `providerOptions` — written to the stored message's `content.providerMetadata`
   *     under `mastra.channels.<platform>` so UI/query callers can read author/channel
   *     facts off the message (e.g. show a Slack icon + author name) without unpacking
   *     the signal envelope. The LLM ignores `providerOptions.mastra.*` since only
   *     provider-keyed entries (openai, anthropic, …) are forwarded to the model.
   */
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
    const defaultResourceId = `${platform}:${message.author.userId}`;
    const mastraThread = await this.getOrCreateThread({
      externalThreadId,
      channelId: chatThread.channelId,
      platform,
      // Lazily resolved: the hook only runs when we're actually creating a new
      // thread, never when reusing an existing one (which keeps its stored owner).
      resourceId: this.resolveResourceId
        ? () => this.resolveResourceId!({ platform, thread: chatThread, message, defaultResourceId })
        : defaultResourceId,
      // Same laziness for the thread id hook; it runs after the resourceId
      // resolves so hosts can align the two (e.g. thread id = session id).
      threadId: this.resolveThreadId
        ? (resourceId: string, defaultThreadId: string) =>
            this.resolveThreadId!({ platform, thread: chatThread, message, resourceId, defaultThreadId })
        : undefined,
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

    const richText = message.formatted ? chatModule().stringifyMarkdown(message.formatted).trim() : undefined;
    const text = [historyBlock, richText || message.text].filter(Boolean).join('\n\n');
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

    this.log('info', '[processChatMessage] tool approval config', {
      platform,
      toolDisplay,
      toolDisplayFn: !!toolDisplayFn,
      canRenderApprovalButtons,
      autoResumeSuspendedTools: canRenderApprovalButtons ? undefined : true,
    });

    const { channelContext, attributes, providerOptions } = this.buildEventContext({
      chatThread,
      platform,
      eventType: chatThread.isDM ? 'message' : 'mention',
      messageId: message.id,
      actor: message.author,
    });

    const requestContext = new RequestContext();
    requestContext.set('channel', channelContext);

    // Stash the per-event render deps so `ChatChannelOutputProcessor` can
    // route the agent's stream to the chat platform. The processor opens an
    // async queue on the first chunk and hands the iterable to the existing
    // streaming/static driver. This replaces the previous per-thread
    // subscription consumer: rendering now happens inline with the run that
    // produces the chunks, so only the Lambda that won the wake race
    // (signals reservation) renders the reply.
    const renderContext = this._buildRenderContext(chatThread, platform);
    requestContext.set(CHAT_CHANNEL_RENDER_CONTEXT_KEY, renderContext);

    void chatThread.subscribe().catch(err => {
      this.log('debug', 'chatThread.subscribe failed', err);
    });

    // When the message is text-only, pass the bare string to the signal pipeline.
    // Otherwise pass the parts array directly — both shapes match AgentSignalContents.
    const signalContents: AgentSignalContents = parts.length === 1 && parts[0]?.type === 'text' ? parts[0].text : parts;

    const result = this.agent.sendMessage(
      {
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
              thread: mastraThread.id,
              resource: threadResourceId,
            },
            // Without approval-button rendering, auto-approve tools to
            // avoid getting stuck waiting for input we can't ask for.
            autoResumeSuspendedTools: canRenderApprovalButtons ? undefined : true,
          },
        },
      },
    );

    // When this call wakes a new run, drive it to completion before returning.
    // Without this, serverless runtimes (Vercel, Lambda, etc.) terminate the
    // invocation as soon as the webhook handler returns and kill the run
    // mid-flight. `consumeStream()` is idempotent and safe to call alongside
    // the existing per-thread subscription consumer.
    try {
      const accepted = await result.accepted;
      // Only the `wake` action means this process started and owns the run.
      // Any other action (deliver/persist/discard) handed the signal off, so
      // there is nothing to drive to completion here.
      if (accepted.action === 'wake') {
        await accepted.output.consumeStream();
      }
    } catch (err) {
      this.log('debug', 'accepted consume failed', err);
    }
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

        const historyText = msg.formatted ? chatModule().stringifyMarkdown(msg.formatted).trim() : undefined;
        messages.push({
          id: msg.id,
          author: msg.author.fullName || msg.author.userName || 'Unknown',
          userId: msg.author.userId,
          text: historyText || msg.text,
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
   * Build the per-event render dependencies stashed on `requestContext` for
   * `ChatChannelOutputProcessor`. Captures the adapter, driver mode,
   * tool-display config, approval-card stash callbacks, and the typing-status
   * wrapper as a callable so the processor can apply it after the queue is
   * created. The returned object is plain data — no streams, no promises —
   * so it's safe to stash on `requestContext` for the processor to read later.
   *
   * @internal Used by `processChatMessage` and the approve/decline paths.
   */
  _buildRenderContext(
    chatThread: Thread,
    platform: string,
    approvalContext?: { toolCallId: string; messageId: string },
  ): ChatChannelRenderContext {
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

    const typingGate = { active: false };

    const onApprovalPosted = (toolCallId: string, record: PendingApprovalRecord) => {
      this.pendingApprovalCards.set(toolCallId, record);
    };
    const getPendingApproval = (id: string) => this.pendingApprovalCards.get(id);
    const takePendingApproval = (id: string) => {
      const r = this.pendingApprovalCards.get(id);
      if (r) this.pendingApprovalCards.delete(id);
      return r;
    };

    return {
      adapter,
      chatThread,
      platform,
      streaming,
      toolDisplay,
      toolDisplayFn,
      channelToolNames: this.channelToolNames,
      logger: this.logger,
      onApprovalPosted,
      getPendingApproval,
      takePendingApproval,
      wrapStream: stream => this.withTypingStatus(stream, chatThread, platform, adapterConfig, typingGate),
      typingGate,
      formatError: adapterConfig?.formatError,
      approvalContext,
    };
  }

  /**
   * Reconstruct a {@link ChatChannelRenderContext} for a Mastra thread that is
   * backed by a channel, without an inbound platform event.
   *
   * The inbound webhook paths (`processChatMessage`, approve/decline) stash a
   * render context on `requestContext` because they already hold the live
   * `Thread` handle from `event.thread`. Runs that did NOT originate from a
   * platform message (schedule fires, Studio, custom UI, user code) have no such
   * handle, so `ChatChannelOutputProcessor` calls this to rebuild it from the
   * thread's persisted channel coordinates.
   *
   * Returns `null` when the thread is not channel-backed (no `channel_platform`
   * metadata) or its platform adapter isn't configured on this instance — the
   * processor then passes the run through untouched.
   *
   * Delegates to the same {@link _buildRenderContext} used by the inbound paths,
   * so both paths produce an identical render context (single source of truth).
   * The only per-fire inputs are `platform` (a persisted string) and the live
   * `Thread` handle, which the Chat SDK materializes from the stored external id
   * via `chat.thread(externalThreadId)`.
   */
  async buildRenderContextForThread(threadId: string): Promise<ChatChannelRenderContext | null> {
    const mastra = this.agent?.getMastraInstance();
    const storage = mastra?.getStorage();
    if (!storage) return null;

    const memoryStore = await storage.getStore('memory');
    if (!memoryStore) return null;

    const thread = await memoryStore.getThreadById({ threadId });
    if (!thread) return null;

    const platform = thread.metadata?.channel_platform;
    const externalThreadId = thread.metadata?.channel_externalThreadId;
    if (typeof platform !== 'string' || platform.length === 0) return null;
    if (typeof externalThreadId !== 'string' || externalThreadId.length === 0) return null;
    if (!this.adapters[platform]) return null;

    const chat = this.chat;
    if (!chat) return null;

    const chatThread = chat.thread(externalThreadId);
    return this._buildRenderContext(chatThread, platform);
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
    threadId,
    mastra,
  }: {
    externalThreadId: string;
    channelId: string;
    platform: string;
    /**
     * The owner for a newly-created thread. Pass a function to defer resolution
     * until we know a new thread is actually needed; it is never called when an
     * existing thread is reused.
     */
    resourceId: string | (() => string | Promise<string>);
    /**
     * The id for a newly-created thread, resolved lazily after the owner —
     * never called when an existing thread is reused (which keeps its id).
     * Omitted: a random UUID.
     */
    threadId?: (resolvedResourceId: string, defaultThreadId: string) => string | Promise<string>;
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

    const resolvedResourceId = typeof resourceId === 'function' ? await resourceId() : resourceId;
    const defaultThreadId = crypto.randomUUID();
    let resolvedThreadId = threadId ? await threadId(resolvedResourceId, defaultThreadId) : defaultThreadId;

    // saveThread upserts by id, so a resolver id that already belongs to another
    // thread would overwrite it. Fall back to the generated id instead.
    if (resolvedThreadId && resolvedThreadId !== defaultThreadId) {
      const existing = await memoryStore.getThreadById({ threadId: resolvedThreadId }).catch(() => null);
      if (existing) {
        this.log(
          'warn',
          `resolveThreadId returned "${resolvedThreadId}" which already belongs to an existing thread; using a generated id instead`,
        );
        resolvedThreadId = defaultThreadId;
      }
    }

    return memoryStore.saveThread({
      thread: {
        id: resolvedThreadId || defaultThreadId,
        title: `${platform} conversation`,
        resourceId: resolvedResourceId,
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
