import type { Chat, Adapter, CardElement, ChatConfig, Message, StateAdapter, StreamChunk, Thread } from 'chat';
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
import type { ApiRoute, CorsOptions } from '../server/types';
import type { AgentChunkType } from '../stream/types';
import { createTool } from '../tools/tool';
import { chatModule, getChatModule } from './chat-lazy';

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
import { defaultTypingStatus } from './typing-status';
import type { TypingStatusContext, TypingStatusFn } from './typing-status';

const DEFAULT_INLINE_MEDIA_TYPES: string[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Message content that can be posted to a channel. */
export type PostableMessage = string | CardElement;

/** Per-adapter configuration shared across all `toolDisplay` modes. */
export interface ChannelAdapterBaseConfig {
  adapter: Adapter;
  /**
   * CORS configuration for the generated webhook route for this adapter.
   */
  cors?: CorsOptions;
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
   * Override how errors are rendered in the chat.
   * Return a user-friendly message instead of exposing the raw error.
   *
   * @default `"❌ Error: <error.message>"`
   */
  formatError?: (error: Error) => PostableMessage;

  /**
   * Stream agent text deltas to this adapter as the agent generates them, instead of
   * buffering and posting once per step. On adapters with native streaming (e.g. Slack)
   * this is rendered live; on adapters without it (e.g. Discord) the Chat SDK falls back
   * to post + edit, which can feel noisy — leave it off there.
   *
   * - `false` (default) — buffer text and post once per `step-finish`.
   * - `true` — stream with default options.
   * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
   *
   * @default false
   */
  streaming?: boolean | { updateIntervalMs?: number };

  /**
   * Show platform typing indicators (and adaptive status text where supported,
   * e.g. Slack Assistant mode displays `<App Name> <status>`).
   *
   * - `true` (default) — use built-in defaults:
   *   - `text-delta` → `'is typing…'`
   *   - `tool-call` → `` `is calling ${toolName}…` ``
   *   - `tool-call-approval` → `'is waiting for approval…'`
   * - `false` — disable all typing indicators for this adapter. Useful when
   *   `streaming: true` or `toolDisplay: 'timeline' | 'grouped'` already
   *   surface progress via the live widget.
   * - `(chunk, ctx) => string | false` — custom function called on every chunk
   *   in the agent stream. Return a string to set the typing status; return
   *   `false`/`null`/`undefined` to leave the current status unchanged. The
   *   function fully replaces the defaults (no merging) — import
   *   `defaultTypingStatus` from `@mastra/core/channels` to fall back to
   *   defaults for chunks you don't handle.
   *
   * @example
   * ```ts
   * import { defaultTypingStatus } from '@mastra/core/channels';
   *
   * typingStatus: (chunk, ctx) => {
   *   if (chunk.type === 'tool-call' && chunk.payload.toolName === 'searchDocs') {
   *     return 'is searching docs…';
   *   }
   *   return defaultTypingStatus(chunk, ctx);
   * }
   * ```
   *
   * @default true
   */
  typingStatus?: boolean | TypingStatusFn;
}

/**
 * `'cards'` mode (default): per-tool "Running…" → "Result" cards. This is the
 * only mode where `cards` and `formatToolCall` apply.
 */
export interface ChannelAdapterCardsConfig extends ChannelAdapterBaseConfig {
  /**
   * How tool calls are rendered in the channel.
   *
   * - `'cards'` (default) — per-tool "Running…" → "Result" cards. Only this
   *   mode accepts `cards` and `formatToolCall`.
   * - `'timeline'` — emit `task_update` chunks into the active streaming
   *   session so each tool renders as an inline task card alongside text.
   *   Requires `streaming: true`. Slack renders this natively; other adapters
   *   may render a placeholder or omit the result.
   * - `'grouped'` — same as `'timeline'` but tasks combine into a single plan
   *   block (`StreamingPlan({ groupTasks: 'plan' })`). Requires `streaming: true`.
   * - `'hidden'` — execute tools silently. Only the typing status indicates work.
   *
   * @default 'cards'
   */
  toolDisplay?: 'cards';

  /**
   * Use rich card formatting for tool calls, approvals, and results.
   * Set to `false` to use plain text formatting instead.
   *
   * Some platforms (e.g. Discord) may have rendering issues with cards.
   *
   * @default true
   */
  cards?: boolean;

  /**
   * Override how tool calls are rendered in the chat.
   * Called once per tool invocation after the result is available.
   * Return `null` to suppress the message entirely.
   *
   * Only available in `'cards'` mode (the default). To use a different
   * rendering strategy, set `toolDisplay` to `'timeline'`, `'grouped'`, or
   * `'hidden'` instead.
   *
   * @default - A Card showing the function-call signature and result.
   */
  formatToolCall?: (info: {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    isError?: boolean;
  }) => PostableMessage | null;
}

/**
 * Non-`'cards'` modes: tool calls route through the streaming session (or run
 * silently). `cards` and `formatToolCall` are not available here — they only
 * apply to the `'cards'` renderer.
 */
export interface ChannelAdapterStreamingToolsConfig extends ChannelAdapterBaseConfig {
  /** See {@link ChannelAdapterCardsConfig.toolDisplay} for mode descriptions. */
  toolDisplay: 'timeline' | 'grouped' | 'hidden';
}

/**
 * Per-adapter configuration. `toolDisplay` is a discriminator: in `'cards'`
 * mode (the default) `cards` and `formatToolCall` are available; in
 * `'timeline'` / `'grouped'` / `'hidden'` they are not, because those modes
 * render through the streaming session instead of per-tool cards.
 */
export type ChannelAdapterConfig = ChannelAdapterCardsConfig | ChannelAdapterStreamingToolsConfig;

/**
 * Narrow an adapter config to the `'cards'` variant (where `cards` and
 * `formatToolCall` live), or `undefined` if the adapter is in a non-cards mode.
 */
function asCardsConfig(config: ChannelAdapterConfig | undefined): ChannelAdapterCardsConfig | undefined {
  if (!config) return undefined;
  return !config.toolDisplay || config.toolDisplay === 'cards' ? config : undefined;
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
   * - **Array of globs** — e.g. `['image/png', 'image/jpeg', 'image/webp', 'application/pdf']` (default), `['image/*', 'video/*']`
   * - **Function** — `(mimeType: string) => boolean`
   *
   * @default `['image/png', 'image/jpeg', 'image/webp', 'application/pdf']`
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
 * Default: see `DEFAULT_INLINE_MEDIA_TYPES`.
 */
function buildInlineMediaCheck(config?: string[] | ((mimeType: string) => boolean)): (mimeType: string) => boolean {
  if (typeof config === 'function') return config;
  const patterns = config ?? DEFAULT_INLINE_MEDIA_TYPES;
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
   * eagerly subscribe at startup because the per-thread chunk consumer needs the `sdkThread`
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
  private pendingApprovalCards = new Map<
    string,
    {
      messageId?: string;
      displayName: string;
      argsSummary: string;
      startedAt: number;
      /**
       * runId for the suspended workflow run. Stashed when the approval card is
       * posted so the click handler can resume the correct run by `toolCallId`
       * without crawling persisted message metadata. The metadata path keys by
       * `toolName` and collides when the LLM calls the same tool in parallel
       * (e.g. weather(Vancouver) + weather(SF)) — only the latest write
       * survives, so a lookup for the earlier call's toolCallId would miss.
       */
      runId?: string;
      toolName?: string;
      args?: Record<string, unknown>;
    }
  >();

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
          if (!toolCallId) {
            this.log('info', `Missing toolCallId in action event actionId=${actionId}`);
            return;
          }

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

          // Look up the Mastra thread to find the runId and tool metadata from pending approvals.
          // sdkThread.id encodes channel + threadTs, so it's stable per conversation:
          // top-level DM, DM thread reply, channel mention, and channel thread reply each get
          // their own mastra thread (matching "new convo per slack thread" UX).
          //
          // Slack-specific workaround: the slack adapter's handleBlockActions falls back to
          // `messageTs` when the clicked card has no `thread_ts` (i.e. the card was posted at
          // top level, not inside a thread). That makes the action's sdkThread.id point at a
          // "thread keyed by the card itself" rather than the top-level conversation the user
          // was actually in, so the pending approval lookup misses. Detect that case by
          // checking whether the decoded threadTs equals the clicked message id, and if so,
          // rewrite the externalThreadId to the top-level (empty threadTs) form.
          let externalThreadId = sdkThread.id;
          if (
            platform === 'slack' &&
            messageId &&
            typeof (adapter as { decodeThreadId?: (id: string) => { channel: string; threadTs: string } })
              .decodeThreadId === 'function' &&
            typeof (adapter as { encodeThreadId?: (data: { channel: string; threadTs: string }) => string })
              .encodeThreadId === 'function'
          ) {
            const slackAdapter = adapter as {
              decodeThreadId: (id: string) => { channel: string; threadTs: string };
              encodeThreadId: (data: { channel: string; threadTs: string }) => string;
            };
            const decoded = slackAdapter.decodeThreadId(sdkThread.id);
            if (decoded.threadTs === messageId) {
              externalThreadId = slackAdapter.encodeThreadId({ channel: decoded.channel, threadTs: '' });
            }
          }
          const mastraThread = await this.getOrCreateThread({
            externalThreadId,
            channelId: sdkThread.channelId,
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
          }

          if (!runId) {
            this.log('info', `No pending approval found for toolCallId=${toolCallId}`);
            return;
          }

          // Build the card header with tool name and args
          const displayName = toolName ? stripToolPrefix(toolName) : 'tool';
          const argsSummary = toolArgs ? formatArgsSummary(toolArgs) : '';
          const useCards = asCardsConfig(adapterConfig)?.cards !== false;

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

            // Resume the suspended run with a denial so the agent can produce a follow-up
            // message (e.g. acknowledging the rejection). Without this, the run stays
            // suspended forever and the user gets no feedback from the model.
            const { channelContext } = this.buildEventContext({
              sdkThread,
              platform,
              eventType: 'action',
              messageId,
              actor: event.user,
            });
            const requestContext = new RequestContext();
            requestContext.set('channel', channelContext);

            this.ensureThreadSubscription({
              mastraThreadId: mastraThread.id,
              resourceId: mastraThread.resourceId,
              sdkThread,
              platform,
            });

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
            await adapter.editMessage(sdkThread.id, messageId, formatToolApproved(displayName, argsSummary, useCards));
          } catch (err) {
            this.log('debug', 'Failed to edit approved card', err);
          }

          // Build request context for the resumed stream.
          const { channelContext } = this.buildEventContext({
            sdkThread,
            platform,
            eventType: 'action',
            messageId,
            actor: event.user,
          });
          const requestContext = new RequestContext();
          requestContext.set('channel', channelContext);

          // The resumed run fans into the thread subscription, so the consumer running there
          // will render the tool-result and any follow-up output. Ensure the subscription
          // is live (e.g. if the bot restarted between the approval card being posted and
          // the user clicking it) and stash the approval card's message id so the consumer
          // can edit it in place when the tool-result chunk arrives.
          this.ensureThreadSubscription({
            mastraThreadId: mastraThread.id,
            resourceId: mastraThread.resourceId,
            sdkThread,
            platform,
          });
          if (toolCallId) {
            this.pendingApprovalCards.set(toolCallId, {
              messageId,
              displayName,
              argsSummary,
              startedAt: Date.now(),
            });
          }

          // approveToolCall returns a MastraModelOutput whose stream must be drained for
          // the resumed run to actually execute. The chunks fan into the thread
          // subscription via the pubsub keyed by resourceId+threadId, so the existing
          // consumer renders the tool result and follow-up output; we just need to pump
          // the stream forward here.
          const resumed = await this.agent.approveToolCall({
            runId,
            toolCallId,
            requestContext,
            memory: {
              thread: mastraThread.id,
              resource: mastraThread.resourceId,
            },
          });
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
    sdkThread: Thread;
    platform: string;
    eventType: string;
    messageId: string | undefined;
    actor: { userId: string; userName?: string; fullName?: string; isBot?: boolean | 'unknown' };
  }): {
    channelContext: ChannelContext;
    attributes: Record<string, string | undefined>;
    providerOptions: MastraProviderMetadata;
  } {
    const { sdkThread, platform, eventType, messageId, actor } = params;
    const adapter = this.adapters[platform]!;
    const botUserId = adapter.botUserId;
    const botMention = botUserId ? sdkThread.mentionUser(botUserId) : undefined;
    const actorName = actor.fullName || actor.userName;
    const actorMention = actor.userId ? sdkThread.mentionUser(actor.userId) : undefined;

    const channelContext: ChannelContext = {
      platform,
      eventType,
      isDM: sdkThread.isDM,
      threadId: sdkThread.id,
      channelId: sdkThread.channelId,
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
    if (!sdkThread.isDM) {
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
    const platform = sdkThread.adapter.name;

    // Map to a Mastra thread for memory/history.
    // sdkThread.id encodes channel + threadTs, so it's stable per conversation:
    // each Slack thread (including top-level DM, DM thread reply, channel mention, and
    // channel thread reply) gets its own mastra thread.
    const externalThreadId = sdkThread.id;
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
    let historyBlock: string | undefined; // TODO: convert platform thread chat history into Mastra messages instead of one big text block
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
    const useCards = asCardsConfig(adapterConfig)?.cards !== false;

    const { channelContext, attributes, providerOptions } = this.buildEventContext({
      sdkThread,
      platform,
      eventType: sdkThread.isDM ? 'message' : 'mention',
      messageId: message.id,
      actor: message.author,
    });

    const requestContext = new RequestContext();
    requestContext.set('channel', channelContext);

    this.ensureThreadSubscription({
      mastraThreadId: mastraThread.id,
      resourceId: threadResourceId,
      sdkThread,
      platform,
    });

    // Subscribe BEFORE sending the signal so the subscription metadata write
    // happens before the agent run loads the thread snapshot. Otherwise the
    // in-flight agent run can read the thread pre-subscribe and later
    // overwrite the `channel_subscribed` field via its own thread persistence.
    await sdkThread.subscribe();

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
            // Without cards, we can't show approval buttons — auto-approve tools instead
            autoResumeSuspendedTools: useCards ? undefined : true,
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

  /**
   * Lazily open (and cache) an `agent.subscribeToThread()` for a Mastra thread, attaching a
   * background chunk consumer that renders run output to the originating chat platform. We
   * cache by `mastraThreadId` so multiple incoming messages on the same thread share one
   * subscription and run output is never rendered twice.
   *
   * If the underlying consumer throws (e.g. the platform `sdkThread` becomes unusable), we
   * tear down the cache entry so the next message can reopen a fresh subscription.
   */
  private ensureThreadSubscription(params: {
    mastraThreadId: string;
    resourceId: string;
    sdkThread: Thread;
    platform: string;
  }): AgentThreadSubscription<any> {
    const { mastraThreadId, resourceId, sdkThread, platform } = params;
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

    const consumer = this.consumeAgentStream(stream, sdkThread, platform).catch(err => {
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
    sdkThread: Thread,
    platform: string,
    approvalContext?: { toolCallId: string; messageId: string },
  ): Promise<void> {
    const adapter = this.adapters[platform]!;
    const adapterConfig = this.adapterConfigs[platform];
    const cardsConfig = asCardsConfig(adapterConfig);
    const useCards = cardsConfig?.cards !== false;

    // Streaming is configured per-adapter so platforms with native streaming (e.g. Slack)
    // can opt in independently of platforms that fall back to noisy post + edit (e.g. Discord).
    const streamingConfig = adapterConfig?.streaming ?? false;
    const streamingEnabled = streamingConfig !== false;
    const streamingOptions = streamingConfig === true ? {} : streamingConfig === false ? undefined : streamingConfig;

    // Resolve the tool-display mode once per run. `'timeline'` and `'grouped'`
    // require streaming because they push `task_update` chunks into the
    // streaming session — fall back to `'cards'` (with a one-time warn) if a
    // user asks for them without enabling streaming.
    const requestedToolDisplay = adapterConfig?.toolDisplay ?? 'cards';
    let toolDisplay: 'cards' | 'timeline' | 'grouped' | 'hidden' = requestedToolDisplay;
    if ((toolDisplay === 'timeline' || toolDisplay === 'grouped') && !streamingEnabled) {
      if (!this.warnedToolDisplayFallback.has(platform)) {
        this.warnedToolDisplayFallback.add(platform);
        this.log(
          'warn',
          `[${platform}] toolDisplay: '${toolDisplay}' requires streaming: true; falling back to 'cards'.`,
        );
      }
      toolDisplay = 'cards';
    }
    const groupTasks: 'plan' | 'timeline' | undefined =
      toolDisplay === 'timeline' ? 'timeline' : toolDisplay === 'grouped' ? 'plan' : undefined;

    // Resolve `typingStatus` config once per run:
    //   - `false` → no typing indicators at all
    //   - `true` (default) → built-in `defaultTypingStatus` (per-chunk-type map)
    //   - function → user-supplied resolver, called on every chunk; fully
    //     replaces the defaults (compose with `defaultTypingStatus` to fall
    //     back for chunks the user doesn't handle)
    const typingStatusOption = adapterConfig?.typingStatus;
    const typingStatusFn: TypingStatusFn | null =
      typingStatusOption === false
        ? null
        : typeof typingStatusOption === 'function'
          ? typingStatusOption
          : defaultTypingStatus;

    interface TrackedTool {
      toolName: string;
      args: unknown;
      displayName: string;
      argsSummary: string;
      startedAt: number;
      messageId?: string; // platform message ID for editing
    }

    // Per-run rendering state. A single subscription stream can carry many runs back-to-back,
    // so we reset on every run boundary (finish / error / abort) to avoid leaking tool cards
    // or pending text from one run into the next.
    let textBuffer = '';
    let toolCalls = new Map<string, TrackedTool>();

    // Adaptive typing status: only call startTyping(status) when the status text
    // actually changes — avoids hammering the platform API on every text-delta.
    // Slack Assistant mode displays the status; other adapters show a generic
    // typing indicator and ignore the text.
    let currentTypingStatus: string | undefined;
    const emitTypingStatus = (chunk: AgentChunkType<any>) => {
      if (!typingStatusFn) return;
      let result: ReturnType<TypingStatusFn>;
      try {
        const ctx: TypingStatusContext = {
          platform,
          threadId: sdkThread.id,
          toolCalls,
          currentStatus: currentTypingStatus,
        };
        result = typingStatusFn(chunk, ctx);
      } catch (e) {
        this.logger?.debug('[CHANNEL] typingStatus function threw (continuing)', { error: e });
        return;
      }
      if (typeof result !== 'string' || result.length === 0) return;
      if (result === currentTypingStatus) return;
      currentTypingStatus = result;
      sdkThread.startTyping(result).catch(e => {
        this.logger?.debug('[CHANNEL] Typing indicator failed (best-effort)', { error: e });
      });
    };

    // Streaming text session: when `streaming` is enabled, text deltas push into
    // an async iterable consumed by `sdkThread.post(...)` so the platform sees
    // text progressively. The session opens on the first text-delta of a run and
    // closes on step-finish / finish / error / abort / out-of-band chunk so the
    // next message (tool card, file, follow-up text) lands in the right order.
    interface StreamingSession {
      push: (piece: string | StreamChunk) => void;
      close: () => void;
      done: Promise<void>;
    }
    let streamingSession: StreamingSession | null = null;

    const openStreamingSession = (): StreamingSession => {
      let buffer: (string | StreamChunk)[] = [];
      let closed = false;
      let resolveNext: (() => void) | undefined;
      const waitForNext = () =>
        new Promise<void>(resolve => {
          resolveNext = resolve;
        });

      async function* iterate(): AsyncGenerator<string | StreamChunk> {
        while (true) {
          while (buffer.length > 0) {
            yield buffer.shift()!;
          }
          if (closed) return;
          await waitForNext();
        }
      }

      const iterable = iterate();
      // When `toolDisplay` is `'timeline'` or `'grouped'` we let `StreamingPlan`
      // group the `task_update` chunks for us — `'timeline'` keeps each tool as
      // its own inline card; `'grouped'` collapses them into one plan block.
      const postable = streamingOptions
        ? new (chatModule().StreamingPlan)(iterable, {
            updateIntervalMs: streamingOptions.updateIntervalMs,
            ...(groupTasks ? { groupTasks } : {}),
          })
        : iterable;

      const done = (async () => {
        try {
          await sdkThread.post(postable as Parameters<Thread['post']>[0]);
        } catch (e) {
          this.logger?.warn('[CHANNEL] streaming post failed, falling back to buffered text', { error: e });
          // Drain whatever was queued plus anything pushed after the failure
          // and post it as a single buffered message. Drop non-string chunks
          // (task_update etc.) since the buffered fallback is text-only. Keep
          // draining until the stream actually closes so late text-deltas
          // don't get dropped from the fallback message.
          let fallback = '';
          while (true) {
            fallback += buffer.filter((p): p is string => typeof p === 'string').join('');
            buffer = [];
            if (closed) break;
            await waitForNext();
          }
          const cleaned = fallback.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          if (cleaned) {
            try {
              await sdkThread.post(cleaned);
            } catch (postErr) {
              this.logger?.debug('[CHANNEL] buffered fallback also failed', { error: postErr });
            }
          }
        }
      })();

      return {
        push: piece => {
          if (closed) return;
          buffer.push(piece);
          if (resolveNext) {
            const r = resolveNext;
            resolveNext = undefined;
            r();
          }
        },
        close: () => {
          if (closed) return;
          closed = true;
          if (resolveNext) {
            const r = resolveNext;
            resolveNext = undefined;
            r();
          }
        },
        done,
      };
    };

    const closeStreamingSession = async () => {
      if (!streamingSession) return;
      const session = streamingSession;
      streamingSession = null;
      session.close();
      await session.done;
    };

    const seedApprovalContext = () => {
      if (approvalContext) {
        toolCalls.set(approvalContext.toolCallId, {
          toolName: '',
          args: {},
          displayName: '',
          argsSummary: '',
          startedAt: Date.now(),
          messageId: approvalContext.messageId,
        });
      }
    };
    seedApprovalContext();

    const flushText = async () => {
      // Streaming path: close the active streaming session (if any) so that
      // any subsequent out-of-band post (tool card, file, error) lands after
      // the streamed text in platform message order.
      if (streamingEnabled) {
        await closeStreamingSession();
        return;
      }
      // Buffered path: strip zero-width chars (U+200B, U+200C, U+200D, U+FEFF)
      // that LLMs sometimes emit, then post the accumulated text.
      const cleanedText = textBuffer.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (cleanedText) {
        await sdkThread.post(cleanedText);
        textBuffer = '';
      }
    };

    const resetRunState = () => {
      textBuffer = '';
      toolCalls = new Map();
      seedApprovalContext();
      currentTypingStatus = undefined;
    };

    for await (const chunk of stream) {
      // Adaptive typing status: one call per chunk, resolved via the configured
      // `typingStatus` function (built-in defaults when `typingStatus: true`).
      // De-duped against the currently displayed status inside `emitTypingStatus`.
      emitTypingStatus(chunk);

      // --- Signal echo: subscription streams replay user-message / system-reminder /
      // custom data parts that callers wrote via sendSignal(). The platform already
      // rendered the user's message, so we drop the echo to avoid double-posting.
      // For `data-user-message` echoes, flush any in-flight text first so the
      // agent's response to the signal renders as its own message after the
      // user's signal message instead of streaming into the prior reply.
      const chunkType = chunk.type as string;
      if (typeof chunkType === 'string' && chunkType.startsWith('data-')) {
        if (chunkType === 'data-user-message') {
          await flushText();
        }
        continue;
      }

      // --- Text accumulation ---
      if (chunk.type === 'text-delta') {
        const piece = chunk.payload.text;
        if (!piece) continue;
        if (streamingEnabled) {
          if (!streamingSession) streamingSession = openStreamingSession();
          streamingSession.push(piece);
        } else {
          textBuffer += piece;
        }
        continue;
      }

      // Flush as soon as the model finishes a text block so the message
      // posts before any subsequent tool call status updates.
      if (chunk.type === 'text-end') {
        await flushText();
        continue;
      }

      // Note: we intentionally do NOT set a `Thinking…` typing status on
      // `reasoning-delta` or `tool-result`. The platform's own typing
      // indicator already conveys "the agent is doing something"; layering
      // `Thinking…` on top tended to get stuck on screen after the run
      // finished and added noise between tool calls.

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
      if (chunk.type === 'step-finish') {
        // In `'grouped'` mode keep the streaming session open across steps
        // so the whole run renders as a single StreamingPlan post instead
        // of one widget per step.
        if (toolDisplay === 'grouped') continue;
        await flushText();
        continue;
      }

      // --- Run boundary: a single subscription stream carries many runs back-to-back,
      // so we flush whatever's pending and reset per-run state before the next run starts.
      if (chunk.type === 'finish') {
        await flushText();
        resetRunState();
        continue;
      }

      // --- Errors / aborts surface in-stream now that we no longer have access to a
      // MastraModelOutput.error field. Post the failure to the channel and reset state
      // so a follow-up run on the same subscription starts clean.
      if (chunk.type === 'error') {
        await flushText();
        const errPayload = chunk.payload as { error?: unknown };
        const rawError = errPayload.error;
        const message =
          rawError instanceof Error
            ? rawError.message
            : typeof rawError === 'string'
              ? rawError
              : rawError != null
                ? String(rawError)
                : 'Unknown error';
        const display = message.length > 500 ? message.slice(0, 500) + '…' : message;
        this.log('error', `[${platform}] Stream completed with error`, { error: display });
        try {
          await sdkThread.post(`❌ Error: ${display}`);
        } catch (postErr) {
          this.logger?.debug('[CHANNEL] Failed to post error message', { error: postErr });
        }
        resetRunState();
        continue;
      }

      if (chunk.type === 'abort') {
        await flushText();
        resetRunState();
        continue;
      }

      // --- Tool call ---
      if (chunk.type === 'tool-call') {
        if (this.channelToolNames.has(chunk.payload.toolName)) continue;
        const displayName = stripToolPrefix(chunk.payload.toolName);
        const rawArgs = (
          typeof chunk.payload.args === 'object' && chunk.payload.args != null ? chunk.payload.args : {}
        ) as Record<string, unknown>;
        const argsSummary = formatArgsSummary(rawArgs);

        // `'hidden'`: never render anything — just track the call so the result
        // handler can correlate, but skip cards and `task_update` chunks alike.
        // Flush any pending text first so it posts before the silent tool runs;
        // otherwise the user sees the "Calling…" typing status with no leading
        // message until the tool resolves.
        if (toolDisplay === 'hidden') {
          await flushText();
          toolCalls.set(chunk.payload.toolCallId, {
            toolName: chunk.payload.toolName,
            args: chunk.payload.args,
            displayName,
            argsSummary,
            startedAt: Date.now(),
            messageId: undefined,
          });
          continue;
        }

        // `'timeline'` / `'grouped'`: push a `task_update` into the active
        // streaming session so the platform renders the tool inline with the
        // streaming text (Slack natively; other adapters may render a
        // placeholder). The session is shared with text-deltas so chunks
        // interleave in platform message order under one StreamingPlan post.
        if (toolDisplay === 'timeline' || toolDisplay === 'grouped') {
          // Close any active text-only session first so preceding text posts
          // as its own platform message. Slack's AI Assistant widget always
          // renders tasks above markdown body within a single post, so
          // interleaving text and tools requires separate messages.
          // In `'grouped'` mode we keep the streaming session open across
          // text+tool turns so the plan widget accumulates every task in one
          // post. Splitting on the first tool produced one widget per step,
          // which buried earlier tool calls.
          if (streamingSession && toolCalls.size === 0 && toolDisplay !== 'grouped') {
            await closeStreamingSession();
          }
          if (!streamingSession) streamingSession = openStreamingSession();
          // Track the active task as the plan title so Slack's AI Assistant
          // Thinking Steps widget shows the current tool instead of the
          // default "Thinking…"/"completed" labels. Mirrors the behavior of
          // Chat SDK `Plan.addTask` which overwrites the plan title on each
          // new task.
          // For `'grouped'` fold args inline into the title so the at-a-glance
          // widget stays a single line per call (e.g. `read_file foo.md`).
          // `'timeline'` keeps args on a second `details` line — each task has
          // its own row so the extra line reads fine and is more scannable.
          const taskTitle = toolDisplay === 'grouped' && argsSummary ? `${displayName} ${argsSummary}` : displayName;
          if (toolDisplay === 'grouped') {
            // Mirror the task title (with inline args) into the plan title so
            // Slack's AI Assistant Thinking Steps widget shows the current
            // tool + args instead of the default "Thinking…"/"completed".
            streamingSession.push({ type: 'plan_update', title: taskTitle });
          }
          streamingSession.push({
            type: 'task_update',
            id: chunk.payload.toolCallId,
            title: taskTitle,
            status: 'in_progress',
            details: toolDisplay === 'grouped' ? undefined : argsSummary || undefined,
          });
          toolCalls.set(chunk.payload.toolCallId, {
            toolName: chunk.payload.toolName,
            args: chunk.payload.args,
            displayName,
            argsSummary,
            startedAt: Date.now(),
            messageId: undefined,
          });
          continue;
        }

        // `'cards'` (default): post an eager "Running…" card that the result
        // handler will edit in place. Skip the eager post when a custom
        // `formatToolCall` is configured — that runs once on tool-result with
        // the full result and we don't want a leading placeholder card.
        await flushText();
        let messageId: string | undefined;
        if (!cardsConfig?.formatToolCall) {
          const sentMessage = await sdkThread.post(formatToolRunning(displayName, argsSummary, useCards));
          messageId = sentMessage?.id;
        }

        toolCalls.set(chunk.payload.toolCallId, {
          toolName: chunk.payload.toolName,
          args: chunk.payload.args,
          displayName,
          argsSummary,
          startedAt: Date.now(),
          messageId,
        });
        continue;
      }

      // --- Tool result ---
      if (chunk.type === 'tool-result') {
        if (this.channelToolNames.has(chunk.payload.toolName)) continue;

        // Look in the per-run tracked tools first; fall back to any approval card that was
        // posted by the click handler (the resumed run's tool-result arrives via the thread
        // subscription, which doesn't see the pre-suspension `tool-call` chunk).
        let tracked = toolCalls.get(chunk.payload.toolCallId);
        if (!tracked) {
          const pending = this.pendingApprovalCards.get(chunk.payload.toolCallId);
          if (pending) {
            tracked = {
              ...pending,
              toolName: pending.toolName ?? chunk.payload.toolName,
              args: pending.args ?? chunk.payload.args ?? {},
            };
            this.pendingApprovalCards.delete(chunk.payload.toolCallId);
          }
        }
        const displayName = tracked?.displayName || stripToolPrefix(chunk.payload.toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(chunk.payload.args ?? {});
        const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
        const channelMsgId = tracked?.messageId;
        const durationMs = tracked?.startedAt != null ? Date.now() - tracked.startedAt : undefined;

        // `'hidden'`: drop the result silently.
        if (toolDisplay === 'hidden') continue;

        // `'timeline'` / `'grouped'`: complete the task in place. We don't
        // repeat `details` here — the Chat SDK appends to the existing task
        // entry by id, so re-sending the args would show them twice.
        //
        // For `'grouped'` we suppress the full result body and just mark the
        // task complete — `grouped` is an at-a-glance summary of what the
        // agent did, not a detailed trace. Errors still get the full text so
        // failures stay debuggable. `'timeline'` shows the full result.
        if (toolDisplay === 'timeline' || toolDisplay === 'grouped') {
          if (!streamingSession) streamingSession = openStreamingSession();
          // Mirror the inline-args title from the tool-call handler so the
          // completed task keeps the same `read_file foo.md` label instead
          // of collapsing back to the bare tool name.
          const taskTitle = toolDisplay === 'grouped' && argsSummary ? `${displayName} ${argsSummary}` : displayName;
          const groupedOutput = chunk.payload.isError ? resultText || undefined : undefined;
          streamingSession.push({
            type: 'task_update',
            id: chunk.payload.toolCallId,
            title: taskTitle,
            status: chunk.payload.isError ? 'error' : 'complete',
            output: toolDisplay === 'grouped' ? groupedOutput : resultText || undefined,
          });
          continue;
        }

        // `'cards'`: edit the "Running…" card with the result, or post the
        // user-provided custom formatting.
        if (cardsConfig?.formatToolCall) {
          const custom = cardsConfig.formatToolCall({
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

      // --- Tool approval: post an out-of-band Approve/Deny card. ---
      // Approvals always render as a separate card because `task_update` chunks
      // can't carry interactive buttons. In non-`'cards'` modes we close the
      // streaming session first so the approval card lands cleanly after the
      // timeline/grouped block instead of getting swallowed by it.
      if (chunk.type === 'tool-call-approval') {
        const { toolCallId, toolName, args: toolArgs } = chunk.payload;
        const tracked = toolCalls.get(toolCallId);
        const displayName = tracked?.displayName || stripToolPrefix(toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(toolArgs);
        const channelMsgId = tracked?.messageId;

        if (toolDisplay !== 'cards') {
          await closeStreamingSession();
        }

        // `useCards` is always true here so the approve/deny buttons render as
        // a Block Kit actions block; non-cards modes never set `cards: false`.
        const approvalMessage = formatToolApproval(displayName, argsSummary, toolCallId, useCards);

        await this.editOrPost(adapter, sdkThread, channelMsgId, approvalMessage);

        // Stash the runId by toolCallId so the click handler can resume the
        // correct run directly, without crawling persisted message metadata.
        // The metadata path keys by toolName and collides on parallel
        // same-tool approvals — only the latest write survives, so the
        // earlier call's click would silently miss.
        this.pendingApprovalCards.set(toolCallId, {
          messageId: channelMsgId,
          displayName,
          argsSummary,
          startedAt: Date.now(),
          runId: chunk.runId,
          toolName,
          args: toolArgs,
        });
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
