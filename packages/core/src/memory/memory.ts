import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { AssistantContent, UserContent, CoreMessage, EmbeddingModel } from 'ai';
import { MessageList } from '../agent/message-list';
import type { MastraMessageV2, UIMessageWithMetadata } from '../agent/message-list';
import { MastraBase } from '../base';
import { MastraError } from '../error';
import { ModelRouterEmbeddingModel } from '../llm/model/index.js';
import type { Mastra } from '../mastra';
import type { InputProcessor, OutputProcessor } from '../processors';
import { MessageHistory, SemanticRecall, WorkingMemory } from '../processors/processors';
import type { RequestContext } from '../request-context';
import type {
  MastraStorage,
  PaginationInfo,
  StorageGetMessagesArg,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  ThreadSortOptions,
} from '../storage';
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
  MessageDeleteInput,
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
  MAX_CONTEXT_TOKENS?: number;

  protected _storage?: MastraStorage;
  vector?: MastraVector;
  embedder?: EmbeddingModel<string> | EmbeddingModelV2<string>;
  protected threadConfig: MemoryConfig = { ...memoryDefaultOptions };
  #mastra?: Mastra;

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });

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

  public setEmbedder(embedder: EmbeddingModel<string>) {
    this.embedder = embedder;
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

  /**
   * Apply all configured message processors to a list of messages.
   * @param messages The messages to process
   * @returns The processed messages
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
   * Retrieves all threads that belong to the specified resource.
   * @param resourceId - The unique identifier of the resource
   * @param orderBy - Which timestamp field to sort by (`'createdAt'` or `'updatedAt'`);
   *                  defaults to `'createdAt'`
   * @param sortDirection - Sort order for the results (`'ASC'` or `'DESC'`);
   *                        defaults to `'DESC'`
   * @returns Promise resolving to an array of matching threads; resolves to an empty array
   *          if the resource has no threads
   */
  abstract getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]>;

  abstract getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }>;

  abstract listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput>;

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
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to array of messages, uiMessages, and messagesV2
   */
  abstract query({ threadId, resourceId, selectBy }: StorageGetMessagesArg): Promise<{
    messages: CoreMessage[];
    uiMessages: UIMessageWithMetadata[];
    messagesV2: MastraMessageV2[];
  }>;

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
   * Retrieves working memory template for a specific thread
   * @param memoryConfig - Optional memory configuration
   * @returns Promise resolving to working memory template or null if not found
   */
  abstract getWorkingMemoryTemplate({
    memoryConfig,
  }?: {
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
   * Get input processors for this memory instance.
   * This allows Memory to be used as a ProcessorProvider in Agent's inputProcessors array.
   * @param configuredProcessors - Processors already configured by the user (for deduplication)
   * @param context - Optional execution context with threadId and resourceId
   * @returns Array of input processors configured for this memory instance
   */
  getInputProcessors(configuredProcessors: InputProcessor[] = [], _context?: RequestContext): InputProcessor[] {
    const processors: InputProcessor[] = [];

    // Add semantic recall processor if configured
    if (this.threadConfig.semanticRecall && this.vector && this.embedder) {
      if (!this.storage?.stores?.memory)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'SEMANTIC_RECALL_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a storage adapter but no attached adapter was detected.',
        });

      const semanticConfig =
        typeof this.threadConfig.semanticRecall === 'boolean'
          ? {
              topK: undefined,
              messageRange: undefined,
              scope: undefined,
              threshold: undefined,
              indexName: undefined,
            }
          : this.threadConfig.semanticRecall;

      // Check if user already manually added SemanticRecall
      const hasSemanticRecall = configuredProcessors.some(p => p.constructor.name === 'SemanticRecall');

      if (!hasSemanticRecall) {
        processors.push(
          new SemanticRecall({
            storage: this.storage.stores.memory,
            vector: this.vector,
            embedder: this.embedder,
            topK: semanticConfig.topK,
            messageRange: semanticConfig.messageRange,
            scope: semanticConfig.scope,
            threshold: semanticConfig.threshold,
            indexName: semanticConfig.indexName,
          }),
        );
      }
    }

    // Add working memory input processor if configured
    const isWorkingMemoryEnabled =
      typeof this.threadConfig.workingMemory === 'object' && this.threadConfig.workingMemory.enabled !== false;

    if (isWorkingMemoryEnabled) {
      if (!this.storage?.stores?.memory)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'WORKING_MEMORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory working memory requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added WorkingMemory
      const hasWorkingMemory = configuredProcessors.some(p => p.constructor.name === 'WorkingMemory');

      if (!hasWorkingMemory) {
        // Convert string template to WorkingMemoryTemplate format
        let template: { format: 'markdown' | 'json'; content: string } | undefined;
        if (typeof this.threadConfig.workingMemory === 'object' && this.threadConfig.workingMemory.template) {
          template = {
            format: 'markdown',
            content: this.threadConfig.workingMemory.template,
          };
        }

        processors.push(
          new WorkingMemory({
            storage: this.storage.stores.memory,
            template,
            scope:
              typeof this.threadConfig.workingMemory === 'object' ? this.threadConfig.workingMemory.scope : undefined,
            useVNext:
              typeof this.threadConfig.workingMemory === 'object' &&
              'version' in this.threadConfig.workingMemory &&
              this.threadConfig.workingMemory.version === 'vnext',
          }),
        );
      }
    }

    const lastMessages = this.threadConfig.lastMessages;
    if (lastMessages) {
      if (!this.storage?.stores?.memory)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'MESSAGE_HISTORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory message history requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added MessageHistory
      const hasMessageHistory = configuredProcessors.some(p => p.constructor.name === 'MessageHistory');

      if (!hasMessageHistory) {
        processors.push(
          new MessageHistory({
            storage: this.storage.stores.memory,
            lastMessages: typeof lastMessages === 'number' ? lastMessages : undefined,
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
   */
  getOutputProcessors(configuredProcessors: OutputProcessor[] = []): OutputProcessor[] {
    const processors: OutputProcessor[] = [];

    const lastMessages = this.threadConfig.lastMessages;
    if (lastMessages) {
      if (!this.storage?.stores?.memory)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'MESSAGE_HISTORY_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory message history requires a storage adapter but no attached adapter was detected.',
        });

      // Check if user already manually added MessageHistory
      const hasMessageHistory = configuredProcessors.some(p => p.constructor.name === 'MessageHistory');

      if (!hasMessageHistory) {
        processors.push(
          new MessageHistory({
            storage: this.storage.stores.memory,
            lastMessages: typeof lastMessages === 'number' ? lastMessages : undefined,
          }),
        );
      }
    }

    // Add SemanticRecall output processor if configured
    if (this.threadConfig.semanticRecall) {
      if (!this.storage?.stores?.memory)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'SEMANTIC_RECALL_MISSING_STORAGE_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a storage adapter but no attached adapter was detected.',
        });

      if (!this.vector)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'SEMANTIC_RECALL_MISSING_VECTOR_ADAPTER',
          text: 'Using Mastra Memory semantic recall requires a vector adapter but no attached adapter was detected.',
        });

      if (!this.embedder)
        throw new MastraError({
          category: 'USER',
          domain: 'MASTRA_MEMORY',
          id: 'SEMANTIC_RECALL_MISSING_EMBEDDER',
          text: 'Using Mastra Memory semantic recall requires an embedder but no attached embedder was detected.',
        });

      // Check if user already manually added SemanticRecall
      const hasSemanticRecall = configuredProcessors.some(p => p.constructor.name === 'SemanticRecall');

      if (!hasSemanticRecall) {
        const semanticRecallConfig =
          typeof this.threadConfig.semanticRecall === 'object' ? this.threadConfig.semanticRecall : {};
        processors.push(
          new SemanticRecall({
            storage: this.storage.stores.memory,
            vector: this.vector,
            embedder: this.embedder,
            ...semanticRecallConfig,
          }),
        );
      }
    }

    // TODO: Add working memory output processor when implemented
    // if (this.threadConfig.workingMemory) {
    //   processors.push(new WorkingMemoryProcessor({
    //     storage: this.storage.memory,
    //     ...this.threadConfig.workingMemory
    //   }));
    // }

    // Return only the auto-generated processors (not the configured ones)
    // The agent will merge them with configuredProcessors
    return processors;
  }

  abstract deleteMessages(messageIds: MessageDeleteInput): Promise<void>;
}
