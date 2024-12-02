// Types for the memory system
export type MessageType = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  threadId: string;
};

export type ThreadType = {
  id: string;
  title?: string;
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
  abstract getThreadById(threadId: string): Promise<ThreadType | null>;

  /**
   * Saves or updates a thread
   * @param thread - The thread data to save
   * @returns Promise resolving to the saved thread
   */
  abstract saveThread(thread: ThreadType): Promise<ThreadType>;

  /**
   * Saves messages to a thread
   * @param messages - Array of messages to save
   * @returns Promise resolving to the saved messages
   */
  abstract saveMessages(messages: MessageType[]): Promise<MessageType[]>;

  /**
   * Retrieves all messages for a specific thread
   * @param threadId - The unique identifier of the thread
   * @returns Promise resolving to an array of messages
   */
  abstract getMessages(threadId: string): Promise<MessageType[]>;

  /**
   * Helper method to create a new thread
   * @param title - Optional title for the thread
   * @param metadata - Optional metadata for the thread
   * @returns Promise resolving to the created thread
   */
  async createThread(
    title?: string,
    metadata?: Record<string, unknown>
  ): Promise<ThreadType> {
    const thread: ThreadType = {
      id: this.generateId(),
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    return this.saveThread(thread);
  }

  /**
   * Helper method to add a single message to a thread
   * @param threadId - The thread to add the message to
   * @param content - The message content
   * @param role - The role of the message sender
   * @returns Promise resolving to the saved message
   */
  async addMessage(
    threadId: string,
    content: string,
    role: 'user' | 'assistant'
  ): Promise<MessageType> {
    const message: MessageType = {
      id: this.generateId(),
      content,
      role,
      createdAt: new Date(),
      threadId,
    };

    const savedMessages = await this.saveMessages([message]);
    return savedMessages[0]!;
  }

  /**
   * Generates a unique identifier
   * @returns A unique string ID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }
}
