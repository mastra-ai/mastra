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

export type AiMessageType = AiMessage;

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId: string;
  toolCallIds?: string[];
  toolCallArgs?: Record<string, unknown>[];
  toolNames?: string[];
  type: 'text' | 'tool-call' | 'tool-result';
};

export type ThreadType = {
  id: string;
  title?: string;
  resourceid: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
};

export type MessageResponse<T extends 'raw' | 'core_message'> = {
  raw: MessageType[];
  core_message: CoreMessage[];
}[T];

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory extends MastraBase {
  MAX_CONTEXT_TOKENS?: number;

  constructor() {
    super({ component: 'MEMORY', name: 'MastraMemory' });
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.split(' ').length * 1.3);
  }

  parseMessages(messages: MessageType[]): MessageType[] {
    return messages.map(mssg => ({
      ...mssg,
      content: typeof mssg.content === 'string' ? JSON.parse((mssg as MessageType).content as string) : mssg.content,
    }));
  }

  convertToUIMessages(messages: MessageType[]): AiMessageType[] {
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
          id: message.id,
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
  abstract getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null>;

  abstract getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]>;
  /**
   * Saves or updates a thread
   * @param thread - The thread data to save
   * @returns Promise resolving to the saved thread
   */
  abstract saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType>;

  /**
   * Saves messages to a thread
   * @param messages - Array of messages to save
   * @returns Promise resolving to the saved messages
   */
  abstract saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to array of messages and uiMessages
   */
  abstract getMessages({
    threadId,
  }: {
    threadId: string;
  }): Promise<{ messages: MessageType[]; uiMessages: AiMessageType[] }>;

  /**
   * Retrieves all messages for a specific thread within a context window
   * @param threadId - The unique identifier of the thread
   * @param startDate - Optional start date to filter the context window
   * @param endDate - Optional end date to filter the context window
   * @returns Promise resolving to an array of messages
   */
  abstract getContextWindow<T extends 'raw' | 'core_message'>({
    threadId,
    startDate,
    endDate,
    format,
  }: {
    threadId: string;
    startDate?: Date;
    endDate?: Date;
    format?: T;
  }): Promise<MessageResponse<T>>;

  /**
   * Retrieves cached tool result for a specific arg in a thread
   * @param threadId - The unique identifier of the thread
   * @param toolArgs - The tool arguments to retrieve the cached result for
   * @param toolName - The name of the tool that was called
   * @returns Promise resolving to the cached tool result or null if not found
   */
  abstract getToolResult({
    threadId,
    toolArgs,
    toolName,
  }: {
    threadId: string;
    toolArgs: Record<string, unknown>;
    toolName: string;
  }): Promise<ToolResultPart['result'] | null>;

  /**
   * Checks if an un-expired tool call arg exists in a thread
   * @param hashedArgs - The hashed tool call information (args, threadId, toolName) to check for
   * @returns Promise resolving to true if the un-expired tool call arg exists, false otherwise
   */
  abstract validateToolCallArgs({ hashedArgs }: { hashedArgs: string }): Promise<boolean>;

  /**
   * Helper method to create a new thread
   * @param title - Optional title for the thread
   * @param metadata - Optional metadata for the thread
   * @returns Promise resolving to the created thread
   */
  async createThread({
    threadId,
    resourceid,
    title,
    metadata,
  }: {
    resourceid: string;
    threadId?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ThreadType> {
    const thread: ThreadType = {
      id: threadId || this.generateId(),
      title,
      resourceid,
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
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
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

    const savedMessages = await this.saveMessages({ messages: [message] });
    return savedMessages[0]!;
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  generateId(): string {
    return crypto.randomUUID();
  }
}
