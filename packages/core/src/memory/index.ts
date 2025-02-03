import {
  AssistantContent,
  ToolContent,
  ToolResultPart,
  UserContent,
  Message as AiMessage,
  CoreToolMessage,
  ToolInvocation,
  CoreMessage,
} from 'ai';

import { MastraBase } from '../base';
import { EmbeddingOptions } from '../embeddings';
import { MastraStorage, StorageGetMessagesArg } from '../storage';
import { MastraVector } from '../vector';

export type AiMessageType = AiMessage;

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: 'system' | 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

export type StorageThreadType = {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MessageType[];
  core_message: CoreMessage[];
}[T];

export type MemoryConfig = {
  lastMessages?: number | false;
  historySearch?:
    | boolean
    | {
        topK: number;
        messageRange: number | { before: number; after: number };
      };
  // TODO:
  // injectWorkingMemory?: boolean;
};

export type SharedMemoryConfig =
  | {
      storage: MastraStorage;
      options?: MemoryConfig;
      vector?: MastraVector;
      embeddingOptions?: EmbeddingOptions;
    }
  | {
      storage: MastraStorage;
      options?: MemoryConfig;
      vector: MastraVector;
      embeddingOptions: EmbeddingOptions;
    };

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  storage: MastraStorage;
  vector?: MastraVector;
  embeddingOptions?: EmbeddingOptions;

  protected threadConfig: MemoryConfig = {
    lastMessages: 40,
    historySearch: false, // becomes true by default if a vector store is attached
    // TODO:
    // injectWorkingMemory: true
  };

  constructor(config: { name: string } & SharedMemoryConfig) {
    super({ component: 'MEMORY', name: config.name });
    this.storage = config.storage;
    if (config.vector) {
      this.vector = config.vector;
      this.threadConfig.historySearch = true;
    }
    if (`embeddingOptions` in config) {
      this.embeddingOptions = config.embeddingOptions;
    }
    if (config.options) {
      this.threadConfig = this.getMergedThreadConfig(config.options);
    }
  }

  protected parseEmbeddingOptions() {
    if (!this.embeddingOptions) {
      throw new Error(`Cannot use vector features without setting new Memory({ embeddingOptions: { ... } })`);
    }

    return this.embeddingOptions;
  }

  protected getMergedThreadConfig(config: MemoryConfig): MemoryConfig {
    return {
      ...this.threadConfig,
      ...config,
    };
  }

  abstract rememberMessages({
    threadId,
    vectorMessageSearch,
    config,
  }: {
    threadId: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{
    messages: CoreMessage[];
    uiMessages: AiMessageType[];
  }>;

  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  protected parseMessages(messages: MessageType[]): CoreMessage[] {
    return messages.map(msg => ({
      ...msg,
      content:
        typeof msg.content === 'string' && (msg.content.startsWith('[') || msg.content.startsWith('{'))
          ? JSON.parse((msg as MessageType).content as string)
          : msg.content,
    }));
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
  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

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
  abstract getMessages({
    threadId,
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
  }: {
    resourceId: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread: StorageThreadType = {
      id: threadId || this.generateId(),
      title,
      resourceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return this.saveThread({ thread });
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
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
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
