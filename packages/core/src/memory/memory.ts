import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { AssistantContent, UserContent, CoreMessage, EmbeddingModel } from 'ai';
import { MessageList } from '../agent/message-list';
import type { MastraMessageV2, UIMessageWithMetadata } from '../agent/message-list';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraStorage, PaginationInfo, StorageGetMessagesArg, ThreadSortOptions } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { ToolAction } from '../tools';
import { deepMerge } from '../utils';
import type { MastraVector } from '../vector';

import type {
  SharedMemoryConfig,
  StorageThreadType,
  MemoryConfig,
  MastraMessageV1,
  WorkingMemoryTemplate,
} from './types';

/**
 * Options for processing messages through memory processors
 */
export type MemoryProcessorOpts = {
  /** Optional system message to provide context for processing */
  systemMessage?: string;
  /** Optional memory-specific system message for additional context */
  memorySystemMessage?: string;
  /** New messages being added to the conversation */
  newMessages?: CoreMessage[];
};

/**
 * Base MemoryProcessor classs for implementing message processors that can filter or transform messages
 * before they're sent to the LLM. Processors can be chained together to create complex
 * message transformation pipelines.
 */
export abstract class MemoryProcessor extends MastraBase {
  /**
   * Process a list of messages and return a filtered or transformed list.
   * Override this method to implement custom message processing logic.
   *
   * @param messages - The messages to process
   * @param _opts - Processing options including system messages and new messages
   * @returns The processed messages (can be synchronous or asynchronous)
   *
   * @example
   * ```typescript
   * class TokenLimitProcessor extends MemoryProcessor {
   *   process(messages: CoreMessage[]): CoreMessage[] {
   *     // Keep only last 10 messages to stay within token limits
   *     return messages.slice(-10);
   *   }
   * }
   * ```
   */
  process(messages: CoreMessage[], _opts: MemoryProcessorOpts): CoreMessage[] | Promise<CoreMessage[]> {
    return messages;
  }
}

export const memoryDefaultOptions = {
  lastMessages: 10,
  semanticRecall: false,
  threads: {
    generateTitle: false,
  },
  workingMemory: {
    enabled: false,
    template: `
# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Occupation**: 
- **Interests**: 
- **Goals**: 
- **Events**: 
- **Facts**: 
- **Projects**: 
`,
  },
} satisfies MemoryConfig;

/**
 * Abstract base class for implementing conversation memory systems.
 *
 * Key features:
 * - Thread-based conversation organization with resource association
 * - Optional vector database integration for semantic similarity search
 * - Working memory templates for structured conversation state
 * - Handles memory processors to manipulate messages before they are sent to the LLM
 */
export abstract class MastraMemory extends MastraBase {
  protected _storage?: MastraStorage;
  protected vector?: MastraVector;
  protected embedder?: EmbeddingModel<string> | EmbeddingModelV2<string>;
  private processors: MemoryProcessor[] = [];
  protected threadConfig: MemoryConfig = { ...memoryDefaultOptions };
  protected _hasOwnStorage = false;

