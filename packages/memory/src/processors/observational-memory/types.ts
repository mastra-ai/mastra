import type { AgentConfig } from '@mastra/core/agent';
import type { ObservationalMemoryModelSettings } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import type { ModelByInputTokens } from './model-by-input-tokens';

/**
 * Threshold can be a simple number or a dynamic range.
 *
 * Simple form:
 * ```ts
 * messageTokens: 10_000
 * ```
 *
 * Range form (dynamic threshold based on observation space):
 * ```ts
 * messageTokens: { min: 8_000, max: 15_000 }
 * ```
 */
export type ThresholdRange = {
  /** Minimum threshold (used when observations are full) */
  min: number;
  /** Maximum threshold (used when observations have room) */
  max: number;
};

/**
 * Model settings for Observer/Reflector agents.
 * Re-exported from @mastra/core/memory for convenience.
 */
export type ModelSettings = ObservationalMemoryModelSettings;

/**
 * Google-specific provider options
 */
export interface GoogleProviderOptions {
  thinkingConfig?: {
    thinkingBudget?: number;
    includeThoughts?: boolean;
  };
  [key: string]: any;
}

/**
 * Provider-specific options for model configuration.
 * Compatible with core's ProviderOptions type.
 */
export interface ProviderOptions {
  google?: GoogleProviderOptions;
  [key: string]: Record<string, any> | undefined;
}

/**
 * Configuration for the observation step (Observer agent).
 */
export type ObservationalMemoryModel = Exclude<AgentConfig['model'], undefined> | ModelByInputTokens;

export interface ObservationConfig {
  /**
   * Model for the Observer agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * a `ModelByInputTokens` selector (for token-tiered routing),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided on ObservationalMemoryConfig.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: ObservationalMemoryModel;

  /**
   * Token count of unobserved messages that triggers observation.
   * When unobserved message tokens exceed this, the Observer is called.
   *
   * @default 30000
   */
  messageTokens?: number;

  /**
   * Model settings for the Observer agent.
   * @default { temperature: 0.3 }
   *
   * Note: `maxOutputTokens: 100_000` is only applied by default when using
   * the built-in default model selection.
   */
  modelSettings?: ModelSettings;

  /**
   * Provider-specific options.
   * @default { google: { thinkingConfig: { thinkingBudget: 215 } } }
   */
  providerOptions?: ProviderOptions;

  /**
   * Maximum tokens per batch when observing multiple threads.
   * Threads are chunked into batches of this size and processed in parallel.
   * Lower values = more parallelism but more API calls.
   * Higher values = fewer API calls but less parallelism.
   *
   * @default 10000
   */
  maxTokensPerBatch?: number;

  /**
   * Token interval for async background observation buffering.
   * Can be an absolute token count (e.g. `5000`) or a fraction of `messageTokens`
   * (e.g. `0.25` = buffer every 25% of threshold).
   *
   * Observations run asynchronously in the background at this interval,
   * storing results in a buffer. When the main `messageTokens` threshold is reached,
   * buffered observations are activated instantly (no blocking LLM call).
   *
   * Set to `false` to explicitly disable async buffering.
   *
   * Must resolve to less than `messageTokens`.
   *
   * @default 0.2 (buffer every 20% of messageTokens)
   */
  bufferTokens?: number | false;

  /**
   * Controls how many raw message tokens to retain after activation.
   *
   * - **Ratio (0 < value <= 1):** fraction of `messageTokens` to activate.
   *   The retention floor is `messageTokens * (1 - ratio)`.
   *   e.g. `0.8` with `messageTokens: 30000` → retain ~6000 tokens.
   *
   * - **Absolute (value >= 1000):** exact number of message tokens to retain.
   *   e.g. `3000` → always aim to keep ~3000 tokens of raw message history.
   *   Must be less than `messageTokens`.
   *
   * Values between 1 and 1000 are invalid.
   *
   * Requires `bufferTokens` to also be set.
   *
   * @default 0.8 (retain ~20% of messageTokens as raw messages)
   */
  bufferActivation?: number;

  /**
   * Token threshold above which synchronous (blocking) observation is forced.
   * Between `messageTokens` and `blockAfter`, only async buffering/activation is used.
   * Above `blockAfter`, a synchronous observation runs as a last resort.
   *
   * Accepts either:
   * - A multiplier (1 < value < 2): multiplied by `messageTokens`.
   *   e.g. `blockAfter: 1.5` with `messageTokens: 20_000` → blocks at 30,000.
   * - An absolute token count (≥ 2): must be greater than `messageTokens`.
   *
   * Only relevant when `bufferTokens` is set.
   * If not set, synchronous observation is never used when async buffering is enabled.
   */
  blockAfter?: number;

