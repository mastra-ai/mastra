import type { AssistantContent, CoreMessage, ToolContent, UserContent } from '@internal/ai-sdk-v4';

import type { AgentExecutionOptions } from '../agent/agent.types';
import type { AgentConfig } from '../agent/types';
export type { MastraDBMessage } from '../agent';
import type { EmbeddingModelId } from '../llm/model/index.js';
import type { ModelRouterModelId } from '../llm/model/provider-registry.js';
import type { MastraLanguageModel, MastraModelConfig } from '../llm/model/shared.types';
import type { RequestContext } from '../request-context';
import type { StandardSchemaWithJSON, PublicSchema } from '../schema';
import type { MastraCompositeStore } from '../storage';
import type { DynamicArgument } from '../types';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import type { MemoryProcessor } from '.';

export type { Message as AiMessageType } from '@internal/ai-sdk-v4';
export type { MastraLanguageModel };

// Types for the memory system
export type MastraMessageV1 = {
  id: string;
  content: string | UserContent | AssistantContent | ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

/**
 * @deprecated use MastraMessageV1 or MastraDBMessage
 */
export type MessageType = MastraMessageV1;

export type StorageThreadType = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

/**
 * Thread-specific Observational Memory metadata.
 * Stored on thread.metadata.mastra.om to keep thread-specific data
 * separate from the shared resource-level OM record.
 */
export type ThreadOMMetadata = {
  /** The current task being worked on in this thread */
  currentTask?: string;
  /** Suggested response for continuing this thread's conversation */
  suggestedResponse?: string;
  /** Timestamp of the last observed message in this thread (ISO string for JSON serialization) */
  lastObservedAt?: string;
  // Note: Patterns are stored on the ObservationalMemoryRecord (resource-level), not thread metadata
};

/**
 * Structure for Mastra-specific thread metadata.
 * Stored on thread.metadata.mastra
 */
export type ThreadMastraMetadata = {
  om?: ThreadOMMetadata;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Helper to get OM metadata from a thread's metadata object.
 * Returns undefined if not present or if the structure is invalid.
 */
export function getThreadOMMetadata(threadMetadata?: Record<string, unknown>): ThreadOMMetadata | undefined {
  if (!threadMetadata) return undefined;
  const mastra = threadMetadata.mastra;
  if (!isPlainObject(mastra)) return undefined;
  const om = mastra.om;
  if (!isPlainObject(om)) return undefined;
  return om as ThreadOMMetadata;
}

/**
 * Helper to set OM metadata on a thread's metadata object.
 * Creates the nested structure if it doesn't exist.
 * Returns a new metadata object (does not mutate the original).
 * Safely handles cases where existing mastra/om values are not objects.
 */
export function setThreadOMMetadata(
  threadMetadata: Record<string, unknown> | undefined,
  omMetadata: ThreadOMMetadata,
): Record<string, unknown> {
  const existing = threadMetadata ?? {};
  const existingMastra = isPlainObject(existing.mastra) ? existing.mastra : {};
  const existingOM = isPlainObject(existingMastra.om) ? existingMastra.om : {};

  return {
    ...existing,
    mastra: {
      ...existingMastra,
      om: {
        ...existingOM,
        ...omMetadata,
      },
    },
  };
}

/**
 * Memory-specific context passed via RequestContext under the 'MastraMemory' key
 * This provides processors with access to memory-related execution context
 */
export type MemoryRequestContext = {
  thread?: Partial<StorageThreadType> & { id: string };
  resourceId?: string;
  memoryConfig?: MemoryConfigInternal;
};

/**
 * Parse and validate memory runtime context from RequestContext
 * @param requestContext - The RequestContext to extract memory context from
 * @returns The validated MemoryRequestContext or null if not available
 * @throws Error if the context exists but is malformed
 */
export function parseMemoryRequestContext(requestContext?: RequestContext): MemoryRequestContext | null {
  if (!requestContext) {
    return null;
  }

  const memoryContext = requestContext.get('MastraMemory');
  if (!memoryContext) {
    return null;
  }

  // Validate the structure
  if (typeof memoryContext !== 'object' || memoryContext === null) {
    throw new Error(`Invalid MemoryRequestContext: expected object, got ${typeof memoryContext}`);
  }

  const ctx = memoryContext as Record<string, unknown>;

  // Validate thread if present
  if (ctx.thread !== undefined) {
    if (typeof ctx.thread !== 'object' || ctx.thread === null) {
      throw new Error(`Invalid MemoryRequestContext.thread: expected object, got ${typeof ctx.thread}`);
    }
    const thread = ctx.thread as Record<string, unknown>;
    if (typeof thread.id !== 'string') {
      throw new Error(`Invalid MemoryRequestContext.thread.id: expected string, got ${typeof thread.id}`);
    }
  }

  // Validate resourceId if present
  if (ctx.resourceId !== undefined && typeof ctx.resourceId !== 'string') {
    throw new Error(`Invalid MemoryRequestContext.resourceId: expected string, got ${typeof ctx.resourceId}`);
  }

  return memoryContext as MemoryRequestContext;
}

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MastraMessageV1[];
  core_message: CoreMessage[];
}[T];

type BaseWorkingMemory = {
  enabled: boolean;
  /**
   * Scope for working memory storage.
   * - 'resource': Memory persists across all threads for the same resource/user (default)
   * - 'thread': Memory is isolated per conversation thread
   *
   * @default 'resource'
   */
  scope?: 'thread' | 'resource';
  /** @deprecated The `use` option has been removed. Working memory always uses tool-call mode. */
  use?: never;
};

type TemplateWorkingMemory = BaseWorkingMemory & {
  template: string;
  schema?: never;
  version?: 'stable' | 'vnext';
};

type SchemaWorkingMemory = BaseWorkingMemory & {
  schema: StandardSchemaWithJSON;
  template?: never;
};

type PublicSchemaWorkingMemory = BaseWorkingMemory & {
  schema: PublicSchema;
  template?: never;
};

type WorkingMemoryNone = BaseWorkingMemory & {
  template?: never;
  schema?: never;
};

export type WorkingMemory = TemplateWorkingMemory | SchemaWorkingMemory | WorkingMemoryNone;

/**
 * Vector index configuration for optimizing semantic recall performance.
 *
 * These settings are primarily supported by PostgreSQL with pgvector extension.
 * Other vector stores (Pinecone, Qdrant, Chroma, etc.) will use their default
 * configurations and ignore these settings.
 *
 * @see https://mastra.ai/docs/memory/semantic-recall#postgresql-index-optimization
 */
export type VectorIndexConfig = {
  /**
   * Type of vector index to create (PostgreSQL/pgvector only).
   * - 'ivfflat': Inverted file index, good balance of speed and recall
   * - 'hnsw': Hierarchical Navigable Small World, best performance for most cases
   * - 'flat': Exact nearest neighbor search, slow but 100% recall
   *
   * @default 'ivfflat'
   * @example
   * ```typescript
   * type: 'hnsw' // Recommended for production
   * ```
   */
  type?: 'ivfflat' | 'hnsw' | 'flat';

  /**
   * Distance metric for similarity calculations.
   * - 'cosine': Normalized dot product, good for text similarity
   * - 'euclidean': L2 distance, geometric distance in vector space
   * - 'dotproduct': Inner product, best for OpenAI embeddings
   *
   * Note: While defined here, most vector stores have their own metric configuration.
   *
   * @default 'cosine'
   * @example
   * ```typescript
   * metric: 'dotproduct' // Optimal for OpenAI embeddings
   * ```
   */
  metric?: 'cosine' | 'euclidean' | 'dotproduct';

  /**
   * Configuration for IVFFlat index (PostgreSQL only).
   * Controls the number of inverted lists for clustering vectors.
   */
  ivf?: {
    /**
     * Number of inverted lists (clusters) to create.
     * Higher values mean better recall but slower build time.
     * Recommended: rows/1000 for tables with > 1M rows.
     *
     * @default 100
     */
    lists?: number;
  };

  /**
   * Configuration for HNSW index (PostgreSQL only).
   * Hierarchical graph-based index with superior query performance.
   */
  hnsw?: {
    /**
     * Maximum number of bi-directional links per node.
     * Higher values increase recall and index size.
     *
     * @default 16
     * @example
     * ```typescript
     * m: 32 // Higher recall, larger index
     * ```
     */
    m?: number;

    /**
     * Size of dynamic candidate list during index construction.
     * Higher values mean better recall but slower index creation.
     *
     * @default 64
     * @example
     * ```typescript
     * efConstruction: 128 // Better quality, slower build
     * ```
     */
    efConstruction?: number;
  };
};

/**
 * Configuration for semantic recall using RAG-based retrieval.
 *
 * Enables agents to retrieve relevant messages from past conversations using vector similarity search.
 * Retrieved messages provide context from beyond the recent conversation history, helping agents
 * maintain continuity across longer interactions.
 *
 * @see https://mastra.ai/docs/memory/semantic-recall
 */
export type SemanticRecall = {
  /**
   * Number of semantically similar messages to retrieve from the vector database.
   * Higher values provide more context but increase token usage.
   *
   * @example
   * ```typescript
   * topK: 3 // Retrieve 3 most similar messages
   * ```
   */
  topK: number;

  /**
   * Amount of surrounding context to include with each retrieved message.
   * Can be a single number (same before/after) or an object with separate values.
   * Helps provide conversational flow around the matched message.
   *
   * @example
   * ```typescript
   * messageRange: 2 // Include 2 messages before and after
   * messageRange: { before: 1, after: 3 } // 1 before, 3 after
   * ```
   */
  messageRange: number | { before: number; after: number };

  /**
   * Scope for semantic search queries.
   * - 'resource': Search across all threads owned by the same resource/user (default)
   * - 'thread': Search only within the current conversation thread
   *
   * @default 'resource'
   * @example
   * ```typescript
   * scope: 'thread' // Limit recall to current thread only
   * ```
   */
  scope?: 'thread' | 'resource';

  /**
   * Vector index configuration (PostgreSQL/pgvector specific).
   * Other vector stores will use their default index configurations.
   * HNSW indexes typically provide better performance than IVFFlat.
   *
   * @example
   * ```typescript
   * indexConfig: {
   *   type: 'hnsw',
   *   metric: 'dotproduct', // Best for OpenAI embeddings
   *   hnsw: { m: 16, efConstruction: 64 }
   * }
   * ```
   */
  indexConfig?: VectorIndexConfig;

  /**
   * Minimum similarity score threshold (0-1).
   * Messages below this threshold will be filtered out from semantic search results.
   *
   * @example
   * ```typescript
   * threshold: 0.7 // Only include messages with 70%+ similarity
   * ```
   */
  threshold?: number;

  /**
   * Index name for the vector store.
   * If not provided, will be auto-generated based on embedder model.
   *
   * @example
   * ```typescript
   * indexName: 'my-custom-index'
   * ```
   */
  indexName?: string;
};

/**
 * Model settings for Observer/Reflector agents in Observational Memory.
 * Uses the same settings as Agent.generate() modelSettings (temperature, maxOutputTokens, topP, etc.).
 */
export type ObservationalMemoryModelSettings = AgentExecutionOptions['modelSettings'];

/**
 * Configuration for the observation step in Observational Memory.
 */
export interface ObservationalMemoryObservationConfig {
  /**
   * Model for the Observer agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided.
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
  modelSettings?: ObservationalMemoryModelSettings;

  /**
   * Provider-specific options passed to the Observer model.
   * Use this for provider features like thinking budgets, safety settings, etc.
   *
   * @example
   * ```ts
   * providerOptions: {
   *   google: { thinkingConfig: { thinkingBudget: 215 } }
   * }
   * ```
   *
   * @default { google: { thinkingConfig: { thinkingBudget: 215 } } }
   */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;

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
   * Observations run asynchronously in the background at this interval,
   * storing results in a buffer. When the main `messageTokens` threshold is reached,
   * buffered observations are activated instantly (no blocking LLM call).
   *
   * Can be an absolute token count (e.g. `5_000`) or a fraction of `messageTokens`
   * (e.g. `0.25` means buffer every 25% of the threshold).
   *
   * Set to `false` to explicitly disable async buffering.
   *
   * Must resolve to less than `messageTokens`.
   *
   * @default 0.2 (buffer every 20% of messageTokens)
   * @example
   * ```ts
   * // Buffer every 5k tokens, activate at 20k
   * observation: {
   *   messageTokens: 20_000,
   *   bufferTokens: 5_000,
   * }
   * // Or equivalently, using a fraction:
   * observation: {
   *   messageTokens: 20_000,
   *   bufferTokens: 0.25,
   * }
   * // Disable async buffering (use synchronous observation)
   * observation: {
   *   bufferTokens: false,
   * }
   * ```
   */
  bufferTokens?: number | false;

  /**
   * Ratio (0-1) of buffered observations to activate when threshold is reached.
   * Setting this below 1 keeps some observations in reserve, which helps maintain
   * conversation continuity and provides a buffer for the next activation cycle.
   *
   * Requires `bufferTokens` to also be set.
   *
   * @default 0.8 (activate 80% of buffered observations, keeping 20% in reserve)
   * @example
   * ```ts
   * // Activate 70% of buffered observations, keep 30% in reserve
   * observation: {
   *   messageTokens: 20_000,
   *   bufferTokens: 0.25,
   *   bufferActivation: 0.7,
   * }
   * ```
   */
  bufferActivation?: number;

  /**
   * Token threshold above which synchronous (blocking) observation is forced.
   * When set, the system will never block for observation between `messageTokens`
   * and `blockAfter` — only async buffering and activation are used in that range.
   * Once unobserved tokens exceed `blockAfter`, a synchronous observation runs as a
   * last resort to prevent context window overflow.
   *
   * Accepts either:
   * - A **multiplier** (1 < value < 2): multiplied by `messageTokens`.
   *   e.g. `blockAfter: 1.5` with `messageTokens: 20_000` → blocks at 30,000 tokens.
   * - An **absolute token count** (≥ 2): must be greater than `messageTokens`.
   *   e.g. `blockAfter: 80_000` → blocks at 80,000 tokens.
   *
   * Only relevant when `bufferTokens` is set. When `bufferTokens` is not set,
   * synchronous observation is used directly at `messageTokens` and this setting has no effect.
   *
   * @default 1.2 (120% of `messageTokens`) when `bufferTokens` is set.
   *
   * @example
   * ```ts
   * // Multiplier: 1.5x messageTokens
   * observation: {
   *   messageTokens: 20_000,
   *   bufferTokens: 0.25,
   *   blockAfter: 1.5, // resolves to 30,000
   * }
   * // Absolute: explicit token count
   * observation: {
   *   messageTokens: 20_000,
   *   bufferTokens: 5_000,
   *   blockAfter: 80_000,
   * }
   * ```
   */
  blockAfter?: number;

  /**
   * Custom instructions appended to the Observer agent's system prompt.
   * Use this to customize what the Observer focuses on or how it formats observations.
   *
   * @example
   * ```ts
   * observation: {
   *   instruction: 'Focus on user dietary preferences and allergies.',
   * }
   * ```
   */
  instruction?: string;
}

/**
 * Configuration for the reflection step in Observational Memory.
 */
export interface ObservationalMemoryReflectionConfig {
  /**
   * Model for the Reflector agent.
   * Can be a model ID string (e.g., 'openai/gpt-4o'), a LanguageModel instance,
   * a function that returns either (for dynamic model selection),
   * or an array of ModelWithRetries for fallback support.
   *
   * Cannot be set if a top-level `model` is also provided.
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
  modelSettings?: ObservationalMemoryModelSettings;

  /**
   * Provider-specific options passed to the Reflector model.
   * Use this for provider features like thinking budgets, safety settings, etc.
   *
   * @example
   * ```ts
   * providerOptions: {
   *   google: { thinkingConfig: { thinkingBudget: 1024 } }
   * }
   * ```
   *
   * @default { google: { thinkingConfig: { thinkingBudget: 1024 } } }
   */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;

  /**
   * Token threshold above which synchronous (blocking) reflection is forced.
   * When set with async reflection enabled, the system will not block for
   * reflection between `observationTokens` and `blockAfter` — only async
   * buffering and activation are used in that range. Once observation tokens
   * exceed `blockAfter`, a synchronous reflection runs as a last resort.
   *
   * Accepts either:
   * - A **multiplier** (1 < value < 2): multiplied by `observationTokens`.
   *   e.g. `blockAfter: 1.5` with `observationTokens: 30_000` → blocks at 45,000 tokens.
   * - An **absolute token count** (≥ 2): must be greater than `observationTokens`.
   *   e.g. `blockAfter: 50_000` → blocks at 50,000 tokens.
   *
   * Only relevant when `bufferActivation` is set. When `bufferActivation` is not set,
   * synchronous reflection is used directly at `observationTokens` and this setting has no effect.
   *
   * @default 1.2 (120% of `observationTokens`) when `bufferActivation` is set.
   */
  blockAfter?: number;

  /**
   * Ratio (0-1) controlling when async reflection buffering starts.
   * When observation tokens reach `observationTokens * bufferActivation`,
   * reflection runs asynchronously in the background. When the full
   * `observationTokens` threshold is reached, the buffered reflection
   * is spliced into the observation content instantly (no blocking LLM call).
   *
   * Only one buffered reflection is maintained at a time. On activation,
   * the buffered reflection replaces the line range it was generated from,
   * and any new observations appended after that range are preserved.
   *
   * Requires `observation.bufferTokens` to also be set (async observation).
   *
   * @example
   * ```ts
   * reflection: {
   *   observationTokens: 30_000,
   *   bufferActivation: 0.5, // Start buffering at 15k tokens
   * }
   * ```
   */
  bufferActivation?: number;

  /**
   * Custom instructions appended to the Reflector agent's system prompt.
   * Use this to customize how the Reflector consolidates observations.
   *
   * @example
   * ```ts
   * reflection: {
   *   instruction: 'Consolidate observations and remove duplicates.',
   * }
   * ```
   */
  instruction?: string;
}

/**
 * Configuration for Observational Memory.
 *
 * Observational Memory is a three-tier memory system that uses an Observer agent
 * to extract observations from conversations and a Reflector agent to compress them.
 * This enables efficient long-term memory with minimal context usage.
 *
 * Can be set to `true` to enable with defaults, or an object to customize.
 *
 * @example
 * ```typescript
 * // Enable with defaults
 * observationalMemory: true
 *
 * // Custom configuration
 * observationalMemory: {
 *   scope: 'resource',
 *   model: 'google/gemini-2.5-flash',
 *   observation: {
 *     messageTokens: 20_000,
 *   },
 *   reflection: {
 *     observationTokens: 90_000,
 *   },
 * }
 * ```
 */
export interface ObservationalMemoryOptions {
  /**
   * Enable or disable Observational Memory.
   * When omitted, defaults to `true` (enabled).
   * Only `enabled: false` explicitly disables it.
   *
   * @default true
   */
  enabled?: boolean;

  /**
   * Model for both Observer and Reflector agents.
   * Sets the model for both agents at once. Cannot be used together with
   * `observation.model` or `reflection.model` — an error will be thrown.
   *
   * @default 'google/gemini-2.5-flash'
   */
  model?: AgentConfig['model'];

  /**
   * Observation step configuration for extracting observations from conversations.
   */
  observation?: ObservationalMemoryObservationConfig;

  /**
   * Reflection step configuration for compressing observations.
   */
  reflection?: ObservationalMemoryReflectionConfig;

  /**
   * Memory scope for observations.
   * - 'resource': Observations span all threads for a resource (cross-thread memory)
   * - 'thread': Observations are per-thread (default)
   *
   * @default 'thread'
   */
  scope?: 'resource' | 'thread';

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
}

/**
 * Check if observational memory is enabled from a `boolean | ObservationalMemoryOptions` value.
 *
 * - `true` → enabled
 * - `false` → disabled
 * - `{ enabled: false }` → disabled
 * - `{ ... }` (without `enabled: false`) → enabled
 * - `undefined` → disabled
 */
export function isObservationalMemoryEnabled(
  config: boolean | ObservationalMemoryOptions | undefined,
): config is true | ObservationalMemoryOptions {
  if (config === true) return true;
  if (config === false || config === undefined) return false;
  return config.enabled !== false;
}

/**
 * Configuration for memory behaviors and retrieval strategies.
 *
 * Controls three types of memory: conversation history (recent messages), semantic recall
 * (RAG-based retrieval of relevant past messages), and working memory (persistent user data).
 * All memory types are combined into a single context window for the LLM.
 *
 * @see https://mastra.ai/docs/memory/overview
 */
type BaseMemoryConfig = {
  /**
   * When true, prevents memory from saving new messages.
   * Useful for internal agents (like routing agents) that should read memory but not modify it.
   *
   * @default false
   * @example
   * ```typescript
   * readOnly: true // Agent can read memory but won't save new messages
   * ```
   */
  readOnly?: boolean;

  /**
   * Number of recent messages from the current thread to include in context.
   * Provides short-term conversational continuity.
   * Set to false to disable conversation history entirely.
   *
   * @default 10
   * @example
   * ```typescript
   * lastMessages: 5 // Include last 5 messages
   * lastMessages: false // Disable conversation history
   * ```
   */
  lastMessages?: number | false;

  /**
   * Semantic recall configuration for RAG-based retrieval of relevant past messages.
   * Uses vector embeddings for similarity search across conversation history.
   * Can be a boolean to enable/disable with defaults, or an object for detailed configuration.
   *
   * @default false (disabled by default)
   * @example
   * ```typescript
   * semanticRecall: false // Disable semantic recall
   * semanticRecall: {
   *   topK: 5,
   *   messageRange: 2,
   *   scope: 'resource' // Search across all resource (user) threads
   * }
   * ```
   */
  semanticRecall?: boolean | SemanticRecall;

  /**
   * Working memory configuration for persistent user data and preferences.
   * Maintains a structured record (Markdown or schema-based) that agents update over time.
   * Can be thread-scoped (per conversation) or resource-scoped (across all user threads).
   *
   * @example
   * ```typescript
   * workingMemory: {
   *   enabled: true,
   *   scope: 'resource', // Persist across all resource (user) conversations
   *   template: '# User Profile\n- **Name**:\n- **Preferences**:',
   *   schema: z.object({
   *     name: z.string(),
   *     preferences: z.object({
   *       communicationStyle: z.string(),
   *       projectGoal: z.string(),
   *       deadlines: z.array(z.string()),
   *     }),
   *   }),
   * }
   * ```
   */
  workingMemory?: WorkingMemory;

  /**
   * Observational Memory configuration for long-term memory with automatic observation and reflection.
   *
   * Uses an Observer agent to extract observations from conversations and a Reflector agent
   * to compress them when they grow too large. This enables efficient long-term memory
   * that maintains context across many conversations.
   *
   * Set to `true` to enable with defaults, `false` to disable, or an object to customize.
   *
   * @example
   * ```typescript
   * // Enable with defaults
   * observationalMemory: true
   *
   * // Custom configuration
   * observationalMemory: {
   *   scope: 'resource',
   *   model: 'google/gemini-2.5-flash',
   *   observation: {
   *     messageTokens: 20_000,
   *   },
   *   reflection: {
   *     observationTokens: 90_000,
   *   },
   * }
   * ```
   */
  observationalMemory?: boolean | ObservationalMemoryOptions;

  /**
   * Automatically generate descriptive thread titles based on the first user message.
   * Can be a boolean to enable with defaults, or an object to customize the model and instructions.
   * Title generation runs asynchronously and doesn't affect response time.
   *
   * @default false
   * @example
   * ```typescript
   * generateTitle: true // Use agent's model for title generation
   * generateTitle: {
   *   model: openai("gpt-4o-mini"),
   *   instructions: "Generate a concise title (max 5 words)"
   * }
   * ```
   */
  generateTitle?:
    | boolean
    | {
        /**
         * Language model to use for title generation.
         * Can be static or a function that receives request context for dynamic selection.
         * Accepts both Mastra models and standard AI SDK LanguageModelV1/V2.
         */
        model: DynamicArgument<MastraModelConfig>;
        /**
         * Custom instructions for title generation.
         * Can be static or a function that receives request context for dynamic customization.
         */
        instructions?: DynamicArgument<string>;
      };

  /**
   * Thread management configuration.
   * @deprecated The `threads` object is deprecated. Use top-level `generateTitle` instead of `threads.generateTitle`.
   */
  threads?: {
    /**
     * @deprecated Moved to top-level `generateTitle`. Using `threads.generateTitle` will throw an error.
     */
    generateTitle?:
      | boolean
      | {
          model: DynamicArgument<MastraModelConfig>;
          instructions?: DynamicArgument<string>;
        };
  };
};

export type MemoryConfigInternal = BaseMemoryConfig & {
  /**
   * Working memory configuration for persistent user data and preferences.
   * Maintains a structured record (Markdown or schema-based) that agents update over time.
   * Can be thread-scoped (per conversation) or resource-scoped (across all user threads).
   *
   * @example
   * ```typescript
   * workingMemory: {
   *   enabled: true,
   *   scope: 'resource', // Persist across all resource (user) conversations
   *   template: '# User Profile\n- **Name**:\n- **Preferences**:',
   *   schema: z.object({
   *     name: z.string(),
   *     preferences: z.object({
   *       communicationStyle: z.string(),
   *       projectGoal: z.string(),
   *       deadlines: z.array(z.string()),
   *     }),
   *   }),
   * }
   * ```
   */
  workingMemory?: WorkingMemory;
};

export type MemoryConfig = BaseMemoryConfig & {
  /**
   * Working memory configuration for persistent user data and preferences.
   * Maintains a structured record (Markdown or schema-based) that agents update over time.
   * Can be thread-scoped (per conversation) or resource-scoped (across all user threads).
   *
   * @example
   * ```typescript
   * workingMemory: {
   *   enabled: true,
   *   scope: 'resource', // Persist across all resource (user) conversations
   *   template: '# User Profile\n- **Name**:\n- **Preferences**:',
   *   schema: z.object({
   *     name: z.string(),
   *     preferences: z.object({
   *       communicationStyle: z.string(),
   *       projectGoal: z.string(),
   *       deadlines: z.array(z.string()),
   *     }),
   *   }),
   * }
   * ```
   */
  workingMemory?: TemplateWorkingMemory | PublicSchemaWorkingMemory | WorkingMemoryNone;
};

/**
 * Configuration for Mastra's memory system.
 *
 * Enables agents to persist and recall information across conversations using storage providers,
 * vector databases for semantic search, and processors for context management. Memory can be
 * scoped to individual threads or shared across all conversations for a resource (user).
 *
 * @see https://mastra.ai/docs/memory/overview
 */
export type SharedMemoryConfig = {
  /**
   * Storage adapter for persisting conversation threads, messages, and working memory.
   *
   * @example
   * ```typescript
   * storage: new LibSQLStore({ id: 'agent-memory-storage', url: "file:./agent-memory.db" })
   * ```
   */
  storage?: MastraCompositeStore;

  /**
   * Configuration for memory behaviors including conversation history, semantic recall,
   * working memory, and thread management. Controls how messages are retrieved and
   * what context is included in the LLM's prompt.
   */
  options?: MemoryConfigInternal;

  /**
   * Vector database for semantic recall capabilities using RAG-based search.
   * Enables retrieval of relevant messages from past conversations based on semantic similarity.
   * Set to false to disable vector search entirely.
   *
   * @example
   * ```typescript
   * vector: new PgVector({ connectionString: process.env.DATABASE_URL })
   * ```
   */
  vector?: MastraVector | false;

  /**
   * Embedding model for converting messages into vector representations for semantic search.
   * Compatible with any AI SDK embedding model. FastEmbed provides local embeddings,
   * while providers like OpenAI offer cloud-based models.
   *
   * Can be specified as:
   * - A string in the format "provider/model" (e.g., "openai/text-embedding-3-small")
   * - An EmbeddingModel or EmbeddingModelV2 instance
   *
   * @example
   * ```typescript
   * // Using a string (model router format)
   * embedder: "openai/text-embedding-3-small"
   *
   * // Using an AI SDK model directly
   * embedder: openai.embedding("text-embedding-3-small")
   * ```
   */
  embedder?: EmbeddingModelId | MastraEmbeddingModel<string> | string;

  /**
   * Options to pass to the embedder when generating embeddings.
   * Use this to pass provider-specific options like outputDimensionality for Google models.
   *
   * @example
   * ```typescript
   * // Control embedding dimensions for Google models
   * embedderOptions: {
   *   providerOptions: {
   *     google: {
   *       outputDimensionality: 768,
   *       taskType: 'RETRIEVAL_DOCUMENT'
   *     }
   *   }
   * }
   * ```
   */
  embedderOptions?: MastraEmbeddingOptions;

  /**
   * @deprecated This option is deprecated and will throw an error if used.
   * Use the new Input/Output processor system instead.
   *
   * See: https://mastra.ai/en/docs/memory/processors
   *
   * @example
   * ```typescript
   * // OLD (throws error):
   * new Memory({
   *   processors: [new TokenLimiter(100000)]
   * })
   *
   * // NEW (use this):
   * new Agent({
   *   memory,
   *   outputProcessors: [new TokenLimiterProcessor(100000)]
   * })
   * ```
   */
  processors?: MemoryProcessor[];
};

export type WorkingMemoryFormat = 'json' | 'markdown';

export type WorkingMemoryTemplate = {
  format: WorkingMemoryFormat;
  content: string;
};

// Type for flexible message deletion input
export type MessageDeleteInput = string[] | { id: string }[];

/**
 * Serialized memory configuration that can be stored in the database
 * This is a subset of SharedMemoryConfig with serializable types only
 */
export type SerializedMemoryConfig = {
  /**
   * Vector database identifier. The vector instance should be registered
   * with the Mastra instance to resolve from this ID.
   * Set to false to disable vector search entirely.
   */
  vector?: string | false;

  /**
   * Configuration for memory behaviors, omitting WorkingMemory and threads
   */
  options?: {
    /** Treat memory as read-only (no new messages stored) */
    readOnly?: boolean;

    /** Number of recent messages to include, or false to disable */
    lastMessages?: number | false;

    /** Semantic recall configuration */
    semanticRecall?: boolean | SemanticRecall;

    /** Title generation configuration (serialized form) */
    generateTitle?:
      | boolean
      | {
          /** Model ID in format provider/model-name */
          model: ModelRouterModelId;
          /** Custom instructions for title generation */
          instructions?: string;
        };
  };

  /**
   * Embedding model ID in the format "provider/model"
   * (e.g., "openai/text-embedding-3-small")
   * Can be a predefined EmbeddingModelId or a custom string
   */
  embedder?: EmbeddingModelId | string;

  /**
   * Options to pass to the embedder, omitting telemetry
   */
  embedderOptions?: Omit<MastraEmbeddingOptions, 'telemetry'>;

  /**
   * Serialized observational memory configuration.
   * `true` to enable with defaults, or a config object for customization.
   * Only JSON-safe fields are included (model IDs as strings, numeric/boolean settings).
   */
  observationalMemory?: boolean | SerializedObservationalMemoryConfig;
};

/**
 * JSON-serializable subset of ObservationalMemoryOptions for storage.
 * Model references are stored as string IDs (e.g., "google/gemini-2.5-flash").
 */
export type SerializedObservationalMemoryConfig = {
  /** Model ID for both Observer and Reflector (e.g., "google/gemini-2.5-flash") */
  model?: string;

  /** Memory scope: 'resource' or 'thread' */
  scope?: 'resource' | 'thread';

  /** Share the token budget between messages and observations */
  shareTokenBudget?: boolean;

  /** Observation step configuration */
  observation?: SerializedObservationalMemoryObservationConfig;

  /** Reflection step configuration */
  reflection?: SerializedObservationalMemoryReflectionConfig;
};

/** Serializable subset of ObservationalMemoryObservationConfig */
export type SerializedObservationalMemoryObservationConfig = {
  /** Observer model ID */
  model?: string;
  /** Token count threshold that triggers observation */
  messageTokens?: number;
  /** Model settings (temperature, maxOutputTokens, etc.) */
  modelSettings?: Record<string, unknown>;
  /** Provider-specific options */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  /** Maximum tokens per batch */
  maxTokensPerBatch?: number;
  /** Token interval for async buffering, or false to disable */
  bufferTokens?: number | false;
  /** Ratio of buffered observations to activate */
  bufferActivation?: number;
  /** Token threshold for synchronous blocking */
  blockAfter?: number;
};

/** Serializable subset of ObservationalMemoryReflectionConfig */
export type SerializedObservationalMemoryReflectionConfig = {
  /** Reflector model ID */
  model?: string;
  /** Token count threshold that triggers reflection */
  observationTokens?: number;
  /** Model settings (temperature, maxOutputTokens, etc.) */
  modelSettings?: Record<string, unknown>;
  /** Provider-specific options */
  providerOptions?: Record<string, Record<string, unknown> | undefined>;
  /** Token threshold for synchronous blocking */
  blockAfter?: number;
  /** Ratio for async reflection buffering */
  bufferActivation?: number;
};