  #mastra?: Mastra;

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });

    if (config.options) this.threadConfig = this.getMergedThreadConfig(config.options);
    if (config.processors) this.processors = config.processors;
    if (config.storage) {
      this._storage = augmentWithInit(config.storage);
      this._hasOwnStorage = true;
    }

    if (this.threadConfig.semanticRecall) {
      if (!config.vector) {
        throw new Error(
          `Semantic recall requires a vector store to be configured.\n\nhttps://mastra.ai/en/docs/memory/semantic-recall`,
        );
      }
      this.vector = config.vector;

      if (!config.embedder) {
        throw new Error(
          `Semantic recall requires an embedder to be configured.\n\nhttps://mastra.ai/en/docs/memory/semantic-recall`,
        );
      }
      this.embedder = config.embedder;
    }
  }

  /**
   * Internal method used by Mastra to register itself with the memory.
   * @param mastra The Mastra instance.
   * @internal
   */
  __registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }
  /**
   * @internal
   */
  get hasOwnStorage() {
    return this._hasOwnStorage;
  }

  /**
   * Get the storage provider for this memory instance.
   */
  get storage() {
    if (!this._storage) {
      throw new Error(
        `Memory requires a storage provider to function. Add a storage configuration to Memory or to your Mastra instance.\n\nhttps://mastra.ai/en/docs/memory/overview`,
      );
    }
    return this._storage;
  }

  /**
   * Sets the storage provider for this memory instance.
   * Automatically wraps the storage with initialization support.
   *
   * @param storage - The storage provider to use
   * @internal
   *
   * @example
   * ```typescript
   * import { PgStorage } from "@mastra/pg";
   *
   * const storage = new PgStorage({
   *   connectionString: "postgresql://..."
   * });
   * memory.setStorage(storage);
   * ```
   */
  public setStorage(storage: MastraStorage) {
    this._storage = augmentWithInit(storage);
  }

  /**
   * Sets the vector store for semantic search capabilities.
   * Required when semantic recall is enabled.
   *
   * @param vector - The vector store to use
   * @internal
   *
   * @example
   * ```typescript
   * import { PineconeVector } from "@mastra/vector";
   *
   * const vector = new PineconeVector({
   *   apiKey: "your-api-key",
   *   environment: "us-east-1"
   * });
   * memory.setVector(vector);
   * ```
   */
  public setVector(vector: MastraVector) {
    this.vector = vector;
  }

  /**
   * Sets the embedding model for generating vector representations of messages.
   * Required when semantic recall is enabled.
   *
   * @param embedder - The embedding model to use
   * @internal
   *
   * @example
   * ```typescript
   * import { openai } from "@ai-sdk/openai";
   *
   * const embedder = openai.embedding("text-embedding-3-small");
   * memory.setEmbedder(embedder);
   * ```
   */
  public setEmbedder(embedder: EmbeddingModel<string>) {
    this.embedder = embedder;
  }

  /**
   * Get a system message to inject into the conversation.
   * This will be called before each conversation turn.
   * Implementations can override this to inject custom system messages.
   *
   * @param input - Configuration for retrieving the system message
   * @param input.threadId - The ID of the conversation thread
   * @param input.resourceId - Optional ID of the resource (e.g., user) associated with the thread
   * @param input.memoryConfig - Optional memory configuration to override the default memory configuration
   * @returns Promise resolving to a system message string or null if no system message is needed
   *
   * @example
   * ```typescript
   * class CustomMemory extends MastraMemory {
   *   async getSystemMessage({ threadId }) {
   *     const context = await this.getContext(threadId);
   *     return `You are assisting with: ${context.projectName}`;
   *   }
   * }
   * ```
   */
  public async getSystemMessage(_input: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    return null;
  }

  /**
   * Get tools that should be available to the agent.
   * This will be called when converting tools for the agent.
   * Implementations can override this to provide additional tools.
   *
   * @param config - Optional memory configuration to customize tool selection
   * @returns A record of tool names to ToolAction implementations
   *
   * @example
   * ```typescript
   * class MemoryWithTools extends MastraMemory {
   *   getTools(config?: MemoryConfig) {
   *     return {
   *       searchMemory: {
   *         description: "Search through conversation history",
   *         schema: z.object({ query: z.string() }),
   *         execute: async ({ query }) => {
   *           // Search implementation
   *         }
   *       }
   *     };
   *   }
   * }
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTools(config?: MemoryConfig): Record<string, ToolAction<any, any, any>> {
    return {};
  }

  protected async createEmbeddingIndex(dimensions?: number, config?: MemoryConfig): Promise<{ indexName: string }> {
    const defaultDimensions = 1536;
    const isDefault = dimensions === defaultDimensions;
    const usedDimensions = dimensions ?? defaultDimensions;
    const separator = this.vector?.indexSeparator ?? '_';
    const indexName = isDefault
      ? `memory${separator}messages`
      : `memory${separator}messages${separator}${usedDimensions}`;

    if (typeof this.vector === `undefined`) {
      throw new Error(`Tried to create embedding index but no vector db is attached to this Memory instance.`);
    }

    // Get index configuration from memory config
    const semanticConfig = typeof config?.semanticRecall === 'object' ? config.semanticRecall : undefined;
    const indexConfig = semanticConfig?.indexConfig;

    // Base parameters that all vector stores support
    const createParams: any = {
      indexName,
      dimension: usedDimensions,
      ...(indexConfig?.metric && { metric: indexConfig.metric }),
    };

    // Add PG-specific configuration if provided
    // Only PG vector store will use these parameters
    if (indexConfig && (indexConfig.type || indexConfig.ivf || indexConfig.hnsw)) {
      createParams.indexConfig = {};
      if (indexConfig.type) createParams.indexConfig.type = indexConfig.type;
      if (indexConfig.ivf) createParams.indexConfig.ivf = indexConfig.ivf;
      if (indexConfig.hnsw) createParams.indexConfig.hnsw = indexConfig.hnsw;
    }

    await this.vector.createIndex(createParams);
    return { indexName };
  }

  /**
   * Merges the provided memory configuration with the default configuration.
   * Deep merges configuration objects while preserving specific overrides.
   *
   * @internal
   * @param config - Optional memory configuration to merge with defaults
   * @returns The merged memory configuration
   *
   * @example
   * ```typescript
   * const memory = new Memory();
   * const config = memory.getMergedThreadConfig({
   *   lastMessages: 20,
   *   semanticRecall: true
   * });
   * ```
   */
  public getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    if (config?.workingMemory && 'use' in config.workingMemory) {
      throw new Error('The workingMemory.use option has been removed. Working memory always uses tool-call mode.');
    }
    const mergedConfig = deepMerge(this.threadConfig, config || {});

    if (config?.workingMemory?.schema) {
      if (mergedConfig.workingMemory) {
        mergedConfig.workingMemory.schema = config.workingMemory.schema;
      }
    }

    if (!mergedConfig?.threads) {
      mergedConfig.threads = {};
    }

    mergedConfig.threads.generateTitle = config?.threads?.generateTitle !== false;

    return mergedConfig;
  }

  /**
   * Apply all configured message processors to a list of messages.
   * Processors are applied sequentially in the order they were configured.
   *
   * @param messages - The messages to process
   * @param opts - Processing options including processors and system messages
   * @returns Promise resolving to the processed messages
   * @protected
   */
  protected async applyProcessors(
    messages: CoreMessage[],
    opts: {
      processors?: MemoryProcessor[];
    } & MemoryProcessorOpts,
  ): Promise<CoreMessage[]> {
    const processors = opts.processors || this.processors;
    if (!processors || processors.length === 0) {
      return messages;
    }

    let processedMessages = [...messages];

    for (const processor of processors) {
      processedMessages = await processor.process(processedMessages, {
        systemMessage: opts.systemMessage,
        newMessages: opts.newMessages,
        memorySystemMessage: opts.memorySystemMessage,
      });
    }

    return processedMessages;
  }

  /**
   * Process messages through the configured or provided processors.
   *
   * @param params - Processing parameters
   * @param params.messages - The messages to process
   * @param params.processors - Optional array of processors to use (defaults to configured processors)
   * @param params.systemMessage - Optional system message for context
   * @param params.memorySystemMessage - Optional memory-specific system message
   * @param params.newMessages - Optional new messages being added
   * @returns Promise resolving to the processed messages
   *
   * @example
   * ```typescript
   * const processed = await memory.processMessages({
   *   messages: coreMessages,
   *   systemMessage: "You are a helpful assistant"
   * });
   * ```
   */
  processMessages({
    messages,
    processors,
    ...opts
  }: {
    messages: CoreMessage[];
    processors?: MemoryProcessor[];
  } & MemoryProcessorOpts) {
    return this.applyProcessors(messages, { processors: processors || this.processors, ...opts });
  }

  /**
   * Retrieves and processes messages from memory based on the specified criteria.
   * Combines recent conversation history with semantically similar messages if configured.
   *
   * @param params - Parameters for message retrieval
   * @param params.threadId - The ID of the conversation thread
   * @param params.resourceId - Optional ID of the resource associated with the thread
   * @param params.vectorMessageSearch - Optional search query for semantic retrieval
   * @param params.config - Optional memory configuration to customize retrieval
   * @returns Promise resolving to both v1 and v2 format messages
   *
   * @example
   * ```typescript
   * const { messages, messagesV2 } = await memory.rememberMessages({
   *   threadId: "thread-123",
   *   vectorMessageSearch: "previous discussion about authentication",
   *   config: { lastMessages: 20 }
   * });
   * ```
   */
  abstract rememberMessages({
    threadId,
    resourceId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{ messages: MastraMessageV1[]; messagesV2: MastraMessageV2[] }>;

  /**
   * Estimates the number of tokens in a text string.
   * Uses a simple heuristic based on word count.
   *
   * @param text - The text to estimate tokens for
   * @returns Estimated number of tokens
   *
   * @example
   * ```typescript
   * const tokenCount = memory.estimateTokens("Hello world!");
   * console.log(tokenCount); // ~3
   * ```
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  /**
   * Retrieves a specific thread by its ID.
   *
   * @param params - Parameters for thread retrieval
   * @param params.threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   *
   * @example
   * ```typescript
   * const thread = await memory.getThreadById({
   *   threadId: "thread-123"
   * });
   * if (thread) {
   *   console.log(thread.title, thread.createdAt);
   * }
   * ```
   */
  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  /**
   * Retrieves all threads that belong to the specified resource.
   *
   * @param params - Parameters for thread retrieval
   * @param params.resourceId - The unique identifier of the resource
   * @param params.orderBy - Which timestamp field to sort by (`'createdAt'` or `'updatedAt'`);
   *                         defaults to `'createdAt'`
   * @param params.sortDirection - Sort order for the results (`'ASC'` or `'DESC'`);
   *                               defaults to `'DESC'`
   * @returns Promise resolving to an array of matching threads; resolves to an empty array
   *          if the resource has no threads
   *
   * @example
   * ```typescript
   * const threads = await memory.getThreadsByResourceId({
   *   resourceId: "user-123",
   *   orderBy: "updatedAt",
   *   sortDirection: "DESC"
   * });
   * console.log(`User has ${threads.length} conversations`);
   * ```
   */
  abstract getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]>;

  /**
   * Retrieves threads for a resource with pagination support.
   *
   * @param args - Parameters for paginated thread retrieval
   * @param args.resourceId - The unique identifier of the resource
   * @param args.page - Page number (1-based)
   * @param args.perPage - Number of threads per page
   * @param args.orderBy - Which timestamp field to sort by
   * @param args.sortDirection - Sort order for the results
   * @returns Promise resolving to paginated threads with metadata
   *
   * @example
   * ```typescript
   * const result = await memory.getThreadsByResourceIdPaginated({
   *   resourceId: "user-123",
   *   page: 1,
   *   perPage: 10,
   *   orderBy: "createdAt",
   *   sortDirection: "DESC"
   * });
   * console.log(`Page ${result.currentPage} of ${result.totalPages}`);
   * ```
   */
  abstract getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }>;

  /**
   * Saves or updates a thread in storage.
   * If the thread ID exists, it will be updated; otherwise, a new thread is created.
   *
   * @param params - Parameters for saving the thread
   * @param params.thread - The thread data to save
   * @param params.memoryConfig - Optional memory configuration to override the default memory configuration
   * @returns Promise resolving to the saved thread
   *
   * @example
   * ```typescript
   * const thread = await memory.saveThread({
   *   thread: {
   *     id: "thread-123",
   *     title: "Customer Support Chat",
   *     resourceId: "user-456",
   *     createdAt: new Date(),
   *     updatedAt: new Date(),
   *     metadata: { priority: "high" }
   *   }
   * });
   * ```
   */
  abstract saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType>;

  /**
   * Saves one or more messages to a thread.
   * Supports both v1 and v2 message formats.
   *
   * @param args - Parameters for saving messages
   * @param args.messages - Array of messages to save (v1, v2, or mixed)
   * @param args.memoryConfig - Optional memory configuration
   * @param args.format - Output format for the saved messages ('v1' or 'v2')
   * @returns Promise resolving to the saved messages in the specified format
   *
   * @example
   * ```typescript
   * // Save v1 format messages
   * const savedV1 = await memory.saveMessages({
   *   messages: [{
   *     id: "msg-1",
   *     content: "Hello!",
   *     role: "user",
   *     createdAt: new Date(),
   *     threadId: "thread-123",
   *     type: "text"
   *   }],
   *   format: "v1"
   * });
   *
   * // Save and get v2 format
   * const savedV2 = await memory.saveMessages({
   *   messages: [...],
   *   format: "v2"
   * });
   * ```
   */
  abstract saveMessages(args: {
    messages: (MastraMessageV1 | MastraMessageV2)[] | MastraMessageV1[] | MastraMessageV2[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1';
  }): Promise<MastraMessageV1[]>;
  abstract saveMessages(args: {
    messages: (MastraMessageV1 | MastraMessageV2)[] | MastraMessageV1[] | MastraMessageV2[];
    memoryConfig?: MemoryConfig | undefined;
    format: 'v2';
  }): Promise<MastraMessageV2[]>;
  abstract saveMessages(args: {
    messages: (MastraMessageV1 | MastraMessageV2)[] | MastraMessageV1[] | MastraMessageV2[];
    memoryConfig?: MemoryConfig | undefined;
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV2[] | MastraMessageV1[]>;

  /**
   * Retrieves all messages for a specific thread or resource.
   * Returns messages in both core format (for LLM) and UI format (for display).
   *
   * @param params - Query parameters
   * @param params.threadId - The unique identifier of the thread
   * @param params.resourceId - Optional resource ID for filtering
   * @param params.selectBy - Optional selection criteria
   * @returns Promise resolving to messages in both core and UI formats
   *
   * @example
   * ```typescript
   * const { messages, uiMessages } = await memory.query({
   *   threadId: "thread-123",
   *   resourceId: "user-456"
   * });
   *
   * // Use messages for LLM
   * const response = await llm.generate({ messages });
   *
   * // Use uiMessages for display
   * uiMessages.forEach(msg => {
   *   console.log(`${msg.role}: ${msg.content}`);
   * });
   * ```
   */
  abstract query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: UIMessageWithMetadata[] }>;

  /**
   * Helper method to create a new thread.
   * Generates a unique ID if not provided and sets timestamps automatically.
   *
   * @param params - Parameters for thread creation
   * @param params.resourceId - The ID of the resource that owns this thread
   * @param params.threadId - Optional specific thread ID to use
   * @param params.title - Optional title for the thread (defaults to timestamped title)
   * @param params.metadata - Optional metadata to attach to the thread
   * @param params.memoryConfig - Optional memory configuration to override the default memory configuration
   * @param params.saveThread - Whether to persist the thread immediately (default: true)
   * @returns Promise resolving to the created thread
   *
   * @example
   * ```typescript
   * const thread = await memory.createThread({
   *   resourceId: "user-123",
   *   title: "Product inquiry",
   *   metadata: {
   *     source: "web-chat",
   *     department: "support"
   *   }
   * });
   * console.log(`Created thread: ${thread.id}`);
   * ```
   */
  async createThread({
    threadId,
    resourceId,
    title,
    metadata,
    memoryConfig,
    saveThread = true,
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfig;
    saveThread?: boolean;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: threadId || this.generateId(),
      title: title || `New Thread ${new Date().toISOString()}`,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return saveThread ? this.saveThread({ thread, memoryConfig }) : thread;
  }

  /**
   * Deletes a thread and all associated messages.
   * This operation is permanent and cannot be undone.
   *
   * @param threadId - The ID of the thread to delete
   * @returns Promise that resolves when the thread is deleted
   *
   * @example
   * ```typescript
   * await memory.deleteThread("thread-123");
   * console.log("Thread and all messages deleted");
   * ```
   */
  abstract deleteThread(threadId: string): Promise<void>;

  /**
   * Helper method to add a single message to a thread.
   *
   * @param params - Parameters for adding a message
   * @param params.threadId - The thread to add the message to
   * @param params.resourceId - The resource ID associated with the message
   * @param params.config - Optional memory configuration
   * @param params.content - The message content (text or structured)
   * @param params.role - The role of the message sender ('user' or 'assistant')
   * @param params.type - The type of the message ('text', 'tool-call', or 'tool-result')
   * @param params.toolNames - Optional array of tool names that were called
   * @param params.toolCallArgs - Optional array of tool call arguments
   * @param params.toolCallIds - Optional array of tool call IDs
   * @returns Promise resolving to the saved message in v1 format
   *
   * @deprecated Use `saveMessages` instead for better flexibility and batch operations
   *
   * @example
   * ```typescript
   * // Deprecated - use saveMessages instead
   * const message = await memory.addMessage({
   *   threadId: "thread-123",
   *   resourceId: "user-456",
   *   content: "Hello, how can I help?",
   *   role: "assistant",
   *   type: "text"
   * });
   * ```
   */
  async addMessage({
    threadId,
    resourceId,
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
    resourceId: string;
    config?: MemoryConfig;
    content: UserContent | AssistantContent;
    role: 'user' | 'assistant';
    type: 'text' | 'tool-call' | 'tool-result';
    toolNames?: string[];
    toolCallArgs?: Record<string, unknown>[];
    toolCallIds?: string[];
  }): Promise<MastraMessageV1> {
    const message: MastraMessageV1 = {
      id: this.generateId(),
      content,
      role,
      createdAt: new Date(),
      threadId,
      resourceId,
      type,
      toolNames,
      toolCallArgs,
      toolCallIds,
    };

    const savedMessages = await this.saveMessages({ messages: [message], memoryConfig: config });
    const list = new MessageList({ threadId, resourceId }).add(savedMessages[0]!, 'memory');
    return list.get.all.v1()[0]!;
  }

  /**
   * Generates a unique identifier.
   * Uses the Mastra instance's ID generator if available, otherwise falls back to crypto.randomUUID.
   *
   * @returns A unique string ID
   *
   * @example
   * ```typescript
   * const messageId = memory.generateId();
   * console.log(messageId); // e.g., "550e8400-e29b-41d4-a716-446655440000"
   * ```
   */
  public generateId(): string {
    return this.#mastra?.generateId() || crypto.randomUUID();
  }

  /**
   * Retrieves the working memory content for a specific thread.
   * Working memory stores structured information about the conversation context.
   *
   * @param params - Parameters for retrieving working memory
   * @param params.threadId - The unique identifier of the thread
   * @param params.resourceId - Optional unique identifier of the resource
   * @param params.memoryConfig - Optional memory configuration to customize retrieval
   * @returns Promise resolving to working memory string or null if not found
   *
   * @example
   * ```typescript
   * const workingMemory = await memory.getWorkingMemory({
   *   threadId: "thread-123",
   *   resourceId: "user-456"
   * });
   * if (workingMemory) {
   *   console.log("Context:", workingMemory);
   * }
   * ```
   */
  abstract getWorkingMemory({
    threadId,
    resourceId,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null>;

  /**
   * Retrieves the working memory template configuration.
   * The template defines the structure for working memory content.
   *
   * @param params - Parameters for retrieving the template
   * @param params.memoryConfig - Optional memory configuration
   * @returns Promise resolving to working memory template or null if not configured
   *
   * @example
   * ```typescript
   * const template = await memory.getWorkingMemoryTemplate();
   * if (template) {
   *   console.log("Template structure:", template);
   * }
   * ```
   */
  abstract getWorkingMemoryTemplate({
    memoryConfig,
  }?: {
    memoryConfig?: MemoryConfig;
  }): Promise<WorkingMemoryTemplate | null>;

  /**
   * Updates the working memory for a specific thread.
   * Replaces the existing working memory content with new information.
   *
   * @param params - Parameters for updating working memory
   * @param params.threadId - The unique identifier of the thread
   * @param params.resourceId - Optional unique identifier of the resource
   * @param params.workingMemory - The new working memory content
   * @param params.memoryConfig - Optional argument to override the default memory configuration
   * @returns Promise that resolves when the working memory is updated
   *
   * @example
   * ```typescript
   * await memory.updateWorkingMemory({
   *   threadId: "thread-123",
   *   workingMemory: `
   *     User Information:
   *     - Name: John Doe
   *     - Location: San Francisco
   *     - Interests: AI, Machine Learning
   *   `
   * });
   * ```
   */
  abstract updateWorkingMemory({
    threadId,
    resourceId,
    workingMemory,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfig;
  }): Promise<void>;

  /**
   * Updates the working memory for a specific thread.
   * Replaces the existing working memory content with new information.
   *
   * @param params - Parameters for updating working memory
   * @param params.threadId - The unique identifier of the thread
   * @param params.resourceId - Optional unique identifier of the resource
   * @param params.workingMemory - The new working memory content
   * @param params.searchString - Optional string to search and replace a part of the working memory
   * @param params.memoryConfig - Optional argument to override the default memory configuration
   * @returns Promise that resolves when the working memory is updated
   * @experimental This API is experimental and may change or be removed in future versions
   *
   * @example
   * ```typescript
   * await memory.__experimental_updateWorkingMemoryVNext({
   *   threadId: "thread-123",
   *   workingMemory: `
   *     User Information:
   *     - Name: John Doe
   *     - Location: San Francisco
   *     - Interests: AI, Machine Learning
   *   `
   * });
   * ```
   */
  abstract __experimental_updateWorkingMemoryVNext({
    threadId,
    resourceId,
    workingMemory,
    searchString,
    memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<{ success: boolean; reason: string }>;

  /**
   * Deletes multiple messages by their IDs.
   *
   * @param messageIds - Array of message IDs to delete
   * @returns Promise that resolves when all messages are deleted
   *
   * @example
   * ```typescript
   * await memory.deleteMessages([
   *   "msg-123",
   *   "msg-124",
   *   "msg-125"
   * ]);
   * console.log("Messages deleted successfully");
   * ```
   */
  abstract deleteMessages(messageIds: string[]): Promise<void>;
}
