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
 * Predefined observation focus areas.
 * These control what types of information the observer prioritizes.
 */
export type ObservationFocusType =
  /** Personal/biographical facts: education, work history, family, location, age, etc. */
  | 'personal-facts'
  /** User preferences and communication style */
  | 'preferences'
  /** Current projects, tasks, and goals */
  | 'tasks'
  /** Technical context and code-related information */
  | 'technical'
  /** Temporal information: dates, deadlines, schedules */
  | 'temporal'
  /** Relationships and people mentioned */
  | 'relationships'
  /** Health and wellness information */
  | 'health'
  /** Financial information */
  | 'financial'
  /** Location and travel information */
  | 'location'
  /** Custom focus area with description */
  | { custom: string };

/**
 * Configuration for observation focus areas.
 * Controls what types of information the observer prioritizes extracting.
 */
export interface ObservationFocus {
  /**
   * Focus areas to prioritize.
   * Can be predefined types or custom descriptions.
   *
   * @example
   * // Use predefined focus areas
   * focus: ['personal-facts', 'preferences', 'tasks']
   *
   * @example
   * // Add custom focus area
   * focus: ['personal-facts', { custom: 'Product preferences and purchase history' }]
   */
  include: ObservationFocusType[];

  /**
   * Optional: Areas to explicitly deprioritize or skip.
   * Useful for privacy or to reduce noise.
   */
  exclude?: ObservationFocusType[];
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
   * Focus areas for observation extraction.
   * Controls what types of information the observer prioritizes.
   *
   * @default { include: ['preferences', 'tasks', 'technical'] }
   *
   * @example
   * // For a personal assistant that needs to remember user facts
   * focus: {
   *   include: ['personal-facts', 'preferences', 'relationships', 'health']
   * }
   *
   * @example
   * // For a coding assistant
   * focus: {
   *   include: ['technical', 'tasks', 'preferences']
   * }
   *
   * @example
   * // For a benchmark like LongMemEval
   * focus: {
   *   include: ['personal-facts', 'preferences', 'temporal', 'relationships', 'tasks']
   * }
   */
  focus?: ObservationFocus;
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
 * Configuration for memory collapsing (graceful decay).
 * Older observation sections are collapsed into summaries
 * while recent sections remain fully expanded.
 */
export interface CollapseConfig {
  /**
   * Whether to enable automatic collapsing.
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum number of children in a section before it can be collapsed.
   * @default 5
   */
  minChildrenToCollapse?: number;

  /**
   * Number of most recent top-level sections to keep fully expanded.
   * @default 2
   */
  keepRecentSections?: number;

  /**
   * Number of child items to keep visible after collapse (shown at end).
   * @default 5
   */
  keepLastChildren?: number;

  /**
   * Regex patterns for sections that should never be collapsed.
   * For example, you might want to keep "Current Task" sections always visible.
   * @default [/Current Task/i]
   */
  excludePatterns?: RegExp[];
}
