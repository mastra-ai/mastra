import type { Chat, Adapter, CardElement, ChatConfig, Message, StateAdapter, Thread } from 'chat';
import { z } from 'zod';

import type { Agent } from '../agent/agent';
import type { MastraDBMessage, MastraMessagePart } from '../agent/message-list';
import type { IMastraLogger } from '../logger/logger';
import type { Mastra } from '../mastra';
import type { StorageThreadType } from '../memory/types';
import type { InputProcessor, InputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors';
import { RequestContext } from '../request-context';
import type { ApiRoute } from '../server/types';
import type { MastraModelOutput } from '../stream/base/output';
import { createTool } from '../tools/tool';
import { getChatModule } from './chat-lazy';

import {
  formatArgsSummary,
  formatResult,
  formatToolApproval,
  formatToolApproved,
  formatToolDenied,
  formatToolResult,
  formatToolRunning,
  stripToolPrefix,
} from './formatting';
import { ChatChannelProcessor } from './processor';
import { MastraStateAdapter } from './state-adapter';
import type { ChannelContext, ThreadHistoryMessage } from './types';

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
   * Use rich card formatting for tool calls, approvals, and results.
   * Set to `false` to use plain text formatting instead.
   *
   * Some platforms (e.g. Discord) may have rendering issues with cards.
   * @default true
   */
  cards?: boolean;

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

/**
 * Handler function for channel events.
 * Receives the thread, message, and the default handler implementation.
 * Call `defaultHandler` to run the built-in behavior, or ignore it to fully replace.
 */
export type ChannelHandler = (
  thread: Thread,
  message: Message,
  defaultHandler: (thread: Thread, message: Message) => Promise<void>,
) => Promise<void>;

/**
 * Handler configuration for channel events.
 * - `undefined` or omitted → use default handler
 * - `false` → disable handler entirely
 * - function → custom handler (receives defaultHandler as 3rd arg to wrap/extend)
 */
export type ChannelHandlerConfig = ChannelHandler | false | undefined;

/** Handler overrides for built-in channel event handlers. */
export interface ChannelHandlers {
  /**
   * Handler for direct messages to the bot.
   * Default: Routes to agent.stream and posts the response.
   */
  onDirectMessage?: ChannelHandlerConfig;

  /**
   * Handler for @mentions of the bot in channels.
   * Default: Routes to agent.stream and posts the response.
   */
  onMention?: ChannelHandlerConfig;

  /**
   * Handler for messages in subscribed threads.
   * Default: Routes to agent.stream and posts the response.
   */
  onSubscribedMessage?: ChannelHandlerConfig;
}

/** Configuration for agent chat channels. */
export interface ChannelConfig {
  /** Platform adapters keyed by name (e.g. 'slack', 'discord'). */
  adapters: Record<string, Adapter | ChannelAdapterConfig>;

  /**
   * Override built-in event handlers.
   * Use this to customize how the agent responds to DMs, mentions, etc.
   *
   * @example
   * ```ts
   * handlers: {
   *   // Wrap the default handler with logging
   *   onDirectMessage: async (thread, message, defaultHandler) => {
   *     console.log('Received DM:', message.text);
   *     await defaultHandler(thread, message);
   *   },
   *   // Disable mention handling entirely
   *   onMention: false,
   * }
   * ```
   */
  handlers?: ChannelHandlers;

  /**
   * Which media types to send inline to the model (as file parts).
   * Everything else is described as text metadata so the agent knows about the
   * file without crashing models that reject unsupported types.
   *
   * - **Array of globs** — e.g. `['image/*']` (default), `['image/*', 'video/*']`
   * - **Function** — `(mimeType: string) => boolean`
   *
   * @default `['image/*']`
   *
   * @example
   * ```ts
   * // Gemini supports video/audio natively
   * inlineMedia: ['image/*', 'video/*', 'audio/*']
   *
   * // Send everything inline
   * inlineMedia: () => true
   * ```
   */
  inlineMedia?: string[] | ((mimeType: string) => boolean);

  /**
   * Promote URLs found in message text to file parts so the model can "see" linked
   * content (images, videos, PDFs, etc.) instead of just the raw URL text.
   *
   * Each entry matches a domain. When a URL in the message matches, it's added as
   * a `file` part alongside the text. Use a string for domains where a HEAD request
   * determines the Content-Type, or an object to force a specific mime type (useful
   * for sites like YouTube where HEAD returns `text/html` but the model treats the
   * URL as video).
   *
   * - **String** — domain to match; HEAD determines the mime type
   * - **Object** `{ match, mimeType }` — domain + forced mime type (skips HEAD)
   * - `'*'` — match all URLs (HEAD each one)
   * - `undefined` (default) — disabled, no URLs are promoted
   *
   * For string entries (or `'*'`), the resolved Content-Type is checked against
   * `inlineMedia` — only matching types become file parts. For object entries with
   * a forced `mimeType`, the file part is always added.
   *
   * @example
   * ```ts
   * // Gemini can process YouTube URLs natively as video
   * inlineLinks: [
   *   { match: 'youtube.com', mimeType: 'video/*' },
   *   { match: 'youtu.be', mimeType: 'video/*' },
   * ]
   *
   * // HEAD-check linked images from any domain
   * inlineLinks: ['*']
   *
   * // Mix: force YouTube, HEAD-check everything else
   * inlineLinks: [
   *   { match: 'youtube.com', mimeType: 'video/*' },
   *   'imgur.com',
   *   'i.redd.it',
   * ]
   * ```
   */
  inlineLinks?: InlineLinkEntry[];

  /** State adapter for deduplication, locking, and subscriptions. Defaults to in-memory. */
  state?: StateAdapter;

  /** The bot's display name (default: agent's name, or `'Mastra'`). */
  userName?: string;

  /**
   * Fetch recent thread messages from the platform to provide context when the agent
   * is mentioned mid-conversation. Only fetches on the first mention in a thread —
   * once subscribed, the agent has full history via Mastra's memory system.
   *
   * @example
   * ```ts
   * threadContext: { maxMessages: 15 } // Fetch more context
   * threadContext: { maxMessages: 0 }  // Disable (opt-out)
   * ```
   */
  threadContext?: {
    /**
     * Maximum number of recent platform messages to fetch (default: 10).
     * Only applies to non-DM threads where the agent isn't already subscribed.
     * Set to 0 to disable.
     */
    maxMessages?: number;
  };

  /**
   * Whether to include channel tools (add_reaction, remove_reaction).
   * Set to `false` for models that don't support function calling.
   *
   * @default true
   */
  tools?: boolean;

  /**
   * Additional options passed directly to the Chat SDK.
   * Use this for advanced configuration not exposed by Mastra.
   *
   * @see https://github.com/vercel/chat
   * @example
   * ```ts
   * chatOptions: {
   *   dedupeTtlMs: 600000, // 10 minute deduplication window
   *   fallbackStreamingPlaceholderText: '⏳',
   * }
   * ```
   */
  chatOptions?: Omit<ChatConfig, 'adapters' | 'state' | 'userName'>;
}

/**
 * Build a predicate from the `inlineMedia` config option.
 * Supports glob patterns (e.g. `'image/*'`) and custom functions.
 * Default: only `image/*` is sent inline.
 */
function buildInlineMediaCheck(config?: string[] | ((mimeType: string) => boolean)): (mimeType: string) => boolean {
  if (typeof config === 'function') return config;
  const patterns = config ?? ['image/*'];
  return (mimeType: string) => {
    return patterns.some(pattern => {
      if (pattern === '*' || pattern === '*/*') return true;
      if (pattern.endsWith('/*')) {
        return mimeType.startsWith(pattern.slice(0, -1));
      }
      return mimeType === pattern;
    });
  };
}

/** A single entry in the `inlineLinks` config. */
export type InlineLinkEntry =
  | string // Domain pattern — HEAD determines mime type, checked against inlineMedia
  | { match: string; mimeType: string }; // Domain + forced mime type (skips HEAD & inlineMedia)

/** Resolved inline-link rule after normalisation. */
interface InlineLinkRule {
  match: string;
  /** If set, skip HEAD and use this mime type directly. */
  forcedMimeType?: string;
}

/**
 * Normalise the `inlineLinks` config into a list of rules.
 * Returns `undefined` if the feature is disabled.
 */
function normalizeInlineLinks(config?: InlineLinkEntry[]): InlineLinkRule[] | undefined {
  if (config == null || config.length === 0) return undefined;
  return config.map(entry =>
    typeof entry === 'string' ? { match: entry } : { match: entry.match, forcedMimeType: entry.mimeType },
  );
}

/** Check if a URL's hostname matches a domain pattern. @internal */
export function matchesDomain(url: string, pattern: string): boolean {
  if (pattern === '*') return true;
  try {
    const hostname = new URL(url).hostname;
    return hostname === pattern || hostname.endsWith(`.${pattern}`);
  } catch {
    return false;
  }
}

/** Find the first matching inline-link rule for a URL. */
function findInlineLinkRule(url: string, rules: InlineLinkRule[]): InlineLinkRule | undefined {
  return rules.find(rule => matchesDomain(url, rule.match));
}

/** Extract URLs from plain text. @internal */
const URL_REGEX = /https?:\/\/[^\s<>)"']+/gi;
export function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(URL_REGEX), m => m[0]);
}

