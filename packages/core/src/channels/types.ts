import type { Adapter, CardElement, ChatConfig, Message, StateAdapter, StreamChunk, Thread } from 'chat';

import type { Mastra } from '../mastra';
import type { ApiRoute, CorsOptions } from '../server/types';
import type { InlineLinkEntry } from './inline-media';
import type { TypingStatusFn } from './typing-status';
import type { WaitUntilFn, WaitUntilResolver } from './wait-until';

export type { InlineLinkEntry } from './inline-media';

// =============================================================================
// Agent-side configuration types (consumer-facing)
// =============================================================================

/** Message content that can be posted to a channel. */
export type PostableMessage = string | CardElement;

/** Per-adapter configuration shared across all `toolDisplay` modes. */
export interface ChannelAdapterBaseConfig {
  adapter: Adapter<any, any>;
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
 * How tool calls are rendered in the channel.
 *
 * String modes:
 * - `'cards'` — per-tool "Running…" → "Result" Block Kit cards. Default when
 *   `streaming: false`. Requires `streaming: false`.
 * - `'text'` — per-tool plain-text messages (no Block Kit). Good for platforms
 *   without rich card rendering (e.g. Discord). Requires `streaming: false`.
 * - `'timeline'` — emit `task_update` chunks into the active streaming session
 *   so each tool renders as an inline task card alongside text. Default when
 *   `streaming: true`. Requires `streaming: true`. Slack renders this
 *   natively; other adapters may render a placeholder.
 * - `'grouped'` — same as `'timeline'` but tasks combine into a single plan
 *   widget (`StreamingPlan({ groupTasks: 'plan' })`). Requires `streaming: true`.
 * - `'hidden'` — execute tools silently. Only the typing status indicates work.
 *
 * Function form: custom renderer. See {@link ToolDisplayFn}.
 *
 * Mismatched string modes (e.g. `'cards'` with `streaming: true`) warn once
 * per platform and fall back to the streaming-appropriate default.
 */
export type ToolDisplay = 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden' | ToolDisplayFn;

/**
 * Custom tool-call renderer. Called once per tool lifecycle event (running,
 * result, error, approval). Returns either a postable message (closes the
 * streaming session if open, posts/edits the message, then reopens on the
 * next chunk), a streaming chunk (pushed into the streaming session — opens
 * one lazily if needed), or `undefined` to skip the event.
 *
 * In static drivers (`streaming: false`), returning `{ kind: 'stream' }`
 * flattens the chunk to a plain-text fallback message.
 */
export type ToolDisplayFn = (event: ToolDisplayEvent, ctx: ToolDisplayContext) => ToolDisplayResult;

/**
 * Per-event payload passed to {@link ToolDisplayFn}.
 *
 * Every variant carries `toolCallId` — a stable identifier for this
 * specific tool invocation. Use it to correlate `running`/`result`/`error`/
 * `approval` events for the same call (e.g. to edit a previously posted
 * message, or as the `id` on a streamed `task_update` so the SDK updates
 * the row in place rather than appending a new one). It is unique even
 * when the same tool is called in parallel.
 */
export type ToolDisplayEvent =
  | {
      kind: 'running';
      toolCallId: string;
      toolName: string;
      displayName: string;
      argsSummary: string;
      args: unknown;
    }
  | {
      kind: 'result';
      toolCallId: string;
      toolName: string;
      displayName: string;
      argsSummary: string;
      args: unknown;
      result: unknown;
      resultText: string;
      durationMs: number;
      isError: boolean;
    }
  | {
      kind: 'error';
      toolCallId: string;
      toolName: string;
      displayName: string;
      argsSummary: string;
      args: unknown;
      error: unknown;
      errorText: string;
      durationMs: number;
    }
  | {
      kind: 'approval';
      toolCallId: string;
      toolName: string;
      displayName: string;
      argsSummary: string;
      args: unknown;
    };

/** Context about which driver is consuming the function-form result. */
export interface ToolDisplayContext {
  /** Which driver is consuming the result. */
  mode: 'streaming' | 'static';
  /** Adapter platform key (e.g. `'slack'`, `'discord'`). */
  platform: string;
}

/** Return value from a {@link ToolDisplayFn}. */
export type ToolDisplayResult =
  { kind: 'post'; message: PostableMessage } | { kind: 'stream'; chunk: StreamChunk } | undefined | void;

/**
 * Stream agent text deltas to this adapter as the agent generates them, instead of
 * buffering and posting once per step. On adapters with native streaming (e.g. Slack)
 * this is rendered live; on adapters without it (e.g. Discord) the Chat SDK falls back
 * to post + edit, which can feel noisy — leave it off there.
 *
 * - `true` — stream with default options.
 * - `{ updateIntervalMs }` — stream with a custom post-and-edit interval.
 */
export type StreamingConfig = boolean | { updateIntervalMs?: number };

/**
 * `toolDisplay` modes that need a live streaming session (`StreamingPlan`) to
 * render. Only valid when `streaming: true | { ... }`.
 */
export type StreamingOnlyToolDisplay = 'timeline' | 'grouped';

/**
 * `toolDisplay` modes that post discrete messages and work regardless of
 * whether streaming is enabled.
 */
export type StaticToolDisplay = 'cards' | 'text' | 'hidden' | ToolDisplayFn;

/**
 * Per-adapter configuration with `streaming: false` (or omitted). Restricts
 * `toolDisplay` to static modes (`'cards' | 'text' | 'hidden' | ToolDisplayFn`)
 * since `'timeline'` and `'grouped'` need a live streaming session.
 */
export interface ChannelAdapterStaticConfig extends ChannelAdapterBaseConfig {
  /** @default false */
  streaming?: false;
  /** See {@link ToolDisplay} for mode descriptions. */
  toolDisplay?: StaticToolDisplay;
  cards?: never;
  formatToolCall?: never;
}

/**
 * Per-adapter configuration with `streaming` enabled. Allows any
 * `toolDisplay` mode, including the streaming-only `'timeline'` and
 * `'grouped'` modes that emit `task_update`/`plan_update` chunks into the
 * active streaming session.
 */
export interface ChannelAdapterStreamingConfig extends ChannelAdapterBaseConfig {
  streaming: Exclude<StreamingConfig, false>;
  /** See {@link ToolDisplay} for mode descriptions. */
  toolDisplay?: ToolDisplay;
  cards?: never;
  formatToolCall?: never;
}

/**
 * Per-adapter configuration. The `streaming` flag discriminates which
 * `toolDisplay` modes are allowed: `'timeline'` and `'grouped'` need a
 * streaming session (`StreamingPlan`), so they're only available when
 * `streaming` is enabled. `'cards' | 'text' | 'hidden' | ToolDisplayFn`
 * work in either mode.
 *
 * The legacy branch ({@link ChannelAdapterLegacyConfig}) is mutually
 * exclusive with `toolDisplay` and kept for backwards compatibility.
 */
export type ChannelAdapterConfig =
  ChannelAdapterStaticConfig | ChannelAdapterStreamingConfig | ChannelAdapterLegacyConfig;

/**
 * @deprecated Legacy shape: the old `cards` boolean and `formatToolCall`
 * callback. Both options still work at runtime and are mutually exclusive
 * with `toolDisplay`. Will be removed in a future major; migrate to
 * `toolDisplay` instead.
 */
export interface ChannelAdapterLegacyConfig extends ChannelAdapterBaseConfig {
  /** See {@link StreamingConfig}. */
  streaming?: StreamingConfig;
  toolDisplay?: never;
  /**
   * @deprecated Use `toolDisplay` instead.
   * `cards: true` is equivalent to `toolDisplay: 'cards'`,
   * `cards: false` is equivalent to `toolDisplay: 'text'`.
   */
  cards?: boolean;
  /**
   * @deprecated Use `toolDisplay` (function form) instead.
   *
   * Migration:
   * ```ts
   * // before
   * formatToolCall: ({ toolName, args, result, isError }) => `${toolName}: ${result}`
   * // after
   * toolDisplay: event => {
   *   if (event.kind !== 'result' && event.kind !== 'error') return undefined;
   *   const value = event.kind === 'result' ? event.result : event.error;
   *   return { kind: 'post', message: `${event.toolName}: ${value}` };
   * }
   * ```
   *
   * Custom per-tool result/error renderer. Called once on `tool-result` and
   * once on `tool-error`. Return a message to post (replacing the eager
   * "Running…" card), or `null` to skip rendering. When set, the eager
   * "Running…" card is suppressed.
   */
  formatToolCall?: (info: {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    isError?: boolean;
  }) => PostableMessage | null;
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

/**
 * Context passed to {@link ChannelConfig.resolveResourceId}.
 * Lets an app decide who owns resource-level memory for a channel thread,
 * separately from who sent the message (`message.author`).
 */
export interface ResolveResourceIdContext {
  /** Platform name (e.g. 'slack', 'discord'). */
  platform: string;
  /** The channel thread the message arrived on. Use `thread.isDM` to tell DMs from group/channel threads. */
  thread: Thread;
  /** The incoming message. `message.author.userId` is the actor/sender, not necessarily the memory owner. */
  message: Message;
  /** The built-in default: `${platform}:${message.author.userId}`. Return this to keep current behavior. */
  defaultResourceId: string;
}

/**
 * Resolve the memory `resourceId` (the owner of resource-level memory) for a channel
 * thread before it's created.
 */
export type ResolveResourceId = (ctx: ResolveResourceIdContext) => string | Promise<string>;

/**
 * Context passed to {@link ChannelConfig.resolveThreadId}.
 * Runs after {@link ChannelConfig.resolveResourceId}, so the resolved owner is
 * available when picking the thread id.
 */
export interface ResolveThreadIdContext {
  /** Platform name (e.g. 'slack', 'discord'). */
  platform: string;
  /** The channel thread the message arrived on. Use `thread.isDM` to tell DMs from group/channel threads. */
  thread: Thread;
  /** The incoming message. */
  message: Message;
  /** The resolved memory resourceId the new thread will belong to (after `resolveResourceId`). */
  resourceId: string;
  /** The built-in default: a random UUID. Return this to keep current behavior. */
  defaultThreadId: string;
}

/**
 * Resolve the internal Mastra thread id for a channel thread before it's created.
 * The returned id must be unique across the memory store — reusing an existing
 * thread's id would write the conversation into that thread.
 */
export type ResolveThreadId = (ctx: ResolveThreadIdContext) => string | Promise<string>;

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
  adapters: Record<string, ChannelAdapterConfig | Adapter<any, any>>;

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

