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
