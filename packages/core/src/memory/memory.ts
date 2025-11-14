import type { EmbeddingModelV2 } from '@ai-sdk/provider-v5';
import type { EmbeddingModel, AssistantContent, UserContent, CoreMessage } from '@internal/ai-sdk-v4';
import type { MastraDBMessage } from '../agent/message-list';
import { MastraBase } from '../base';
import { ModelRouterEmbeddingModel } from '../llm/model/index.js';
import type { Mastra } from '../mastra';
import type {
  MastraStorage,
  StorageListMessagesInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
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
  private processors: MemoryProcessor[] = [];
  protected threadConfig: MemoryConfig = { ...memoryDefaultOptions };
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
        `Memory requires a storage provider to function. Add a storage configuration to Memory or to your Mastra instance.\n\nhttps://mastra.ai/en/docs/memory/overview`,
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
    if (config?.workingMemory && 'use' in config.workingMemory) {
      throw new Error('The workingMemory.use option has been removed. Working memory always uses tool-call mode.');
    }

    if (config?.threads?.generateTitle !== undefined) {
      throw new Error(
        'The threads.generateTitle option has been moved. Use the top-level generateTitle option instead.',
      );
    }

    const mergedConfig = deepMerge(this.threadConfig, config || {});

    if (config?.workingMemory?.schema) {
      if (mergedConfig.workingMemory) {
        mergedConfig.workingMemory.schema = config.workingMemory.schema;
      }
    }

    return mergedConfig;
  }

  /**
   * Apply all configured message processors to a list of messages.
   * @param messages The messages to process
   * @returns The processed messages
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
   * Deletes multiple messages by their IDs
   * @param messageIds - Array of message IDs to delete
   * @returns Promise that resolves when all messages are deleted
   */
  abstract deleteMessages(messageIds: MessageDeleteInput): Promise<void>;
}