    /**
     * Whether to add a built-in system message telling the agent which
     * channel/platform a request came from (DM vs public, bot identity, etc.).
     * Set to `false` to skip it entirely.
     *
     * @default true
     */
    addSystemMessage?: boolean;
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

  /**
   * Resolve the memory `resourceId` (the owner of resource-level memory) before a
   * channel thread is created. This lets an app decide memory ownership separately
   * from who sent the message. For example, share an SSO user's memory across Web and a
   * Feishu/Lark DM (drop the platform prefix), or scope a group chat to its `chat_id`.
   *
   * Only affects **newly-created** threads. Once a thread exists it keeps its stored
   * `resourceId`, so this never relocates memory on an existing conversation.
   *
   * Return `defaultResourceId` (`${platform}:${message.author.userId}`) to keep the
   * built-in behavior. Not set: behavior is unchanged.
   *
   * @example
   * ```ts
   * resolveResourceId: async ({ thread, message, defaultResourceId }) => {
   *   if (thread.isDM) return resolveSsoUserId(message);   // shared with Web
   *   return thread.channelId;                             // group owns the memory
   * }
   * ```
   */
  resolveResourceId?: ResolveResourceId;

  /**
   * Resolve the internal Mastra thread id before a channel thread is created.
   * Runs after {@link resolveResourceId}, with the resolved owner on the context,
   * so a host can align the thread id with an id it controls — e.g. give the
   * thread the same id as the session it belongs to, matching how that host
   * names threads it creates itself.
   *
   * Only affects **newly-created** threads; existing threads keep their stored id.
   * The returned id must be unique across the memory store.
   *
   * Return `defaultThreadId` (a random UUID) to keep the built-in behavior.
   * Not set: behavior is unchanged.
   *
   * @example
   * ```ts
   * resolveThreadId: ({ resourceId, defaultThreadId }) => {
   *   return isSessionId(resourceId) ? resourceId : defaultThreadId;
   * }
   * ```
   */
  resolveThreadId?: ResolveThreadId;

