import { MastraMemory, MessageType, ThreadType } from '@mastra/core';
import { ToolResultPart, Message as AiMessage } from 'ai';

import { CloudflareKVProvider, KVNamespace } from './kv';

export class CloudflareKVMemory extends MastraMemory {
  private kv: CloudflareKVProvider;
  private threadPrefix = 'thread:';
  private messagePrefix = 'messages:';

  constructor(namespace: KVNamespace) {
    super();
    this.kv = new CloudflareKVProvider(namespace);
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    const thread = await this.kv.get<ThreadType>(`${this.threadPrefix}${threadId}`);
    if (thread && typeof thread.createdAt === 'string') {
      thread.createdAt = new Date(thread.createdAt);
      thread.updatedAt = new Date(thread.updatedAt);
    }
    return thread;
  }

  async getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]> {
    const threadIds = await this.kv.smembers('threads');
    const threads = await this.getThreads(threadIds);
    return threads.filter(thread => thread.resourceid === resourceid);
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    thread.updatedAt = new Date();
    await this.kv.set(`${this.threadPrefix}${thread.id}`, thread);
    await this.kv.sadd('threads', thread.id);
    return thread;
  }

  private async retryOperation<T>(operation: () => Promise<T>, maxRetries = 5): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 * Math.pow(2, attempt)));
      }
    }

    throw lastError || new Error(`Operation failed after ${maxRetries} attempts`);
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    if (!messages.length) return [];

    const messagesByThread = new Map<string, MessageType[]>();

    for (const message of messages) {
      const key = `${this.messagePrefix}${message.threadId}`;
      if (!messagesByThread.has(key)) {
        messagesByThread.set(key, []);
      }
      messagesByThread.get(key)!.push({
        ...message,
        createdAt: new Date(message.createdAt),
      });
    }

    await Promise.all(
      Array.from(messagesByThread.entries()).map(([key, threadMessages]) =>
        this.retryOperation(async () => {
          let saved = false;
          while (!saved) {
            const { data: existingMessages, version } = await this.kv.getWithVersion<MessageType[]>(key);
            console.log('Read version:', version, 'Messages:', existingMessages?.length || 0);

            const messageMap = new Map<string, MessageType>();

            (existingMessages || []).forEach(msg => {
              messageMap.set(msg.id, {
                ...msg,
                createdAt: new Date(msg.createdAt),
              });
            });

            threadMessages.forEach(msg => {
              messageMap.set(msg.id, msg);
            });

            const updatedMessages = Array.from(messageMap.values());
            updatedMessages.sort((a, b) => {
              const timeCompare = a.createdAt.getTime() - b.createdAt.getTime();
              return timeCompare === 0 ? a.id.localeCompare(b.id) : timeCompare;
            });

            saved = await this.kv.setWithVersion(key, updatedMessages, version);
            console.log('Save attempt with version:', version, 'Success:', saved);

            if (!saved) {
              // If save failed, someone else updated the messages, retry with new version
              await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            }
          }
        }),
      ),
    );

    return messages;
  }

  async getMessages({ threadId }: { threadId: string }): Promise<{ messages: MessageType[]; uiMessages: AiMessage[] }> {
    const messages = (await this.kv.get<MessageType[]>(`${this.messagePrefix}${threadId}`)) || [];
    return {
      messages: messages.map(msg => ({
        ...msg,
        createdAt: new Date(msg.createdAt),
      })),
      uiMessages: [],
    };
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

  async getAllThreadIds(): Promise<string[]> {
    return this.kv.smembers('threads');
  }

  async deleteThread(threadId: string): Promise<void> {
    await Promise.all([
      this.kv.del(`${this.threadPrefix}${threadId}`),
      this.kv.del(`${this.messagePrefix}${threadId}`),
      this.kv.srem('threads', threadId),
    ]);
  }

  async getThreads(threadIds: string[]): Promise<ThreadType[]> {
    const threads = await Promise.all(threadIds.map(id => this.getThreadById({ threadId: id })));
    return threads.filter((t): t is ThreadType => t !== null);
  }

  async cleanup(): Promise<void> {
    // Flush all data
    await this.kv.flushall();
  }
}
