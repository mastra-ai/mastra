import type { Mastra } from '../mastra';
import type { ApiRoute } from '../server/types';

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

/**
 * Status update streamed during agent execution to provide real-time
 * observational memory state for UI feedback.
 *
 * Clients can calculate percentages from tokens/threshold pairs.
 *
 * @example
 * ```ts
 * // Message window usage
 * const msgPercent = status.windows.active.messages.tokens / status.windows.active.messages.threshold;
 *
 * // Post-activation estimate for message window
 * const postActivation = status.windows.active.messages.tokens - status.windows.buffered.observations.messageTokens;
 * ```
 */
export interface DataOmStatusPart {
  type: 'data-om-status';
  data: {
    windows: {
      /** Active context windows — current token usage and thresholds */
      active: {
        /** Message window: unobserved message tokens vs threshold that triggers observation */
        messages: {
          tokens: number;
          threshold: number;
        };
        /** Observation window: observation tokens vs threshold that triggers reflection */
        observations: {
          tokens: number;
          threshold: number;
        };
      };
      /** Buffered content waiting to be activated */
      buffered: {
        /** Buffered observation chunks staged for activation */
        observations: {
          /** Number of chunks staged */
          chunks: number;
          /** Message tokens that will be cleared from context on activation */
          messageTokens: number;
          /** Projected message tokens that would be removed if activation happened now (based on bufferActivation ratio and chunk boundaries) */
          projectedMessageRemoval: number;
          /** Observation tokens that will be added on activation */
          observationTokens: number;
          /** Current state of observation buffering */
          status: 'idle' | 'running' | 'complete';
        };
        /** Buffered reflection waiting to be activated */
        reflection: {
          /** Observation tokens that were fed into the reflector (pre-compression) */
          inputObservationTokens: number;
          /** Observation tokens the reflection will produce on activation (post-compression) */
          observationTokens: number;
          /** Current state of reflection buffering */
          status: 'idle' | 'running' | 'complete';
        };
      };
    };
    /** The OM record ID */
    recordId: string;
    /** Thread ID */
    threadId: string;
    /** Step number in the agent loop */
    stepNumber: number;
    /** Current reflection generation count */
    generationCount: number;
  };
}
export type OmOperationType = 'observation' | 'reflection';

/**
 * Start marker inserted when async buffering begins.
 * Buffering runs in the background to pre-compute observations before the main threshold.
 */
export interface DataOmBufferingStartPart {
  type: 'data-om-buffering-start';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation being buffered: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering started */
    startedAt: string;

    /** Tokens being buffered in this cycle */
    tokensToBuffer: number;

    /** The OM record ID this buffering belongs to */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** All thread IDs being buffered (for resource-scoped) */
    threadIds: string[];

    /** Snapshot of config at buffering time */
    config?: unknown;
  };
}

/**
 * End marker inserted when async buffering completes successfully.
 * The buffered content is stored but not yet activated (visible to the main context).
 */
export interface DataOmBufferingEndPart {
  type: 'data-om-buffering-end';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation that was buffered: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering completed */
    completedAt: string;

    /** Duration in milliseconds */
    durationMs: number;

    /** Total tokens that were buffered */
    tokensBuffered: number;

    /** Resulting observation/reflection tokens after compression */
    bufferedTokens: number;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** The buffered observations/reflection content (for UI expansion) */
    observations?: string;
  };
}

/**
 * Failed marker inserted when async buffering fails.
 * The system will fall back to synchronous processing at threshold.
 */
export interface DataOmBufferingFailedPart {
  type: 'data-om-buffering-failed';
  data: {
    /** Unique ID for this buffering cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation that failed: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When buffering failed */
    failedAt: string;

    /** Duration until failure in milliseconds */
    durationMs: number;

    /** Tokens that were attempted to buffer */
    tokensAttempted: number;

    /** Error message */
    error: string;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** The buffered observations/reflection content (for UI expansion) */
    observations?: string;
  };
}

/**
 * Union of all buffering marker types.
 */
export type DataOmBufferingPart = DataOmBufferingStartPart | DataOmBufferingEndPart | DataOmBufferingFailedPart;

/**
 * Marker inserted when buffered observations are activated (moved to active context).
 * This is an instant operation that happens when the main threshold is reached.
 */
export interface DataOmActivationPart {
  type: 'data-om-activation';
  data: {
    /** Unique ID for this activation event */
    cycleId: string;

    /** Type of operation: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When activation occurred */
    activatedAt: string;

    /** Number of buffered chunks that were activated */
    chunksActivated: number;

    /** Total tokens from messages that were activated */
    tokensActivated: number;

    /** Resulting observation tokens after activation */
    observationTokens: number;

    /** Number of messages that were observed via activation */
    messagesActivated: number;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** Current reflection generation count */
    generationCount: number;

    /** Snapshot of config at activation time */
    config?: unknown;

    /** The actual observations from activated chunks (for UI display) */
    observations?: string;

    /** Whether activation was triggered by threshold crossing, activateAfterIdle expiry, or a model/provider change */
    triggeredBy?: 'threshold' | 'ttl' | 'provider_change';

    /** Unix-ms timestamp of the last assistant message part used for TTL checks */
    lastActivityAt?: number;

    /** How long activateAfterIdle had been exceeded when activation fired */
    ttlExpiredMs?: number;

    /** Previous assistant model identifier that triggered activation, e.g. openai/gpt-4o */
    previousModel?: string;

    /** Current actor model identifier that triggered activation, e.g. anthropic/claude-3-7-sonnet */
    currentModel?: string;
  };
}

/**
 * Union of all OM data parts (observation, buffering, status, activation).
 */
export type DataOmPart = DataOmBufferingPart | DataOmActivationPart;

/**
 * @deprecated Use DataOmObservationStartPart and DataOmObservationEndPart instead.
 * Kept for backwards compatibility during migration.
 */
export interface DataOmObservedPart {
  type: 'data-om-observed';
  data: {
    /** When this observation occurred */
    observedAt: string;

    /** Total tokens observed across all threads in this batch */
    tokensObserved: number;

    /** Resulting observation tokens after compression */
    observationTokens: number;

    /** The OM record ID this observation belongs to */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** All thread IDs that were observed in this batch (for resource-scoped) */
    threadIds: string[];

    /** Snapshot of config at observation time (for debugging) */
    config?: unknown;
  };
}