  /**
   * Keep the serverless invocation alive while background work (agent stream → platform)
   * runs after the webhook returns 200. Required on Vercel/AWS Lambda — without it the
   * runtime freezes the function as soon as the response is sent, killing in-flight runs.
   *
   * Pass the bare `waitUntil(promise)` function imported from your platform's SDK.
   * Cloudflare Workers and Netlify users typically don't need this — core resolves
   * `waitUntil` from `c.executionCtx` and `c.env.context` automatically.
   *
   * If `waitUntil` requires the request context to derive, use {@link resolveWaitUntil}
   * instead.
   *
   * @example
   * ```ts
   * // Vercel
   * import { waitUntil } from '@vercel/functions';
   * channels: { adapters: { ... }, waitUntil }
   * ```
   */
  waitUntil?: WaitUntilFn;

  /**
   * Resolve `waitUntil` from the request's Hono `Context`. Use this when the runtime
   * exposes `waitUntil` through the request and core's default resolver doesn't cover
   * it (custom adapters, exotic runtimes).
   *
   * For platforms whose `waitUntil` is a bare import (e.g. `@vercel/functions`), pass
   * it via {@link waitUntil} instead — no resolver needed.
   *
   * Resolution order: {@link waitUntil} (if set) → {@link resolveWaitUntil} (if set)
   * → core's default.
   */
  resolveWaitUntil?: WaitUntilResolver;
}

// =============================================================================
// Channel Info (discovery types for Editor/UI)
// =============================================================================

/**
 * Discovery metadata for a channel platform.
 * Used by the editor UI to show available integrations and render config forms.
 */
export interface ChannelPlatformInfo {
  /** Platform identifier (e.g., 'slack', 'discord'). */
  id: string;
  /** Human-readable display name (e.g., 'Slack'). */
  name: string;
  /** Whether the platform is fully configured and ready to connect agents. */
  isConfigured: boolean;
  /** JSON Schema describing the options accepted by `connect()`. Used by UI to render config forms. */
  connectOptionsSchema?: Record<string, unknown>;
}

/**
 * Public installation info returned by the editor/UI.
 * Sensitive fields (tokens, secrets) are excluded.
 */
export interface ChannelInstallationInfo {
  /** Unique installation ID. */
  id: string;
  /** Platform identifier (e.g., 'slack'). */
  platform: string;
  /** The agent this installation is connected to. */
  agentId: string;
  /** Installation status. */
  status: 'active' | 'pending';
  /** Platform-specific display info (e.g., Slack workspace name). */
  displayName?: string;
  /** When the installation was created. */
  installedAt?: Date;
}

// =============================================================================
// Connect Result (discriminated union for different platform flows)
// =============================================================================

/**
 * OAuth-based connection — user must be redirected to an authorization URL.
 * Used by platforms like Slack where the connection requires browser-based consent.
 */
export interface ChannelConnectOAuth {
  type: 'oauth';
  /** URL to redirect the user to for OAuth authorization. */
  authorizationUrl: string;
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Deep-link-based connection — user opens a link in a native app to confirm.
 * Used by platforms like Telegram where a deep link triggers in-app bot creation.
 * Completion arrives asynchronously via webhook, not a browser redirect.
 */
export interface ChannelConnectDeepLink {
  type: 'deep_link';
  /** Deep link URL for the user to open (e.g., in Telegram). */
  url: string;
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Immediate connection — no user interaction needed.
 * Used by platforms where API keys or tokens are sufficient and the bot is ready instantly.
 */
export interface ChannelConnectImmediate {
  type: 'immediate';
  /** Unique installation ID. */
  installationId: string;
}

/**
 * Result of connecting an agent to a channel platform.
 * Discriminated on the `type` field to support different platform authorization flows.
 */
export type ChannelConnectResult = ChannelConnectOAuth | ChannelConnectDeepLink | ChannelConnectImmediate;

// =============================================================================
// ChannelProvider interface
// =============================================================================

/**
 * Interface for channel provider implementations (e.g., SlackProvider, DiscordProvider).
 *
 * A channel provider manages the full lifecycle of a platform integration:
 * - App provisioning and OAuth flows
 * - Webhook routing and event handling
 * - Adapter creation and agent wiring
 * - Manifest synchronization and credential management
 *
 * @example
 * ```ts
 * const mastra = new Mastra({
 *   channels: {
 *     slack: new SlackProvider({ ... }),
 *   },
 * });
 * ```
 */
export interface ChannelProvider {
  /** Unique identifier for this channel type (e.g., 'slack', 'discord'). */
  readonly id: string;

