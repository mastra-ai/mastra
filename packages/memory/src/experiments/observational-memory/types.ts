/**
 * Configuration for the Observer agent
 */
export interface ObserverConfig {
  /**
   * Token threshold for message history before triggering observation.
   * When unobserved messages exceed this, Observer is called.
   * @default 10000
   */
  historyThreshold?: number;

  /**
   * Model ID for the Observer agent.
   * @default 'google:gemini-2.0-flash'
   */
  model?: string;

  /**
   * Buffer observations in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than historyThreshold.
   */
  bufferEvery?: number;
}

/**
 * Configuration for the Reflector agent
 */
export interface ReflectorConfig {
  /**
   * Token threshold for observations before triggering reflection.
   * When observations exceed this, Reflector is called.
   * @default 20000
   */
  observationThreshold?: number;

  /**
   * Model ID for the Reflector agent.
   * @default 'google:gemini-2.0-flash'
   */
  model?: string;

  /**
   * Buffer reflections in background every N tokens.
   * This prevents blocking when threshold is hit.
   * Must be less than observationThreshold.
   */
  bufferEvery?: number;
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