  /**
   * Optional token budget for observer context.
   * When set, "Previous Observations" is tail-truncated to preserve the most recent entries,
   * and pending buffered reflections replace the raw observations they summarized.
   * Set to `0` for full truncation (omit previous observations entirely), or `false` to disable.
   */
  previousObserverTokens?: number | false;

  /**
   * Custom instructions to append to the Observer's system prompt.
   * Use this to customize observation behavior for specific use cases.
   */
  instruction?: string;

  /**
   * Whether the Observer should suggest thread titles.
   * When enabled, the Observer will analyze conversation context and
   * suggest a short, descriptive title for the thread.
   *
   * @default false
   */
  threadTitle?: boolean;
}

/**
 * Configuration for the reflection step (Reflector agent).
 */
export interface ReflectionConfig {
  /**
   * Model for the Reflector agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * a `ModelByInputTokens` selector (for token-tiered routing),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided on ObservationalMemoryConfig.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: ObservationalMemoryModel;

  /**
   * Token count of observations that triggers reflection.
   * When observation tokens exceed this, the Reflector is called to condense them.
   *
   * @default 40000
   */
  observationTokens?: number;

  /**
   * Model settings for the Reflector agent.
   * @default { temperature: 0 }
   *
   * Note: `maxOutputTokens: 100_000` is only applied by default when using
   * the built-in default model selection.
   */
  modelSettings?: ModelSettings;

  /**
   * Provider-specific options.
   * @default { google: { thinkingConfig: { thinkingBudget: 1024 } } }
   */
  providerOptions?: ProviderOptions;

  /**
   * Token threshold above which synchronous (blocking) reflection is forced.
   * Between `observationTokens` and `blockAfter`, only async buffering/activation is used.
   * Above `blockAfter`, a synchronous reflection runs as a last resort.
   *
   * Accepts either:
   * - A multiplier (1 < value < 2): multiplied by `observationTokens`.
   *   e.g. `blockAfter: 1.5` with `observationTokens: 30_000` → blocks at 45,000.
   * - An absolute token count (≥ 2): must be greater than `observationTokens`.
   *
   * Only relevant when `bufferActivation` is set.
   * If not set, synchronous reflection is never used when async reflection is enabled.
   */
  blockAfter?: number;

  /**
   * Ratio (0-1) controlling when async reflection buffering starts.
   * When observation tokens reach `observationTokens * bufferActivation`,
   * reflection runs in the background. On activation at the full threshold,
   * the buffered reflection replaces the line range it covers, preserving
   * any new observations appended after that range.
   *
   * Requires `observation.bufferTokens` to also be set.
   */
  bufferActivation?: number;

  /**
   * Custom instructions to append to the Reflector's system prompt.
   * Use this to customize reflection behavior for specific use cases.
   */
  instruction?: string;
}

/**
 * Result from Observer agent
 */
export interface ObserverResult {
  /** The extracted observations */
  observations: string;

  /** Suggested continuation for the Actor */
  suggestedContinuation?: string;
}

/**
 * Result from Reflector agent
 */
export interface ReflectorResult {
  /** The condensed observations */
  observations: string;

  /** Suggested continuation for the Actor */
  suggestedContinuation?: string;

  /** True if the output was detected as degenerate (repetition loop) and should be discarded/retried */
  degenerate?: boolean;
}

/**
 * Config snapshot included in observation markers for debugging.
 */
export interface ObservationMarkerConfig {
  messageTokens: number;
  observationTokens: number;
  scope: 'thread' | 'resource';
  activateAfterIdle?: number;
}

export interface ObservationModelContext {
  provider?: string;
  modelId?: string;
}

/**
 * Start marker inserted when observation begins.
 * Everything BEFORE this marker will be observed.
 *
 * If this marker exists without a corresponding `end` or `failed` marker,
 * observation is in progress.
 */
/** Type of OM operation - observation or reflection */
export type OmOperationType = 'observation' | 'reflection';

export interface DataOmObservationStartPart {
  type: 'data-om-observation-start';
  data: {
    /** Unique ID for this observation cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When observation started */
    startedAt: string;

    /** Tokens being observed in this batch */
    tokensToObserve: number;

    /** The OM record ID this observation belongs to */
    recordId: string;

    /** This thread's ID */
    threadId: string;

    /** All thread IDs being observed in this batch (for resource-scoped) */
    threadIds: string[];

    /** Snapshot of config at observation time */
    config: ObservationMarkerConfig;
  };
}

/**
 * End marker inserted when observation completes successfully.
 * Parts BEFORE the corresponding `start` marker have been observed.
 */