  /**
   * Returns API routes for this channel (OAuth, webhooks, events).
   * These are automatically merged into the server's apiRoutes.
   */
  getRoutes(): ApiRoute[];

  /**
   * Called when the channel is registered with Mastra.
   * Use this to store a reference to Mastra and perform setup.
   * @internal
   */
  __attach?(mastra: Mastra): void;

  /**
   * Called during Mastra initialization after all agents are registered.
   * Use this to perform async setup like restoring active installations.
   */
  initialize?(): Promise<void>;

  /**
   * Provide or clear platform credentials at runtime.
   * Pass `null` to clear credentials and delete stored tokens.
   */
  configure?(credentials: Record<string, unknown> | null): void | Promise<void>;

  // ---------------------------------------------------------------------------
  // Discovery & Management (used by Editor/UI)
  // ---------------------------------------------------------------------------

  /**
   * Returns discovery metadata for the editor UI.
   * Includes platform name, configuration status, and connect options schema.
   */
  getInfo?(): ChannelPlatformInfo;

  /**
   * Connect an agent to this channel platform.
   * Returns a discriminated result indicating the authorization flow required.
   */
  connect?(agentId: string, options?: Record<string, unknown>): Promise<ChannelConnectResult>;

  /**
   * Disconnect an agent from this channel platform.
   * Deletes the platform app and cleans up storage.
   */
  disconnect?(agentId: string): Promise<void>;

