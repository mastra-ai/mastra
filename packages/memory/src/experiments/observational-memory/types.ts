/**
 * Threshold can be a simple number or a dynamic range.
 *
 * Simple form:
 * ```ts
 * historyThreshold: 10_000
 * ```
 *
 * Range form (dynamic threshold based on observation space):
 * ```ts
 * historyThreshold: { min: 8_000, max: 15_000 }
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
    /**
     * Token budget for thinking/reasoning.
     * Observer uses 215 (small), Reflector uses 1024 (larger for pattern analysis).
     */
    thinkingBudget?: number;
    /** Whether to include thinking in output */
    includeThoughts?: boolean;
  };
}

/**
 * Provider-specific options for model configuration
 */
export interface ProviderOptions {
  google?: GoogleProviderOptions;
  // Add other providers as needed
}

/**
 * Configuration for the Observer agent
 */
export interface ObserverConfig {
  /**
   * Model ID for the Observer agent.
   * @default 'google/gemini-2.5-flash'
   */
  model?: string;

  /**
   * Token threshold for message history before triggering observation.
   * When unobserved messages exceed this, Observer is called.
   *
   * Simple form: `10_000` (blocks at threshold)
   * Range form: `{ min: 8_000, max: 15_000 }` (dynamic based on observation space)
   *
   * @default 10000
   */
  historyThreshold?: number | ThresholdRange;

  /**
   * Buffer observations in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than historyThreshold (or historyThreshold.max).
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
}

/**
 * Configuration for the Reflector agent
 */
export interface ReflectorConfig {
  /**
   * Model ID for the Reflector agent.
   * @default 'google/gemini-2.5-flash'
   */
  model?: string;

  /**
   * Token threshold for observations before triggering reflection.
   * When observations exceed this, Reflector is called to condense them.
   *
   * Simple form: `30_000` (blocks at threshold)
   * Range form: `{ min: 25_000, max: 35_000 }` (dynamic)
   *
   * @default 30000
   */
  observationThreshold?: number | ThresholdRange;

  /**
   * Buffer reflections in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than observationThreshold (or observationThreshold.max).
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