/**
 * HEAD a URL to determine its Content-Type.
 * Returns undefined if the request fails or has no Content-Type.
 */
async function headContentType(url: string, logger?: IMastraLogger): Promise<string | undefined> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok) return undefined;
    const ct = res.headers.get('content-type');
    // Strip parameters (e.g. 'image/png; charset=utf-8' → 'image/png')
    return ct?.split(';')[0]?.trim() || undefined;
  } catch (e) {
    logger?.debug('[CHANNEL] HEAD request failed for link', { url, error: String(e) });
    return undefined;
  }
}

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
  /** Channel tool names whose effects are already visible on the platform (skip rendering cards). */
  private channelToolNames!: Set<string>;

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
        concurrency: { strategy: 'queue' },
        ...this.chatOptions,
      });

      // Default handler that routes messages to the agent
      const defaultHandler = (sdkThread: Thread, message: Message) =>
        this.handleChatMessage(sdkThread, message, mastra);

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
          const adapterConfig = this.adapterConfigs[platform];
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
          const useCards = adapterConfig?.cards !== false;

          if (!approved) {
            const byUser = sdkThread.isDM ? undefined : event.user.fullName || event.user.userName || 'User';
            try {
              await adapter.editMessage(
                sdkThread.id,
                messageId,
                formatToolDenied(displayName, argsSummary, byUser, useCards),
              );
            } catch (err) {
              this.log('debug', 'Failed to edit denied card', err);
            }
            return;
          }

          // Immediately edit the card to show "Approved" and remove the buttons
          try {
            await adapter.editMessage(sdkThread.id, messageId, formatToolApproved(displayName, argsSummary, useCards));
          } catch (err) {
            this.log('debug', 'Failed to edit approved card', err);
          }

          // Build request context for the resumed stream
          const actionAdapter = this.adapters[platform]!;
          const actionBotUserId = actionAdapter.botUserId;
          const actionBotMention = actionBotUserId ? sdkThread.mentionUser(actionBotUserId) : undefined;
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
            botUserId: actionBotUserId,
            botUserName: actionAdapter.userName,
            botMention: actionBotMention,
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
   */
  getWebhookRoutes(): ApiRoute[] {
    if (!this.agent) return [];

    const agentId = this.agent.id;
    const routes: ApiRoute[] = [];

    for (const platform of Object.keys(this.adapters)) {
      const self = this;
      routes.push({
        path: `/api/agents/${agentId}/channels/${platform}/webhook`,
        method: 'POST',
        requiresAuth: false,
        _mastraInternal: true,
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
      this.log('error', `[${sdkThread.adapter.name}] Error handling message`, {
        messageId: message.id,
        authorId: message.author?.userId,
        error: String(err),
      });
      try {
        const adapterConfig = this.adapterConfigs[sdkThread.adapter.name];
        const errorMessage = adapterConfig?.formatError
          ? adapterConfig.formatError(error)
          : `❌ Error: ${error.message}`;
        await sdkThread.post(errorMessage);
      } catch (postErr) {
        this.log('debug', 'Failed to post error message to thread', postErr);
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

    // Fetch recent thread history when configured, this is a non-DM mention,
    // AND the agent isn't already subscribed to this thread. If subscribed,
    // the agent already has history via Mastra's memory system.
    // History is prepended to the user message text (not as a separate message)
    // to avoid consecutive user messages which some providers reject (e.g. DeepSeek).
    let historyBlock: string | undefined;
    const maxMessages = this.threadContext.maxMessages ?? 10;
    if (maxMessages > 0 && !sdkThread.isDM) {
      const alreadySubscribed = await sdkThread.isSubscribed();
      if (!alreadySubscribed) {
        this.logger?.debug?.(`Fetching thread history (max ${maxMessages}) for first mention in ${sdkThread.id}`);
        const history = await this.fetchThreadHistory(sdkThread, message.id, maxMessages);
        this.logger?.debug?.(`Fetched ${history.length} messages from thread history`);
        if (history.length > 0) {
          const lines = ['[Thread context — messages in this thread before you joined]'];
          for (const msg of history) {
            const mention = msg.userId ? sdkThread.mentionUser(msg.userId) : undefined;
            let prefix = mention ? (msg.author ? `${msg.author} (${mention})` : mention) : msg.author;
            if (msg.isBot) prefix += ' (bot)';
            lines.push(`[${prefix}] (msg:${msg.id}): ${msg.text}`);
          }
          historyBlock = lines.join('\n');
        }
      } else {
        this.logger?.debug?.(`Skipping thread history fetch — already subscribed to ${sdkThread.id}`);
      }
    }

    // Extract author info for metadata and display
    const authorName = message.author.fullName || message.author.userName;
    const authorId = message.author.userId;
    const authorMention = authorId ? sdkThread.mentionUser(authorId) : undefined;

    // Bot identity — so the LLM can recognise self-mentions in raw message text
    const adapter = this.adapters[platform]!;
    const botUserId = adapter.botUserId;
    const botMention = botUserId ? sdkThread.mentionUser(botUserId) : undefined;

    // Build request context with channel info.
    const requestContext = new RequestContext();
    requestContext.set('channel', {
      platform,
      eventType: sdkThread.isDM ? 'message' : 'mention',
      isDM: sdkThread.isDM,
      threadId: sdkThread.id,
      channelId: sdkThread.channelId,
      messageId: message.id,
      userId: authorId,
      userName: authorName,
      botUserId,
      botUserName: adapter.userName,
      botMention,
    } satisfies ChannelContext);

    // Build message text.
    // If thread history was fetched, prepend it so it's part of the same user message
    // (avoids consecutive user messages which some providers reject).
    const textSegments: string[] = [];

    if (historyBlock) {
      textSegments.push(historyBlock);
    }

    if (sdkThread.isDM) {
      // DMs: just the message text — system message already covers identity
      textSegments.push(message.text);
    } else {
      // Non-DM: prepend metadata and author prefix for multi-user context
      const reminderLines = [`Event: mention`, `Message ID: ${message.id}`];
      reminderLines.push('You were mentioned in this message. Respond to the user.');
      textSegments.push(`<system-reminder>\n${reminderLines.join('\n')}\n</system-reminder>`);

      let authorPrefix = '';
      if (authorMention) {
        authorPrefix = authorName ? `${authorName} (${authorMention})` : authorMention;
      } else if (authorName) {
        authorPrefix = authorName;
      }
      if (authorPrefix) {
        if (message.author.isBot) authorPrefix += ' (bot)';
        textSegments.push(`[${authorPrefix}]: ${message.text}`);
      } else {
        textSegments.push(message.text);
      }
    }

    const rawText = textSegments.join('\n\n');

    // Build the message content with channel metadata.
    // We construct a MastraDBMessage to preserve the platform message ID in metadata.
    const usableAttachments = message.attachments.filter(a => a.url || a.fetchData);

    type MastraPart = { type: 'text'; text: string } | { type: 'file'; data: string; mimeType: string };
    const parts: MastraPart[] = [{ type: 'text', text: rawText }];

    // Route attachments based on `inlineMedia` config (default: only image/*).
    // Inline types are sent as file parts (the LLM adapter converts image/* to
    // image content automatically). Non-inline types are described as text
    // metadata so the agent is aware of them without crashing models that
    // reject unsupported media (e.g. OpenAI rejects video/mp4).
    this.logger?.debug('[CHANNEL] Attachments', {
      count: usableAttachments.length,
      attachments: usableAttachments.map(a => ({
        type: a.type,
        mimeType: a.mimeType,
        url: a.url,
        hasData: !!a.fetchData,
      })),
    });
    for (const att of usableAttachments) {
      if (!att.url && !att.fetchData) continue;
      const mimeType = att.mimeType || (att.type === 'image' ? 'image/png' : undefined);
      if (!mimeType) continue;

      const inline = this.shouldInline(mimeType);
      if (inline) {
        let data: string | undefined;
        if (att.fetchData) {
          // Prefer authenticated fetch (e.g. Slack CDN requires auth)
          try {
            const buf = await att.fetchData();
            const base64 = Buffer.from(buf).toString('base64');
            data = `data:${mimeType};base64,${base64}`;
          } catch (err) {
            this.logger?.warn('[CHANNEL] fetchData failed, falling back to URL', { mimeType, error: String(err) });
            data = att.url;
          }
        } else {
          // Public URL (e.g. Discord CDN) — let the provider fetch directly
          data = att.url;
        }
        if (data) {
          parts.push({
            type: 'file',
            data,
            mimeType,
          });
        }
      } else {
        const filename = att.name || att.url?.split('/').pop() || 'file';
        const description = `[Attached file: ${filename} (${mimeType})${att.url ? ` — ${att.url}` : ''}]`;
        parts.push({ type: 'text', text: `\n${description}` });
      }
    }

    // Promote URLs in message text to file parts based on `inlineLinks` config.
    if (this.inlineLinkRules && rawText) {
      const urls = extractUrls(rawText);
      for (const url of urls) {
        const rule = findInlineLinkRule(url, this.inlineLinkRules);
        if (!rule) continue;

        if (rule.forcedMimeType) {
          // Object entry with forced mime type — skip HEAD, always promote.
          parts.push({ type: 'file', data: url, mimeType: rule.forcedMimeType });
        } else {
          // String entry — HEAD to determine Content-Type, then check inlineMedia.
          const contentType = await headContentType(url, this.logger);
          if (contentType && this.shouldInline(contentType)) {
            parts.push({ type: 'file', data: url, mimeType: contentType });
          }
        }
      }
    }

    // Build a MastraDBMessage with channel metadata so the platform message ID and author are tracked.
    const streamInput: MastraDBMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: parts as MastraMessagePart[],
        metadata: {
          mastra: {
            channels: {
              [platform]: {
                messageId: message.id,
                author: {
                  userId: authorId,
                  userName: message.author.userName,
                  fullName: message.author.fullName,
                  mention: authorMention,
                  isBot: message.author.isBot,
                },
              },
            },
          },
        },
      },
    };

    // Stream the agent response.

    const adapterConfig = this.adapterConfigs[platform];
    const useCards = adapterConfig?.cards !== false;
    const stream = await agent.stream(streamInput, {
      requestContext,
      memory: {
        thread: mastraThread,
        resource: threadResourceId,
      },
      // Without cards, we can't show approval buttons — auto-approve tools instead
      autoResumeSuspendedTools: useCards ? undefined : true,
    });

    await this.consumeAgentStream(stream, sdkThread, platform);

    // Subscribe so follow-up messages also get handled
    await sdkThread.subscribe();
  }

  /**
   * Fetch recent messages from the platform thread to provide context.
   * Returns messages in chronological order (oldest first), excluding the
   * current triggering message.
   */
  private async fetchThreadHistory(
    sdkThread: Thread,
    currentMessageId: string,
    maxMessages: number,
  ): Promise<ThreadHistoryMessage[]> {
    const messages: ThreadHistoryMessage[] = [];

    try {
      // sdkThread.messages is an async iterator that yields newest-first
      for await (const msg of sdkThread.messages) {
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
   * Consume the agent stream and render all chunks to the chat platform.
   *
   * Iterates the outer `fullStream` to handle all chunk types:
   * - `text-delta`: Accumulates text and posts when flushed.
   * - `tool-call`: Posts a "Running…" card eagerly.
   * - `tool-result`: Edits the "Running…" card with the result.
   * - `tool-call-approval`: Edits the card to show Approve/Deny buttons.
   * - `step-finish` / `finish`: Flushes accumulated text.
   */
  private async editOrPost(
    adapter: Adapter,
    sdkThread: Thread,
    messageId: string | undefined,
    content: PostableMessage,
  ) {
    if (messageId) {
      try {
        await adapter.editMessage(sdkThread.id, messageId, content);
      } catch {
        await sdkThread.post(content);
      }
    } else {
      await sdkThread.post(content);
    }
  }

  private async consumeAgentStream(
    stream: MastraModelOutput,
    sdkThread: Thread,
    platform: string,
    approvalContext?: { toolCallId: string; messageId: string },
  ): Promise<void> {
    const adapter = this.adapters[platform]!;
    const adapterConfig = this.adapterConfigs[platform];
    const useCards = adapterConfig?.cards !== false;

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

    let typingInterval: ReturnType<typeof setInterval> | undefined;

    const ensureTyping = async () => {
      if (!typingStarted) {
        typingStarted = true;
        try {
          await sdkThread.startTyping();
        } catch (e) {
          this.logger?.debug('[CHANNEL] Typing indicator failed (best-effort)', { error: e });
        }
      }
    };

    // Keep the typing indicator alive for slow generation (e.g. image models).
    // Discord's indicator expires after ~10s, so we re-fire every 8s.
    const startTypingKeepalive = () => {
      if (typingInterval) return;
      typingInterval = setInterval(async () => {
        try {
          await sdkThread.startTyping();
        } catch {
          // best-effort
        }
      }, 8_000);
    };

    const stopTypingKeepalive = () => {
      if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = undefined;
      }
    };

    const flushText = async () => {
      // Strip zero-width characters (U+200B, U+200C, U+200D, U+FEFF) that LLMs sometimes emit
      const cleanedText = textBuffer.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (cleanedText) {
        await sdkThread.post(cleanedText);
        textBuffer = '';
      }
    };

    // If nothing triggers typing within 3s, start it anyway and keep it
    // alive — covers slow generation (e.g. image models) where no text/tool
    // chunks arrive for a long time.
    const typingFallbackTimer = setTimeout(async () => {
      if (!typingStarted) {
        await ensureTyping();
        startTypingKeepalive();
      }
    }, 3_000);

    try {
      for await (const chunk of stream.fullStream) {
        // --- Text accumulation ---
        if (chunk.type === 'text-delta') {
          if (chunk.payload.text) {
            await ensureTyping();
            startTypingKeepalive();
          }
          textBuffer += chunk.payload.text;
          continue;
        }

        if (chunk.type === 'reasoning-delta') {
          await ensureTyping();
          startTypingKeepalive();
          continue;
        }

        // --- File (e.g. model-generated image): post as attachment ---
        if (chunk.type === 'file') {
          await flushText();
          const { data, mimeType } = chunk.payload;
          this.logger?.debug('[CHANNEL] Received file chunk', {
            mimeType,
            dataType: typeof data,
            size: typeof data === 'string' ? data.length : (data as Uint8Array)?.byteLength,
          });
          const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
          const filename = `generated.${ext}`;
          const binary =
            typeof data === 'string'
              ? Buffer.from(data, 'base64')
              : data instanceof Uint8Array
                ? Buffer.from(data)
                : data;
          try {
            await sdkThread.post({ markdown: ' ', files: [{ data: binary, filename, mimeType }] });
          } catch (e) {
            this.logger?.debug('[CHANNEL] Failed to post file attachment', { error: e, mimeType, filename });
          }
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
          startTypingKeepalive();
          await flushText();

          const displayName = stripToolPrefix(chunk.payload.toolName);
          const rawArgs = (
            typeof chunk.payload.args === 'object' && chunk.payload.args != null ? chunk.payload.args : {}
          ) as Record<string, unknown>;
          const argsSummary = formatArgsSummary(rawArgs);

          let messageId: string | undefined;
          if (!adapterConfig?.formatToolCall) {
            const sentMessage = await sdkThread.post(formatToolRunning(displayName, argsSummary, useCards));
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
              await this.editOrPost(adapter, sdkThread, channelMsgId, custom);
            }
          } else {
            const resultMessage = formatToolResult(
              displayName,
              argsSummary,
              resultText,
              !!chunk.payload.isError,
              durationMs,
              useCards,
            );
            await this.editOrPost(adapter, sdkThread, channelMsgId, resultMessage);
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

          const approvalMessage = formatToolApproval(displayName, argsSummary, toolCallId, useCards);

          await this.editOrPost(adapter, sdkThread, channelMsgId, approvalMessage);
          continue;
        }

        // --- Tripwire: a processor blocked the agent; surface the reason to the channel.
        // Without this branch the chunk is skipped, stream.error stays unset, and the
        // user sees silence (see #15344).
        if (chunk.type === 'tripwire') {
          // retry=true means the agent will retry internally with the tripwire reason as
          // feedback and produce a new response on this same stream, so nothing to post yet.
          if (chunk.payload.retry) continue;

          await flushText();
          const reason = chunk.payload.reason || 'Your message was blocked by a safety check.';
          const display = chunk.payload.processorId
            ? `🛡️ Blocked by ${chunk.payload.processorId}: ${reason}`
            : `🛡️ ${reason}`;
          await sdkThread.post(display);
          continue;
        }
      }
    } finally {
      clearTimeout(typingFallbackTimer);
      stopTypingKeepalive();
    }

    // Check for errors that occurred during streaming
    if (stream.error) {
      const msg = stream.error.message;
      const display = msg.length > 500 ? msg.slice(0, 500) + '…' : msg;
      this.log('error', `[${platform}] Stream completed with error`, { error: display });
      await sdkThread.post(`❌ Error: ${display}`);
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
