/**
 * Configuration for the plugin
 */
export interface ObservationalMemoryPluginConfig {
  /**
   * Path to the SQLite database file
   * Can also use OM_DB_PATH env var
   * @default ~/.opencode/observational-memory.db
   */
  dbPath?: string;

  /**
   * Default model for Observer and Reflector agents
   * Can be overridden per-agent with observerModel/reflectorModel
   * Can also use OM_MODEL env var
   * @default 'google/gemini-2.0-flash'
   */
  model?: string;

  /**
   * Model specifically for the Observer agent
   * Can also use OM_OBSERVER_MODEL env var
   */
  observerModel?: string;

  /**
   * Model specifically for the Reflector agent
   * Can also use OM_REFLECTOR_MODEL env var
   */
  reflectorModel?: string;

  /**
   * Scope for observational memory
   * - "resource": Observations shared across all threads for a user (default)
   * - "thread": Observations specific to a single conversation
   * @default 'resource'
   */
  scope?: 'thread' | 'resource';

  /**
   * Token count of unobserved messages that triggers observation
   * @default 30000
   */
  messageTokenThreshold?: number;

  /**
   * Token count of observations that triggers reflection
   * @default 40000
   */
  observationTokenThreshold?: number;

  /**
   * Include observations in context injection
   * @default true
   */
  injectObservations?: boolean;

  /**
   * Prefix for container tags
   * @default "opencode"
   */
  containerTagPrefix?: string;

  /**
   * Keyword patterns that trigger memory save (regex)
   */
  keywordPatterns?: string[];

  /**
   * Context usage ratio that triggers compaction (0-1)
   * @default 0.80
   */
  compactionThreshold?: number;
}

/**
 * Observational Memory Record type
 */
export interface ObservationalMemoryRecord {
  id: string;
  scope: 'thread' | 'resource';
  resourceId: string;
  threadId: string | null;
  activeObservations: string;
  bufferedObservations?: string;
  bufferedReflection?: string;
  originType: 'initial' | 'observation' | 'reflection';
  generationCount: number;
  lastObservedAt?: Date;
  totalTokensObserved: number;
  observationTokenCount: number;
  pendingMessageTokens: number;
  isObserving: boolean;
  isReflecting: boolean;
  config: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Observational Memory Scope
 */
export type ObservationalMemoryScope = 'thread' | 'resource';
