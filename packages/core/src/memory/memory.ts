import type { AssistantContent, UserContent, CoreMessage, EmbeddingModel } from 'ai';

import { MessageList } from '../agent/message-list';
import type { MastraMessageV2, UIMessageWithMetadata } from '../agent/message-list';
import { MastraBase } from '../base';
import type { Mastra } from '../mastra';
import type { MastraStorage, PaginationInfo, StorageGetMessagesArg, ThreadSortOptions } from '../storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { CoreTool } from '../tools';
import { deepMerge } from '../utils';
import type { MastraVector } from '../vector';

import type {
  SharedMemoryConfig,
  StorageThreadType,
  MemoryConfig,
  MastraMessageV1,
  WorkingMemoryTemplate,
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
  process(messages: CoreMessage[], _opts: MemoryProcessorOpts): CoreMessage[] {
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
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  protected _storage?: MastraStorage;
  vector?: MastraVector;
  embedder?: EmbeddingModel<string>;
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
  public getTools(_config?: MemoryConfig): Record<string, CoreTool> {
    return {};
  }

  protected async createEmbeddingIndex(dimensions?: number): Promise<{ indexName: string }> {
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
    await this.vector.createIndex({
      indexName,
      dimension: usedDimensions,
    });
    return { indexName };
  }

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

    return mergedConfig;
  }

  /**
   * Apply all configured message processors to a list of messages.
   * @param messages The messages to process
   * @returns The processed messages
   */
  protected applyProcessors(
    messages: CoreMessage[],
    opts: {
      processors?: MemoryProcessor[];
    } & MemoryProcessorOpts,
  ): CoreMessage[] {
    const processors = opts.processors || this.processors;
    if (!processors || processors.length === 0) {
      return messages;
    }

    let processedMessages = [...messages];

    for (const processor of processors) {
      processedMessages = processor.process(processedMessages, {
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
   * @returns Promise resolving to array of messages and uiMessages
   */
  abstract query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: UIMessageWithMetadata[] }>;

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
   * Deletes multiple messages by their IDs
   * @param messageIds - Array of message IDs to delete
   * @returns Promise that resolves when all messages are deleted
   */
  abstract deleteMessages(messageIds: string[]): Promise<void>;
}
