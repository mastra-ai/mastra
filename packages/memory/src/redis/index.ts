import { MastraMemory, ThreadType, MessageType } from '@mastra/core';
import { ToolResultPart, Message as AiMessage } from 'ai';

import { RedisClient } from './types';

export * from './types';
export * from './providers';

export class RedisMemory extends MastraMemory {
  private redis: RedisClient;
  private threadPrefix = 'thread:';
  private messagePrefix = 'messages:';
  private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: RedisClient) {
    super();
    this.redis = redis;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    const thread = await this.redis.get(`${this.threadPrefix}${threadId}`);
    if (thread && typeof thread.createdAt === 'string') {
      thread.createdAt = new Date(thread.createdAt);
      thread.updatedAt = new Date(thread.updatedAt);
    }
    return thread;
  }

  async getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]> {
    const threadIds = await this.redis.smembers('threads');
    const threads = await this.getThreads(threadIds);
    return threads.filter(thread => thread.resourceid === resourceid);
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    thread.updatedAt = new Date();
    await this.redis.set(`${this.threadPrefix}${thread.id}`, thread);
    await this.redis.sadd('threads', thread.id);
    return thread;
  }

  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${key}`;
    const lockTimeout = 5000;
    let locked = false;
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      // Try to acquire lock with retries
      for (let i = 0; i < 3; i++) {
        locked = await this.redis.sadd(lockKey, '1');
        if (locked) break;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
      }

      if (!locked) {
        throw new Error('Could not acquire lock');
      }

      // Set lock timeout
      timeoutId = setTimeout(async () => {
        try {
          await this.redis.del(lockKey);
        } catch {
          // Ignore errors during cleanup
        }
        this.lockTimeouts.delete(lockKey);
      }, lockTimeout);

      this.lockTimeouts.set(lockKey, timeoutId);

      // Execute operation
      return await operation();
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
        this.lockTimeouts.delete(lockKey);
      }
      if (locked) {
        try {
          await this.redis.del(lockKey);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
  }

  // Add cleanup method
  async cleanup(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.lockTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.lockTimeouts.clear();
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (!messages.length) return [];

    const messagesByThread = messages.reduce(
      (acc, message) => {
        const key = `${this.messagePrefix}${message.threadId}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          ...message,
          createdAt: new Date(message.createdAt),
        });
        return acc;
      },
      {} as Record<string, MessageType[]>,
    );

    for (const [key, threadMessages] of Object.entries(messagesByThread)) {
      await this.withLock(key, async () => {
        const existingMessages = (await this.redis.get(key)) || [];

        const messageMap = new Map<string, MessageType>();

        // Process existing messages
        existingMessages.forEach((msg: MessageType) => {
          messageMap.set(msg.id, {
            ...msg,
            createdAt: new Date(msg.createdAt),
          });
        });

        // Add new messages
        threadMessages.forEach(msg => {
          messageMap.set(msg.id, msg);
        });

        const updatedMessages = Array.from(messageMap.values());
        updatedMessages.sort((a, b) => {
          const timeCompare = a.createdAt.getTime() - b.createdAt.getTime();
          return timeCompare === 0 ? a.id.localeCompare(b.id) : timeCompare;
        });

        await this.redis.set(key, updatedMessages);
        if (threadMessages?.[0]?.threadId) {
          const thread = await this.getThreadById({ threadId: threadMessages?.[0]?.threadId });
          if (thread) {
            thread.updatedAt = new Date();
            await this.redis.set(`${this.threadPrefix}${thread.id}`, thread);
          }
        }
      });
    }

    return messages;
  }

  async getMessages({ threadId }: { threadId: string }): Promise<{ messages: MessageType[]; uiMessages: AiMessage[] }> {
    const messages = (await this.redis.get(`${this.messagePrefix}${threadId}`)) || [];
    return {
      messages: messages.map((msg: MessageType) => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      })),
      uiMessages: [],
    };
  }

  async getAllThreadIds(): Promise<string[]> {
    return this.redis.smembers('threads');
  }

  async deleteThread(threadId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(`${this.threadPrefix}${threadId}`);
    pipeline.del(`${this.messagePrefix}${threadId}`);
    pipeline.srem('threads', threadId);
    await pipeline.exec();
  }

  async getThreads(threadIds: string[]): Promise<ThreadType[]> {
    const threads = await Promise.all(threadIds.map(id => this.getThreadById({ threadId: id })));
    return threads.filter((t): t is ThreadType => t !== null);
  }

  getContextWindow({
    threadId,
    keyword,
    time,
  }: {
    threadId: string;
    time?: Date;
    keyword?: string;
  }): Promise<MessageType[]> {
    console.log({ threadId, time, keyword });
    throw new Error('Method not implemented.');
  }

  getCachedToolResult({
    threadId,
    toolArgs,
    toolName,
  }: {
    threadId: string;
    toolArgs: Record<string, unknown>;
    toolName: string;
  }): Promise<ToolResultPart['result'] | null> {
    console.log({ threadId, toolArgs, toolName });
    throw new Error('Method not implemented.');
  }

  async checkIfValidArgExists({ hashedToolCallArgs }: { hashedToolCallArgs: string }): Promise<boolean> {
    console.log({ hashedToolCallArgs });
    throw new Error('Method not implemented.');
  }
}
