import { AssistantContent, ToolContent, UserContent } from 'ai';

// Types for the memory system
export type MessageType = {
  id: string;
  content: UserContent | AssistantContent | ToolContent;
  role: 'user' | 'assistant' | 'tool';
  createdAt: Date;
  threadId: string;
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
   * @returns Promise resolving to the saved message
   */
  async addMessage({
    threadId,
    content,
    role,
  }: {
    threadId: string;
    content: UserContent | AssistantContent;
    role: 'user' | 'assistant';
  }): Promise<MessageType> {
    const message: MessageType = {
      id: this.generateId(),
      content,
      role,
      createdAt: new Date(),
      threadId,
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
