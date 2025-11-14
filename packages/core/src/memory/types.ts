import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { EmbeddingModel, AssistantContent, CoreMessage, ToolContent, UserContent } from '@internal/ai-sdk-v4';
import type { JSONSchema7 } from 'json-schema';

export type { MastraDBMessage } from '../agent';
import type { ZodObject } from 'zod';
import type { EmbeddingModelId } from '../llm/model/index.js';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { MastraStorage } from '../storage';
import type { DynamicArgument } from '../types';
import type { MastraVector } from '../vector';
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
  schema: ZodObject<any> | JSONSchema7;
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
};

/**
 * Configuration for memory behaviors and retrieval strategies.
 *
 * Controls three types of memory: conversation history (recent messages), semantic recall
 * (RAG-based retrieval of relevant past messages), and working memory (persistent user data).
 * All memory types are combined into a single context window for the LLM.
 *
 * @see https://mastra.ai/docs/memory/overview
 */
export type MemoryConfig = {
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
         */
        model: DynamicArgument<MastraLanguageModel>;
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
          model: DynamicArgument<MastraLanguageModel>;
          instructions?: DynamicArgument<string>;
        };
  };
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
  storage?: MastraStorage;

  /**
   * Configuration for memory behaviors including conversation history, semantic recall,
   * working memory, and thread management. Controls how messages are retrieved and
   * what context is included in the LLM's prompt.
   */
  options?: MemoryConfig;

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
  embedder?: EmbeddingModelId | EmbeddingModel<string> | EmbeddingModelV2<string>;

  /**
   * Memory processors that modify retrieved messages before sending to the LLM.
   * Useful for managing context size, filtering content, and preventing token limit errors.
   * Processors execute in order, with TokenLimiter typically placed last.
   *
   * @example
   * ```typescript
   * processors: [
   *   new CustomMemoryProcessor(),
   *   new TokenLimiter(127000)
   * ]
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