export interface DataOmObservationEndPart {
  type: 'data-om-observation-end';
  data: {
    /** Unique ID for this observation cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When observation completed */
    completedAt: string;

    /** Duration in milliseconds */
    durationMs: number;

    /** Total tokens that were observed */
    tokensObserved: number;

    /** Resulting observation tokens after compression */
    observationTokens: number;

    /** The actual observations generated in this cycle */
    observations?: string;

    /** Current task extracted by the Observer */
    currentTask?: string;

    /** Suggested response extracted by the Observer */
    suggestedResponse?: string;

    /** The OM record ID */
    recordId: string;

    /** This thread's ID */
    threadId: string;
  };
}

/**
 * Failed marker inserted when observation fails.
 * Allows for retry logic and debugging.
 */
export interface DataOmObservationFailedPart {
  type: 'data-om-observation-failed';
  data: {
    /** Unique ID for this observation cycle - shared between start/end/failed markers */
    cycleId: string;

    /** Type of operation: 'observation' or 'reflection' */
    operationType: OmOperationType;

    /** When observation failed */
    failedAt: string;

    /** Duration until failure in milliseconds */
    durationMs: number;

    /** Tokens that were attempted to observe */
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
    config: ObservationMarkerConfig;
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
    config: ObservationMarkerConfig;

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
 * Marker emitted when thread title is updated by the observer.
 */
export interface DataOmThreadUpdatePart {
  type: 'data-om-thread-update';
  data: {
    /** Unique ID for this observation cycle - shared with observation markers */
    cycleId: string;

    /** The thread ID that was updated */
    threadId: string;

    /** The previous thread title (undefined if thread had no title) */
    oldTitle?: string;

    /** The new thread title */
    newTitle: string;

    /** When this update occurred */
    timestamp: string;
  };
}

/**
 * Union of all observation marker types.
 */
export type DataOmObservationPart =
  | DataOmObservationStartPart
  | DataOmObservationEndPart
  | DataOmObservationFailedPart
  | DataOmStatusPart
  | DataOmThreadUpdatePart;

/**
 * Union of all OM data parts (observation, buffering, status, activation).
 */
export type DataOmPart = DataOmObservationPart | DataOmBufferingPart | DataOmActivationPart;

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
    config?: ObservationMarkerConfig;
  };
}

// ─── Types moved from observational-memory.ts ──────────────────────────────

/**
 * Debug event emitted when observation-related events occur.
 * Useful for understanding what the Observer is doing.
 */
export interface ObservationDebugEvent {
  type:
    | 'observation_triggered'
    | 'observation_complete'
    | 'reflection_triggered'
    | 'reflection_complete'
    | 'tokens_accumulated'
    | 'step_progress';
  timestamp: Date;
  threadId: string;
  resourceId: string;
  /** Messages that were sent to the Observer */
  messages?: Array<{ role: string; content: string }>;
  /** Token counts */
  pendingTokens?: number;
  sessionTokens?: number;
  totalPendingTokens?: number;
  threshold?: number;
  /** Input token count (for reflection events) */
  inputTokens?: number;
  /** Number of active observations (for reflection events) */
  activeObservationsLength?: number;
  /** Output token count after reflection */
  outputTokens?: number;
  /** The observations that were generated */
  observations?: string;
  /** Previous observations (before this event) */
  previousObservations?: string;
  /** Observer's raw output */
  rawObserverOutput?: string;
  /** LLM usage from Observer/Reflector calls */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  /** Step progress fields (for step_progress events) */
  stepNumber?: number;
  finishReason?: string;
  thresholdPercent?: number;
  willSave?: boolean;
  willObserve?: boolean;
}

/**
 * Configuration for ObservationalMemory
 */
export interface ObservationalMemoryConfig {
  /**
   * Storage adapter for persisting observations.
   * Must be a MemoryStorage instance (from MastraStorage.stores.memory).
   */
  storage: MemoryStorage;

  /**
   * **Experimental.** Enable retrieval-mode observation group metadata.
   * When true, observation groups are treated as durable pointers to raw
   * message history and a `recall` tool is registered so the actor can
   * inspect raw messages behind a stored observation summary.
   *
   * Use `{ vector: true }` to also index emitted observation groups into the
   * configured vector store for semantic recall, and `scope` to limit recall
   * browsing to the current thread instead of the whole resource.
   *
   * @experimental
   * @default false
   */
  retrieval?: boolean | { vector?: boolean; scope?: 'thread' | 'resource' };

  /**
   * Optional callback used to index emitted observation groups for semantic retrieval.
   */
  onIndexObservations?: (observation: {
    text: string;
    groupId: string;
    range: string;
    threadId: string;
    resourceId: string;
    observedAt?: Date;
  }) => Promise<void>;

