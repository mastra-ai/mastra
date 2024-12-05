import { AssistantContent, ToolContent, ToolResultPart, UserContent } from 'ai';

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

/**
 * Abstract Memory class that defines the interface for storing and retrieving
 * conversation threads and messages.
 */
export abstract class MastraMemory {
  /**
   * Retrieves a specific thread by its ID
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to the thread or null if not found
   */
  abstract getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<ThreadType | null>;

  abstract getThreadsByResourceId({
    resourceid,
  }: {
    resourceid: string;
  }): Promise<ThreadType[]>;
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
  abstract saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to an array of messages
   */
  abstract getMessages({
    threadId,
  }: {
    threadId: string;
  }): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread within a context window
   * @param threadId - The unique identifier of the thread
   * @param keyword - Optional keyword to filter the context window
   * @param time - Optional time to filter the context window
   * @returns Promise resolving to an array of messages
   */
  abstract getContextWindow({
    threadId,
    keyword,
    time,
  }: {
    threadId: string;
    time?: Date;
    keyword?: string;
  }): Promise<MessageType[]>;

  /**
   * Retrieves cached tool result for a specific arg in a thread
   * @param threadId - The unique identifier of the thread
   * @param toolArgs - The tool arguments to retrieve the cached result for
   * @param toolName - The name of the tool that was called
   * @returns Promise resolving to the cached tool result or null if not found
   */
  abstract getCachedToolResult({
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
   * @param threadId - The unique identifier of the thread
   * @param toolName - The name of the tool that was called
   * @param hashedToolCallArgs - The hashed tool arguments to check for
   * @returns Promise resolving to true if the un-expired tool call arg exists, false otherwise
   */
  abstract checkIfValidArgExists({
    threadId,
    toolName,
    hashedToolCallArgs,
  }: {
    threadId: string;
    toolName: string;
    hashedToolCallArgs: string;
  }): Promise<boolean>;

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
