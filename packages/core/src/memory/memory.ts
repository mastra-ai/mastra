import type { AssistantContent, UserContent, CoreMessage } from '@internal/ai-sdk-v4';
import type { MastraDBMessage } from '../agent/message-list';
import { MastraBase } from '../base';
import { ErrorDomain, MastraError } from '../error';
import { ModelRouterEmbeddingModel } from '../llm/model';
import type { EmbeddingModelId } from '../llm/model';
import type { Mastra } from '../mastra';
import type {
  InputProcessor,
  OutputProcessor,
  InputProcessorOrWorkflow,
  OutputProcessorOrWorkflow,
} from '../processors';
import { isProcessorWorkflow } from '../processors';
import { MessageHistory, WorkingMemory, SemanticRecall } from '../processors/memory';
import type { RequestContext } from '../request-context';
import type {
  MastraStorage,
  StorageListMessagesInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
} from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { ToolAction } from '../tools';
import { deepMerge } from '../utils';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';

import type {
  SharedMemoryConfig,
  StorageThreadType,
  MemoryConfig,
  MastraMessageV1,
  WorkingMemoryTemplate,
  MessageDeleteInput,
  MemoryRequestContext,
} from './types';

export type MemoryProcessorOpts = {
  systemMessage?: string;
  memorySystemMessage?: string;
  newMessages?: CoreMessage[];
};
/**
 * Interface for message processors that can filter or transform messages
 * before they're sent to the LLM.
 */
export abstract class MemoryProcessor extends MastraBase {
  /**
   * Process a list of messages and return a filtered or transformed list.
   * @param messages The messages to process
   * @returns The processed messages
   */
  process(messages: CoreMessage[], _opts: MemoryProcessorOpts): CoreMessage[] | Promise<CoreMessage[]> {
    return messages;
  }
}

