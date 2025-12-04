import type { MastraDBMessage } from '@mastra/core/agent';
import type { MastraStorage } from '@mastra/core/storage';

// ============================================================================
// Constants
// ============================================================================

export const CHARS_PER_TOKEN = 4; // Approximate characters per token

export const DEFAULT_HISTORY_THRESHOLD = 10_000;
export const DEFAULT_OBSERVATION_THRESHOLD = 30_000;

// ============================================================================
// Configuration Types
// ============================================================================

export interface ThresholdRange {
  min: number;
  max: number;
}

export interface AgentConfig {
  /** Model ID to use for the agent (e.g., 'google/gemini-2.5-flash') */
  model?: string;
  /** Model settings like temperature */
  modelSettings?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}

export interface ObserverConfig extends AgentConfig {
  /**
   * Token threshold for triggering observation.
   * When unobserved history reaches this threshold, the observer runs.
   * Can be a number or a range { min, max } for dynamic thresholds.
   * @default 10_000
   */
  historyThreshold?: number | ThresholdRange;

  /**
   * Enables async buffering to prevent conversation blocking.
   * When set, creates buffered observations every N tokens.
   * Must be lower than historyThreshold.
   */
  bufferEvery?: number;
}

export interface ReflectorConfig extends AgentConfig {
  /**
   * Token threshold for triggering reflection.
   * When accumulated observations reach this threshold, the reflector runs.
   * @default 30_000
   */
  observationThreshold?: number | ThresholdRange;

  /**
   * Enables async buffering for reflections.
   * Must be lower than observationThreshold.
   */
  bufferEvery?: number;
}

export interface ObservationalMemoryConfig {
  /** Storage instance for persisting observations */
  storage: MastraStorage;

  /** Observer agent configuration */
  observer?: ObserverConfig;

  /** Reflector agent configuration (optional - enables reflection when observations grow too large) */
  reflector?: ReflectorConfig;

  /**
   * Scope of observational memory
   * - 'thread': Memory is scoped to the current thread only
   * - 'resource': Memory is shared across all threads for the resource
   * @default 'thread'
   */
  scope?: 'thread' | 'resource';

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Stored observation record in the database.
 * This matches the spec in observational-memory-spec/storage-schema.md
 */
export interface ObservationalMemoryRecord {
  // Identity
  /** Unique record ID */
  id: string;
  /** Memory scope - 'thread' for single thread, 'resource' for cross-thread */
  scope: 'thread' | 'resource';
  /** Thread ID (null for resource scope) */
  threadId: string | null;
  /** Resource ID (always present) */
  resourceId: string;

  // Generation tracking
  /** How this record was created */
  originType: 'initial' | 'reflection';
  /** Links to previous generation (for reflection history traversal) */
  previousGenerationId?: string;

  // Observation content
  /** Currently active observations (markdown) */
  activeObservations: string;
  /** Observations waiting to be activated (async buffering) */
  bufferedObservations?: string;
  /** Reflection waiting to be swapped in */
  bufferedReflection?: string;

  // Message tracking
  /** Messages included in active observations */
  observedMessageIds: string[];
  /** Messages included in buffered observations */
  bufferedMessageIds: string[];
  /** Messages currently being observed (async) */
  bufferingMessageIds: string[];

  // Token tracking
  /** Running total of all tokens observed across all generations */
  totalTokensObserved: number;
  /** Current size of active observations in tokens */
  observationTokenCount: number;

  // State flags
  /** Is a reflection currently in progress? */
  isReflecting: boolean;

  // Metadata
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    /** Number of reflections performed */
    reflectionCount: number;
    /** When the last reflection occurred */
    lastReflectionAt?: Date;
  };
}

/**
 * Storage operations interface for observational memory.
 * This defines the contract that storage adapters must implement.
 */
export interface ObservationalMemoryStorage {
  // Retrieval
  getObservationalMemory(
    threadId: string,
    resourceId?: string
  ): Promise<ObservationalMemoryRecord | null>;

  getObservationalMemoryHistory(
    threadId: string,
    resourceId?: string,
    limit?: number
  ): Promise<ObservationalMemoryRecord[]>;

  // Initialization
  initializeObservationalMemory(
    threadId: string,
    config: ObservationalMemoryConfig,
    resourceId?: string
  ): Promise<ObservationalMemoryRecord>;

  // Updates
  updateActiveObservations(
    id: string,
    observations: string,
    messageIds: string[],
    tokenCount: number
  ): Promise<void>;

  updateBufferedObservations(
    id: string,
    observations: string,
    messageIds: string[]
  ): Promise<void>;

  swapBufferedToActive(id: string): Promise<void>;

  // Message state tracking
  markMessagesAsBuffering(id: string, messageIds: string[]): Promise<void>;

  markMessagesAsBuffered(id: string, messageIds: string[]): Promise<void>;

  // Reflection operations
  createReflectionGeneration(
    currentRecord: ObservationalMemoryRecord,
    reflection: string,
    tokenCount: number
  ): Promise<ObservationalMemoryRecord>;

  updateBufferedReflection(id: string, reflection: string): Promise<void>;

  swapReflectionToActive(id: string): Promise<void>;

  // Cleanup
  clearObservationalMemory(threadId: string, resourceId?: string): Promise<void>;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface ConversationExchange {
  relevantMessages: MastraDBMessage[];
  timestamp: Date;
}
