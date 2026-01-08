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


