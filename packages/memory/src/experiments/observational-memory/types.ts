import type { MastraModelConfig } from '@mastra/core/llm';

/**
 * Threshold can be a simple number or a dynamic range.
 *
 * Simple form:
 * ```ts
 * observationThreshold: 10_000
 * ```
 *
 * Range form (dynamic threshold based on observation space):
 * ```ts
 * observationThreshold: { min: 8_000, max: 15_000 }
 * ```
 */
export type ThresholdRange = {
  /** Minimum threshold (used when observations are full) */
  min: number;
  /** Maximum threshold (used when observations have room) */
  max: number;
};

/**
 * Model settings for Observer/Reflector agents
 */
export interface ModelSettings {
  /**
   * Temperature for generation.
   * Lower values produce more consistent output.
   * @default 0.3
   */
  temperature?: number;

  /**
   * Maximum output tokens.
   * High value to prevent truncation of observations.
   * @default 100000
   */
  maxOutputTokens?: number;
}

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
 * Configuration for the Observer agent
 */
export interface ObserverConfig {
  /**
   * Model for the Observer agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o') or a LanguageModel instance.
   * @default 'google/gemini-2.5-flash'
   */
  model?: MastraModelConfig;

  /**
   * Token threshold for message history before triggering observation.
   * When unobserved messages exceed this, Observer is called.
   *
   * Simple form: `10_000` (blocks at threshold)
   * Range form: `{ min: 8_000, max: 15_000 }` (dynamic based on observation space)
   *
   * @default 10000
   */
  observationThreshold?: number | ThresholdRange;

  /**
   * Buffer observations in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than observationThreshold (or observationThreshold.max).
   *
   * When enabled, observations are created asynchronously at intervals
   * and only activated when the threshold is reached.
   */
  bufferEvery?: number;

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
   * Whether to extract and track patterns (recurring themes).
   * Patterns help with counting and recalling related items.
   *
   * @default false
   */
  recognizePatterns?: boolean;

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
   * Process batches sequentially instead of in parallel.
   * When true, each batch sees the observations from previous batches,
   * which may improve quality but increases latency.
   *
   * @default false
   */
  sequentialBatches?: boolean;
}

/**
 * Configuration for the Reflector agent
 */
export interface ReflectorConfig {
  /**
   * Model for the Reflector agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o') or a LanguageModel instance.
   * @default 'google/gemini-2.5-flash'
   */
  model?: MastraModelConfig;

  /**
   * Token threshold for observations before triggering reflection.
   * When observations exceed this, Reflector is called to condense them.
   *
   * Simple form: `30_000` (blocks at threshold)
   * Range form: `{ min: 25_000, max: 35_000 }` (dynamic)
   *
   * @default 30000
   */
  reflectionThreshold?: number | ThresholdRange;

  /**
   * Buffer reflections in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than reflectionThreshold (or reflectionThreshold.max).
   */
  bufferEvery?: number;

  /**
   * Model settings for the Reflector agent.
   * @default { temperature: 0.3, maxOutputTokens: 100_000 }
   */
  modelSettings?: ModelSettings;

  /**
   * Provider-specific options.
   * @default { google: { thinkingConfig: { thinkingBudget: 1024 } } }
   */
  providerOptions?: ProviderOptions;

  /**
   * Whether to extract and consolidate patterns during reflection.
   * Patterns help with counting and recalling related items.
   *
   * @default false
   */
  recognizePatterns?: boolean;
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
  observationThreshold: number;
  reflectionThreshold: number;
  scope: 'thread' | 'resource';
}

/**
 * Start marker inserted when observation begins.
 * Everything BEFORE this marker will be observed.
 * 
 * If this marker exists without a corresponding `end` or `failed` marker,
 * observation is in progress.
 */
export interface DataOmObservationStartPart {
  type: 'data-om-observation-start';
  data: {
    /** Unique ID for this observation cycle - shared between start/end/failed markers */
    cycleId: string;

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

    /** When observation completed */
    completedAt: string;

    /** Duration in milliseconds */
    durationMs: number;

    /** Total tokens that were observed */
    tokensObserved: number;

    /** Resulting observation tokens after compression */
    observationTokens: number;

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
 * Union of all observation marker types.
 */
export type DataOmObservationPart =
  | DataOmObservationStartPart
  | DataOmObservationEndPart
  | DataOmObservationFailedPart;

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

