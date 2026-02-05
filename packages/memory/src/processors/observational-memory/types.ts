import type { AgentConfig } from '@mastra/core/agent';
import type { ObservationalMemoryModelSettings } from '@mastra/core/memory';

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
export interface ObservationConfig {
  /**
   * Model for the Observer agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided on ObservationalMemoryConfig.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: AgentConfig['model'];

  /**
   * Token count of unobserved messages that triggers observation.
   * When unobserved message tokens exceed this, the Observer is called.
   *
   * @default 30000
   */
  messageTokens?: number;

  /**
   * Model settings for the Observer agent.
   * @default { temperature: 0.3, maxOutputTokens: 100_000 }
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
   * When set, observations run asynchronously in the background at this interval,
   * storing results in a buffer. When the main `messageTokens` threshold is reached,
   * buffered observations are activated instantly (no blocking LLM call).
   *
   * Must be less than `messageTokens`.
   * If not set, async buffering is disabled and observations run synchronously.
   */
  bufferEvery?: number;

  /**
   * Percentage of buffered observations to activate when threshold is reached (0-100).
   * Setting this below 100 keeps some observations in reserve for continuity.
   *
   * @default 100 (activate all buffered observations)
   */
  asyncActivation?: number;
}

/**
 * Configuration for the reflection step (Reflector agent).
 */
export interface ReflectionConfig {
  /**
   * Model for the Reflector agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided on ObservationalMemoryConfig.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: AgentConfig['model'];

  /**
   * Token count of observations that triggers reflection.
   * When observation tokens exceed this, the Reflector is called to condense them.
   *
   * @default 40000
   */
  observationTokens?: number;

  /**
   * Model settings for the Reflector agent.
   * @default { temperature: 0, maxOutputTokens: 100_000 }
   */
  modelSettings?: ModelSettings;

  /**
   * Provider-specific options.
   * @default { google: { thinkingConfig: { thinkingBudget: 1024 } } }
   */
  providerOptions?: ProviderOptions;

  /**
   * Token interval for async background reflection buffering.
   * When set, reflection runs asynchronously in the background at this interval,
   * storing the result in a buffer. When the main `observationTokens` threshold is reached,
   * the buffered reflection is activated instantly (no blocking LLM call).
   *
   * Must be less than `observationTokens`.
   * If not set, async buffering is disabled and reflection runs synchronously.
   */
  bufferEvery?: number;

  /**
   * Percentage of buffered reflection to activate when threshold is reached (0-100).
   * Setting this below 100 keeps some content in reserve for continuity.
   *
   * @default 100 (activate all buffered reflection)
   */
  asyncActivation?: number;
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
}

/**
 * Config snapshot included in observation markers for debugging.
 */
export interface ObservationMarkerConfig {
  messageTokens: number;
  observationTokens: number;
  scope: 'thread' | 'resource';
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
  };
}

/**
 * Progress marker streamed during agent execution to provide real-time
 * token progress updates for UI feedback.
 */
export interface DataOmProgressPart {
  type: 'data-om-progress';
  data: {
    /** Current pending tokens (unobserved message tokens) */
    pendingTokens: number;

    /** Current message token threshold that triggers observation */
    messageTokens: number;

    /** Percentage of message token threshold reached */
    messageTokensPercent: number;

    /** Current observation tokens (for reflection progress) */
    observationTokens: number;

    /** Observation token threshold that triggers reflection */
    observationTokensThreshold: number;

    /** Percentage of observation token threshold reached */
    observationTokensPercent: number;

    /** Whether observation will trigger */
    willObserve: boolean;

    /** The OM record ID */
    recordId: string;

    /** Thread ID */
    threadId: string;

    /** Step number in the agent loop */
    stepNumber: number;

    /** Number of buffered observation chunks waiting to be activated */
    bufferedChunksCount: number;

    /** Total tokens of messages that have been buffered but not yet activated */
    bufferedMessageTokens: number;

    /** Total tokens of observations from buffered chunks */
    bufferedObservationTokens: number;

    /** Whether there are buffered chunks ready for activation */
    hasBufferedChunks: boolean;
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

    /** Snapshot of config at activation time */
    config: ObservationMarkerConfig;
  };
}

/**
 * Union of all observation marker types.
 */
export type DataOmObservationPart =
  | DataOmObservationStartPart
  | DataOmObservationEndPart
  | DataOmObservationFailedPart
  | DataOmProgressPart;

/**
 * Union of all OM data parts (observation, buffering, progress, activation).
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
