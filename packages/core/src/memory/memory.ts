import { existsSync } from 'fs';
import { join } from 'path';
import type {
  AssistantContent,
  ToolResultPart,
  UserContent,
  CoreToolMessage,
  ToolInvocation,
  CoreMessage,
  EmbeddingModel,
} from 'ai';

import { MastraBase } from '../base';
import type { MastraStorage, StorageGetMessagesArg } from '../storage';
import { DefaultProxyStorage } from '../storage/default-proxy-storage';
import { augmentWithInit } from '../storage/storageWithInit';
import type { CoreTool } from '../tools';
import { deepMerge } from '../utils';
import type { MastraVector } from '../vector';
import { defaultEmbedder } from '../vector/fastembed';
import { DefaultVectorDB } from '../vector/libsql';

import type { MessageType, SharedMemoryConfig, StorageThreadType, MemoryConfig, AiMessageType } from './types';

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

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  storage: MastraStorage;
  vector?: MastraVector;
  embedder?: EmbeddingModel<string>;
  private processors: MemoryProcessor[] = [];

  protected threadConfig: MemoryConfig = {
    lastMessages: 40,
    semanticRecall: true,
    threads: {
      generateTitle: true, // TODO: should we disable this by default to reduce latency?
    },
  };

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });

    if (config.options) {
      this.threadConfig = this.getMergedThreadConfig(config.options);
    }

    if (config.storage) {
      this.storage = config.storage;
    } else {
      this.storage = new DefaultProxyStorage({
        config: {
          url: 'file:memory.db',
        },
      });
    }

    this.storage = augmentWithInit(this.storage);

    const semanticRecallIsEnabled = this.threadConfig.semanticRecall !== false; // default is to have it enabled, so any value except false means it's on

    if (config.vector && semanticRecallIsEnabled) {
      this.vector = config.vector;
    } else if (
      // if there's no configured vector store
      // and the vector store hasn't been explicitly disabled with vector: false
      config.vector !== false &&
      // and semanticRecall is enabled
      semanticRecallIsEnabled
      // add the default vector store
    ) {
      // for backwards compat reasons, check if there's a memory-vector.db in cwd or in cwd/.mastra
      // if it's there we need to use it, otherwise use the same file:memory.db
      // We used to need two separate DBs because we would get schema errors
      // Creating a new index for each vector dimension size fixed that, so we no longer need a separate sqlite db
      const oldDb = 'memory-vector.db';
      const hasOldDb = existsSync(join(process.cwd(), oldDb)) || existsSync(join(process.cwd(), '.mastra', oldDb));
      const newDb = 'memory.db';

      if (hasOldDb) {
        this.logger.warn(
          `Found deprecated Memory vector db file ${oldDb} this db is now merged with the default ${newDb} file. Delete the old one to use the new one. You will need to migrate any data if that's important to you. For now the deprecated path will be used but in a future breaking change we will only use the new db file path.`,
        );
      }

      this.vector = new DefaultVectorDB({
        connectionUrl: hasOldDb ? `file:${oldDb}` : `file:${newDb}`,
      });
    }

    if (config.embedder) {
      this.embedder = config.embedder;
    } else if (
      // if there's no configured embedder
      // and there's a vector store
      typeof this.vector !== `undefined` &&
      // and semanticRecall is enabled
      semanticRecallIsEnabled
    ) {
      // add the default embedder
      this.embedder = defaultEmbedder('bge-small-en-v1.5'); // https://huggingface.co/BAAI/bge-small-en-v1.5#model-list we're using small 1.5 because it's much faster than base 1.5 and only scores slightly worse despite being roughly 100MB smaller - small is ~130MB while base is ~220MB
    }

    // Initialize processors if provided
    if (config.processors) {
      this.processors = config.processors;
    }
  }

  public setStorage(storage: MastraStorage) {
    this.storage = storage;
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
  public async getSystemMessage(_input: { threadId: string; memoryConfig?: MemoryConfig }): Promise<string | null> {
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
    const indexName = isDefault ? 'memory_messages' : `memory_messages_${usedDimensions}`;

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
    return deepMerge(this.threadConfig, config || {});
  }

  /**
   * Apply all configured message processors to a list of messages.
   * @param messages The messages to process
   * @returns The processed messages
   */
  private applyProcessors(
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
    systemMessage,
    config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    systemMessage?: CoreMessage;
    config?: MemoryConfig;
  }): Promise<{
    threadId: string;
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }>;

  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  protected parseMessages(messages: MessageType[]): CoreMessage[] {
    return messages.map(msg => {
      let content = msg.content;
      if (typeof content === 'string' && (content.startsWith('[') || content.startsWith('{'))) {
        try {
          content = JSON.parse(content);
        } catch {
          // Keep the original string if it's not valid JSON
        }
      } else if (typeof content === 'number') {
        content = String(content);
      }
      return {
        ...msg,
        content,
      };
    }) as CoreMessage[];
  }

  protected convertToUIMessages(messages: MessageType[]): AiMessageType[] {
    function addToolMessageToChat({
      toolMessage,
      messages,
      toolResultContents,
    }: {
      toolMessage: CoreToolMessage;
      messages: Array<AiMessageType>;
      toolResultContents: Array<ToolResultPart>;
    }): { chatMessages: Array<AiMessageType>; toolResultContents: Array<ToolResultPart> } {
      const chatMessages = messages.map(message => {
        if (message.toolInvocations) {
          return {
            ...message,
            toolInvocations: message.toolInvocations.map(toolInvocation => {
              const toolResult = toolMessage.content.find(tool => tool.toolCallId === toolInvocation.toolCallId);

              if (toolResult) {
                return {
                  ...toolInvocation,
                  state: 'result',
                  result: toolResult.result,
                };
              }

              return toolInvocation;
            }),
          };
        }

        return message;
      }) as Array<AiMessageType>;

      const resultContents = [...toolResultContents, ...toolMessage.content];

      return { chatMessages, toolResultContents: resultContents };
    }

    const { chatMessages } = messages.reduce(
      (obj: { chatMessages: Array<AiMessageType>; toolResultContents: Array<ToolResultPart> }, message) => {
        if (message.role === 'tool') {
          return addToolMessageToChat({
            toolMessage: message as CoreToolMessage,
            messages: obj.chatMessages,
            toolResultContents: obj.toolResultContents,
          });
        }

        let textContent = '';
        let toolInvocations: Array<ToolInvocation> = [];

        if (typeof message.content === 'string') {
          textContent = message.content;
        } else if (typeof message.content === 'number') {
          textContent = String(message.content);
        } else if (Array.isArray(message.content)) {
          for (const content of message.content) {
            if (content.type === 'text') {
              textContent += content.text;
            } else if (content.type === 'tool-call') {
              const toolResult = obj.toolResultContents.find(tool => tool.toolCallId === content.toolCallId);
              toolInvocations.push({
                state: toolResult ? 'result' : 'call',
                toolCallId: content.toolCallId,
                toolName: content.toolName,
                args: content.args,
                result: toolResult?.result,
              });
            }
          }
        }

        obj.chatMessages.push({
          id: (message as MessageType).id,
          role: message.role as AiMessageType['role'],
          content: textContent,
          toolInvocations,
          createdAt: message.createdAt,
        });

        return obj;
      },
      { chatMessages: [], toolResultContents: [] } as {
        chatMessages: Array<AiMessageType>;
        toolResultContents: Array<ToolResultPart>;
      },
    );

    return chatMessages;
  }

  /**
   * Retrieves a specific thread by its ID
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   */
  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  abstract getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]>;

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
  abstract saveMessages({
    messages,
    memoryConfig,
  }: {
    messages: MessageType[];
    memoryConfig: MemoryConfig | undefined;
  }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to array of messages and uiMessages
   */
  abstract query({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<{ messages: CoreMessage[]; uiMessages: AiMessageType[] }>;

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
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
    memoryConfig?: MemoryConfig;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: threadId || this.generateId(),
      title: title || `New Thread ${new Date().toISOString()}`,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return this.saveThread({ thread, memoryConfig });
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
  }): Promise<MessageType> {
    const message: MessageType = {
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
    return savedMessages[0]!;
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  public generateId(): string {
    return crypto.randomUUID();
  }
}