  /**
   * Model for both Observer and Reflector agents.
   * Sets the model for both agents at once. Cannot be used together with
   * `observation.model` or `reflection.model` — an error will be thrown.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: ObservationalMemoryModel;

  /**
   * Observation step configuration.
   */
  observation?: ObservationConfig;

  /**
   * Reflection step configuration.
   */
  reflection?: ReflectionConfig;

  /**
   * Memory scope for observations.
   * - 'resource': Observations span all threads for a resource (cross-thread memory)
   * - 'thread': Observations are per-thread (default)
   */
  scope?: 'resource' | 'thread';

  /**
   * Debug callback for observation events.
   * Called whenever observation-related events occur.
   * Useful for debugging and understanding the observation flow.
   */
  onDebugEvent?: (event: ObservationDebugEvent) => void;

  obscureThreadIds?: boolean;

  /**
   * Share the token budget between messages and observations.
   * When true, the total budget = observation.messageTokens + reflection.observationTokens.
   * - Messages can use more space when observations are small
   * - Observations can use more space when messages are small
   *
   * This helps maximize context usage by allowing flexible allocation.
   *
   * @default false
   */
  shareTokenBudget?: boolean;

  /**
   * When true, inserts temporal-gap reminder markers before new user messages after
   * significant inactivity.
   *
   * @default false
   */
  temporalMarkers?: boolean;

  /**
   * Time before buffered observations or buffered reflections are force-activated after inactivity.
   * Accepts milliseconds as a number or a duration string like `"5m"` or `"1hr"`.
   * When the gap between the current time and the last assistant message part's `createdAt`
   * exceeds this value, buffered observational memory activates regardless of whether the
   * token threshold has been reached.
   */
  activateAfterIdle?: number | string;

  /**
   * Force-activate buffered observations and reflections when the actor provider/model changes.
   * This helps flush prompt-cache-specific memory before switching to a different model.
   */
  activateOnProviderChange?: boolean;
}

/**
 * Internal resolved config with all defaults applied.
 * Thresholds are stored as ThresholdRange internally for dynamic calculation,
 * even when user provides a simple number (converted based on shareTokenBudget).
 */
export interface ResolvedObservationConfig {
  model: ObservationalMemoryModel;
  /** Internal threshold - always stored as ThresholdRange for dynamic calculation */
  messageTokens: number | ThresholdRange;
  /** Whether shared token budget is enabled */
  shareTokenBudget: boolean;
  /** Model settings - merged with user config and defaults */
  modelSettings: ModelSettings;
  providerOptions: ProviderOptions;
  maxTokensPerBatch: number;
  /** Token interval for async background observation buffering (resolved from config) */
  bufferTokens?: number;
  /** Ratio of buffered observations to activate (0-1 float) */
  bufferActivation?: number;
  /** Time in milliseconds before buffered observations are force-activated based on the last assistant message part timestamp */
  activateAfterIdle?: number;
  /** Force-activate buffered observations when the actor model/provider changes */
  activateOnProviderChange?: boolean;
  /** Token threshold above which synchronous observation is forced */
  blockAfter?: number;
  /** Optional token budget for observer context optimization (0 = full truncation, false = disabled) */
  previousObserverTokens?: number | false;
  /** Custom instructions to append to the Observer's system prompt */
  instruction?: string;
  /** Whether the Observer should suggest thread titles */
  threadTitle?: boolean;
}

export interface ResolvedReflectionConfig {
  model: ObservationalMemoryModel;
  /** Internal threshold - always stored as ThresholdRange for dynamic calculation */
  observationTokens: number | ThresholdRange;
  /** Whether shared token budget is enabled */
  shareTokenBudget: boolean;
  /** Model settings - merged with user config and defaults */
  modelSettings: ModelSettings;
  providerOptions: ProviderOptions;
  /** Ratio (0-1) controlling when async reflection buffering starts */
  bufferActivation?: number;
  /** Time in milliseconds before buffered reflections are force-activated based on the last assistant message part timestamp */
  activateAfterIdle?: number;
  /** Force-activate buffered reflections when the actor model/provider changes */
  activateOnProviderChange?: boolean;
  /** Token threshold above which synchronous reflection is forced */
  blockAfter?: number;
  /** Custom instructions to append to the Reflector's system prompt */
  instruction?: string;
}

export interface ObserveHookUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ObserveHooks {
  onObservationStart?: () => void;
  onObservationEnd?: (result: { usage?: ObserveHookUsage; error?: Error }) => void;
  onReflectionStart?: () => void;
  onReflectionEnd?: (result: { usage?: ObserveHookUsage; error?: Error }) => void;
}