export const memoryDefaultOptions = {
  lastMessages: 10,
  semanticRecall: false,
  generateTitle: false,
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
  /**
   * Unique identifier for the memory instance.
   * If not provided, defaults to a static name 'default-memory'.
   */
  readonly id: string;

  MAX_CONTEXT_TOKENS?: number;

  protected _storage?: MastraStorage;
  vector?: MastraVector;
  embedder?: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  protected threadConfig: MemoryConfig = { ...memoryDefaultOptions };
  #mastra?: Mastra;

  constructor(config: { id?: string; name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });
    this.id = config.id ?? config.name ?? 'default-memory';

    if (config.options) this.threadConfig = this.getMergedThreadConfig(config.options);

    // DEPRECATION: Block old processors config
    if (config.processors) {
      throw new Error(
        `The 'processors' option in Memory is deprecated and has been removed.
      
Please use the new Input/Output processor system instead:

OLD (deprecated):
  new Memory({
    processors: [new TokenLimiter(100000)]
  })

NEW (use this):
  new Agent({
    memory,
    outputProcessors: [
      new TokenLimiterProcessor(100000)
    ]
  })

Or pass memory directly to processor arrays:
  new Agent({
    inputProcessors: [memory],
    outputProcessors: [memory]
  })

See: https://mastra.ai/en/docs/memory/processors`,
      );
    }
    if (config.storage) {
      this._storage = augmentWithInit(config.storage);
      this._hasOwnStorage = true;
    }

    if (this.threadConfig.semanticRecall) {
      if (!config.vector) {
        throw new Error(
          `Semantic recall requires a vector store to be configured.

https://mastra.ai/en/docs/memory/semantic-recall`,
        );
      }
      this.vector = config.vector;

      if (!config.embedder) {
        throw new Error(
          `Semantic recall requires an embedder to be configured.

https://mastra.ai/en/docs/memory/semantic-recall`,
        );
      }

      // Convert string embedder to ModelRouterEmbeddingModel
      if (typeof config.embedder === 'string') {
        this.embedder = new ModelRouterEmbeddingModel(config.embedder);
      } else {
        this.embedder = config.embedder;
      }

      // Set embedder options (e.g., providerOptions for Google models)
      if (config.embedderOptions) {
        this.embedderOptions = config.embedderOptions;
      }
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

  protected _hasOwnStorage = false;
  get hasOwnStorage() {
    return this._hasOwnStorage;
  }

  get storage() {
    if (!this._storage) {
      throw new Error(
        `Memory requires a storage provider to function. Add a storage configuration to Memory or to your Mastra instance.

https://mastra.ai/en/docs/memory/overview`,
      );
    }
    return this._storage;
  }

  public setStorage(storage: MastraStorage) {
    this._storage = augmentWithInit(storage);
  }

  public setVector(vector: MastraVector) {
    this.vector = vector;
  }

  public setEmbedder(
    embedder: EmbeddingModelId | MastraEmbeddingModel<string>,
    embedderOptions?: MastraEmbeddingOptions,
  ) {
    if (typeof embedder === 'string') {
      this.embedder = new ModelRouterEmbeddingModel(embedder);
    } else {
      this.embedder = embedder;
    }
    if (embedderOptions) {
      this.embedderOptions = embedderOptions;
    }
  }

  /**
   * Get a system message to inject into the conversation.
   * This will be called before each conversation turn.
   * Implementations can override this to inject custom system messages.
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
   */
  public listTools(_config?: MemoryConfig): Record<string, ToolAction<any, any, any>> {
    return {};
  }

  /**
   * Get the index name for semantic recall embeddings.
   * This is used to ensure consistency between the Memory class and SemanticRecall processor.
   */
  protected getEmbeddingIndexName(dimensions?: number): string {
    const defaultDimensions = 1536;
    const usedDimensions = dimensions ?? defaultDimensions;
    const isDefault = usedDimensions === defaultDimensions;
    const separator = this.vector?.indexSeparator ?? '_';
    return isDefault ? `memory${separator}messages` : `memory${separator}messages${separator}${usedDimensions}`;
  }

  protected async createEmbeddingIndex(dimensions?: number, config?: MemoryConfig): Promise<{ indexName: string }> {
    const defaultDimensions = 1536;
    const usedDimensions = dimensions ?? defaultDimensions;
    const indexName = this.getEmbeddingIndexName(dimensions);

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

  public getMergedThreadConfig(config?: MemoryConfig): MemoryConfig {
    if (config?.workingMemory && typeof config.workingMemory === 'object' && 'use' in config.workingMemory) {
      throw new Error('The workingMemory.use option has been removed. Working memory always uses tool-call mode.');
    }

    if (config?.threads?.generateTitle !== undefined) {
      throw new Error(
        'The threads.generateTitle option has been moved. Use the top-level generateTitle option instead.',
      );
    }

    const mergedConfig = deepMerge(this.threadConfig, config || {});

    if (
      typeof config?.workingMemory === 'object' &&
      config.workingMemory?.schema &&
      typeof mergedConfig.workingMemory === 'object'
    ) {
      mergedConfig.workingMemory.schema = config.workingMemory.schema;
    }

    return mergedConfig;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  /**
   * Retrieves a specific thread by its ID
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   */
  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  /**
   * Lists all threads that belong to the specified resource.
   * @param args.resourceId - The unique identifier of the resource
   * @param args.offset - The number of threads to skip (for pagination)
   * @param args.limit - The maximum number of threads to return
   * @param args.orderBy - Optional sorting configuration with `field` (`'createdAt'` or `'updatedAt'`)
   *                       and `direction` (`'ASC'` or `'DESC'`);
   *                       defaults to `{ field: 'createdAt', direction: 'DESC' }`
   * @returns Promise resolving to paginated thread results with metadata;
   *          resolves to an empty array if the resource has no threads
   */
  abstract listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput>;

  /**
   * Lists threads with optional filtering by resourceId and metadata.
   * This is a more flexible alternative to listThreadsByResourceId that supports:
   * - Optional resourceId filtering (not required)
   * - Metadata filtering with AND logic (all key-value pairs must match)
   * - Same pagination and ordering options as listThreadsByResourceId
   *
   * @param args.filter - Optional filters for resourceId and/or metadata
   * @param args.filter.resourceId - Optional resource ID to filter by
   * @param args.filter.metadata - Optional metadata key-value pairs to filter by (AND logic)
   * @param args.page - Zero-indexed page number for pagination (defaults to 0)
   * @param args.perPage - Number of items per page, or false to fetch all (defaults to 100)
   * @param args.orderBy - Optional sorting configuration with `field` and `direction`
   * @returns Promise resolving to paginated thread results with metadata
   *
   * @example
   * ```typescript
   * // Filter by resourceId only
   * await memory.listThreads({ filter: { resourceId: 'user-123' } });
   *
   * // Filter by metadata only
   * await memory.listThreads({ filter: { metadata: { category: 'support' } } });
   *
   * // Filter by both
   * await memory.listThreads({
   *   filter: {
   *     resourceId: 'user-123',
   *     metadata: { priority: 'high', status: 'open' }
   *   }
   * });
   * ```
   */
  abstract listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput>;

  /**
   * Saves or updates a thread
   * @param thread - The thread data to save
   * @returns Promise resolving to the saved thread
   */
  abstract saveThread({
    thread,
    memoryConfig,
  }: {
    thread: StorageThreadType;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType>;

  /**
   * Saves messages to a thread
   * @param messages - Array of messages to save
   * @returns Promise resolving to the saved messages
   */
  abstract saveMessages(args: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig | undefined;
  }): Promise<{ messages: MastraDBMessage[] }>;

  /**
   * Retrieves messages for a specific thread with optional semantic recall
   * @param threadId - The unique identifier of the thread
   * @param resourceId - Optional resource ID for validation
   * @param vectorSearchString - Optional search string for semantic recall
   * @param config - Optional memory configuration
   * @returns Promise resolving to array of messages in mastra-db format
   */
  abstract recall(
    args: StorageListMessagesInput & {
      threadConfig?: MemoryConfig;
      vectorSearchString?: string;
    },
  ): Promise<{ messages: MastraDBMessage[] }>;

  /**
   * Helper method to create a new thread
   * @param title - Optional title for the thread
   * @param metadata - Optional metadata for the thread
   * @returns Promise resolving to the created thread
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
   * Helper method to delete a thread
   * @param threadId - the id of the thread to delete
   */
  abstract deleteThread(threadId: string): Promise<void>;

  /**
   * Helper method to add a single message to a thread
   * @param threadId - The thread to add the message to
   * @param content - The message content
   * @param role - The role of the message sender
   * @param type - The type of the message
   * @param toolNames - Optional array of tool names that were called
   * @param toolCallArgs - Optional array of tool call arguments
   * @param toolCallIds - Optional array of tool call ids
   * @returns Promise resolving to the saved message
   * @deprecated use saveMessages instead
   */
  async addMessage(_params: {
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
    throw new Error('addMessage is deprecated. Please use saveMessages instead.');
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  public generateId(): string {
    return this.#mastra?.generateId() || crypto.randomUUID();
  }

  /**
   * Retrieves working memory for a specific thread
   * @param threadId - The unique identifier of the thread
   * @param resourceId - The unique identifier of the resource
   * @param memoryConfig - Optional memory configuration
   * @returns Promise resolving to working memory data or null if not found
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
   * Get working memory template
   * @param threadId - Thread ID
   * @param resourceId - Resource ID
   * @returns Promise resolving to working memory template or null if not found
   */
  abstract getWorkingMemoryTemplate({
    memoryConfig,
  }: {
    memoryConfig?: MemoryConfig;
  }): Promise<WorkingMemoryTemplate | null>;

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
   * @warning experimental! can be removed or changed at any time
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
   * Get input processors for this memory instance
   * This allows Memory to be used as a ProcessorProvider in Agent's inputProcessors array.
   * @param configuredProcessors - Processors already configured by the user (for deduplication)
   * @returns Array of input processors configured for this memory instance
   */
  async getInputProcessors(
    configuredProcessors: InputProcessorOrWorkflow[] = [],
    context?: RequestContext,
  ): Promise<InputProcessor[]> {
    const memoryStore = await this.storage.getStore('memory');
    const processors: InputProcessor[] = [];

    // Extract runtime memoryConfig from context if available
    const memoryContext = context?.get('MastraMemory') as MemoryRequestContext | undefined;
    const runtimeMemoryConfig = memoryContext?.memoryConfig;
    const effectiveConfig = runtimeMemoryConfig ? this.getMergedThreadConfig(runtimeMemoryConfig) : this.threadConfig;

    // Add working memory input processor if configured
    const isWorkingMemoryEnabled =
      typeof effectiveConfig.workingMemory === 'object' && effectiveConfig.workingMemory.enabled !== false;

    if (isWorkingMemoryEnabled) {
      if (!memoryStore)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.STORAGE,
          id: 'WORKING_MEMORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory working memory requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added WorkingMemory
      const hasWorkingMemory = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'working-memory');

      if (!hasWorkingMemory) {
        // Convert string template to WorkingMemoryTemplate format
        let template: { format: 'markdown' | 'json'; content: string } | undefined;
        if (typeof effectiveConfig.workingMemory === 'object' && effectiveConfig.workingMemory.template) {
          template = {
            format: 'markdown',
            content: effectiveConfig.workingMemory.template,
          };
        }

        processors.push(
          new WorkingMemory({
            storage: memoryStore,
            template,
            scope: typeof effectiveConfig.workingMemory === 'object' ? effectiveConfig.workingMemory.scope : undefined,
            useVNext:
              typeof effectiveConfig.workingMemory === 'object' &&
              'version' in effectiveConfig.workingMemory &&
              effectiveConfig.workingMemory.version === 'vnext',
            templateProvider: this,
          }),
        );
      }
    }

    const lastMessages = effectiveConfig.lastMessages;
    if (lastMessages) {
      if (!memoryStore)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.STORAGE,
          id: 'MESSAGE_HISTORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory message history requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added MessageHistory
      const hasMessageHistory = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'message-history');

      if (!hasMessageHistory) {
        processors.push(
          new MessageHistory({
            storage: memoryStore,
            lastMessages: typeof lastMessages === 'number' ? lastMessages : undefined,
          }),
        );
      }
    }

    // Add semantic recall input processor if configured
    if (effectiveConfig.semanticRecall) {
      if (!memoryStore)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.STORAGE,
          id: 'SEMANTIC_RECALL_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a storage adapter but no attached adapter was detected.',
        });

      if (!this.vector)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.MASTRA_VECTOR,
          id: 'SEMANTIC_RECALL_MISSING_VECTOR_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a vector adapter but no attached adapter was detected.',
        });

      if (!this.embedder)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.MASTRA_VECTOR,
          id: 'SEMANTIC_RECALL_MISSING_EMBEDDER',
          text: 'Using Mastra Memory semantic recall requires an embedder but no attached embedder was detected.',
        });

      // Check if user already manually added SemanticRecall
      const hasSemanticRecall = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'semantic-recall');

      if (!hasSemanticRecall) {
        const semanticConfig = typeof effectiveConfig.semanticRecall === 'object' ? effectiveConfig.semanticRecall : {};

        // Use the Memory class's index name for consistency with memory.recall()
        const indexName = this.getEmbeddingIndexName();

        processors.push(
          new SemanticRecall({
            storage: memoryStore,
            vector: this.vector,
            embedder: this.embedder,
            embedderOptions: this.embedderOptions,
            indexName,
            ...semanticConfig,
          }),
        );
      }
    }

    // Return only the auto-generated processors (not the configured ones)
    // The agent will merge them with configuredProcessors
    return processors;
  }

  /**
   * Get output processors for this memory instance
   * This allows Memory to be used as a ProcessorProvider in Agent's outputProcessors array.
   * @param configuredProcessors - Processors already configured by the user (for deduplication)
   * @returns Array of output processors configured for this memory instance
   *
   * Note: We intentionally do NOT check readOnly here. The readOnly check happens at execution time
   * in each processor's processOutputResult method. This allows proper isolation when agents share
   * a RequestContext - each agent's readOnly setting is respected when its processors actually run,
   * not when processors are resolved (which may happen before the agent sets its MastraMemory context).
   * See: https://github.com/mastra-ai/mastra/issues/11651
   */
  async getOutputProcessors(
    configuredProcessors: OutputProcessorOrWorkflow[] = [],
    context?: RequestContext,
  ): Promise<OutputProcessor[]> {
    const memoryStore = await this.storage.getStore('memory');
    const processors: OutputProcessor[] = [];

    // Extract runtime memoryConfig from context if available
    const memoryContext = context?.get('MastraMemory') as MemoryRequestContext | undefined;
    const runtimeMemoryConfig = memoryContext?.memoryConfig;
    const effectiveConfig = runtimeMemoryConfig ? this.getMergedThreadConfig(runtimeMemoryConfig) : this.threadConfig;

    // Add SemanticRecall output processor if configured
    if (effectiveConfig.semanticRecall) {
      if (!memoryStore)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.STORAGE,
          id: 'SEMANTIC_RECALL_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a storage adapter but no attached adapter was detected.',
        });

      if (!this.vector)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.MASTRA_VECTOR,
          id: 'SEMANTIC_RECALL_MISSING_VECTOR_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a vector adapter but no attached adapter was detected.',
        });

      if (!this.embedder)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.MASTRA_VECTOR,
          id: 'SEMANTIC_RECALL_MISSING_EMBEDDER',
          text: 'Using Mastra Memory semantic recall requires an embedder but no attached embedder was detected.',
        });

      // Check if user already manually added SemanticRecall
      const hasSemanticRecall = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'semantic-recall');

      if (!hasSemanticRecall) {
        const semanticRecallConfig =
          typeof effectiveConfig.semanticRecall === 'object' ? effectiveConfig.semanticRecall : {};

        // Use the Memory class's index name for consistency with memory.recall()
        const indexName = this.getEmbeddingIndexName();

        processors.push(
          new SemanticRecall({
            storage: memoryStore,
            vector: this.vector,
            embedder: this.embedder,
            embedderOptions: this.embedderOptions,
            indexName,
            ...semanticRecallConfig,
          }),
        );
      }
    }

    const lastMessages = effectiveConfig.lastMessages;
    if (lastMessages) {
      if (!memoryStore)
        throw new MastraError({
          category: 'USER',
          domain: ErrorDomain.STORAGE,
          id: 'MESSAGE_HISTORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory message history requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added MessageHistory
      const hasMessageHistory = configuredProcessors.some(p => !isProcessorWorkflow(p) && p.id === 'message-history');

      if (!hasMessageHistory) {
        processors.push(
          new MessageHistory({
            storage: memoryStore,
            lastMessages: typeof lastMessages === 'number' ? lastMessages : undefined,
          }),
        );
      }
    }

    // Return only the auto-generated processors (not the configured ones)
    // The agent will merge them with configuredProcessors
    return processors;
  }

  abstract deleteMessages(messageIds: MessageDeleteInput): Promise<void>;

  /**
   * Clones a thread with all its messages to a new thread
   * @param args - Clone parameters including source thread ID and optional filtering options
   * @returns Promise resolving to the cloned thread and copied messages
   */
  abstract cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput>;
}