  /**
   * List active installations for this platform.
   * Returns public info only (no secrets).
   */
  listInstallations?(): Promise<ChannelInstallationInfo[]>;
}

/**
 * A message from the platform's thread history.
 * Used to provide context when the agent is mentioned mid-conversation.
 */
export type ThreadHistoryMessage = {
  /** Platform message ID. */
  id: string;
  /** Display name of the author. */
  author: string;
  /** Platform user ID of the author. */
  userId?: string;
  /** The message text. */
  text: string;
  /** Whether the author is a bot. */
  isBot?: boolean;
};

/**
 * Channel context placed on `requestContext` under the 'channel' key.
 * Available to input processors via `requestContext.get('channel')`.
 *
 * Stable fields (platform, isDM, threadId, channelId, userId, userName)
 * are suitable for system messages. Per-request fields (messageId, eventType)
 * should be injected closer to the user message.
 */
export type ChannelContext = {
  /** Platform identifier — matches the adapter's name (e.g. 'slack', 'discord'). */
  platform: string;
  /** Event type that triggered this generation. */
  eventType: string;
  /** Whether this is a direct message conversation. */
  isDM?: boolean;
  /** The platform thread ID (e.g. 'discord:guildId:channelId:threadId'). */
  threadId?: string;
  /** The platform channel ID. */
  channelId?: string;
  /** Platform message ID of the message that triggered this turn. */
  messageId?: string;
  /** Platform user ID of the sender. */
  userId: string;
  /** Display name of the sender, if available. */
  userName?: string;
  /** The bot's own user ID on this platform. */
  botUserId?: string;
  /** The bot's display name on this platform. */
  botUserName?: string;
  /** The bot's mention string (e.g. '<@U123>' on Slack/Discord). */
  botMention?: string;
};
