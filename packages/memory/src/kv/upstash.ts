import {
  MastraMemory,
  MessageType as BaseMastraMessageType,
  ThreadType,
  MessageResponse,
  AiMessageType,
} from '@mastra/core';
import { Redis } from '@upstash/redis';
import { ToolResultPart, TextPart } from 'ai';
import crypto from 'crypto';

interface ToolCacheData {
  expireAt: string;
  result?: ToolResultPart['result'];
}

interface MessageType extends BaseMastraMessageType {
  tokens?: number;
}

// Internal type for serialized thread data
interface SerializedThreadType extends Omit<ThreadType, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export class UpstashKVMemory extends MastraMemory {
  private prefix: string;

  kv: Redis;

  constructor(config: { url: string; token: string; prefix?: string; maxTokens?: number }) {
    super();
    this.prefix = config.prefix || 'mastra';
    this.MAX_CONTEXT_TOKENS = config.maxTokens;

    this.kv = new Redis({
      url: config.url,
      token: config.token,
    });
  }

  private getThreadKey(threadId: string): string {
    return `${this.prefix}:thread:${threadId}`;
  }

  private getMessagesKey(threadId: string): string {
    return `${this.prefix}:messages:${threadId}`;
  }

  private getToolCacheKey(hashedArgs: string): string {
    return `${this.prefix}:tool:${hashedArgs}`;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<ThreadType | null> {
    const thread = await this.kv.get<SerializedThreadType>(this.getThreadKey(threadId));
    return thread ? this.parseThread(thread) : null;
  }

  async getThreadsByResourceId({ resourceid }: { resourceid: string }): Promise<ThreadType[]> {
    const pattern = `${this.prefix}:thread:*`;
    const keys = await this.kv.keys(pattern);

    const threads = await Promise.all(keys.map(key => this.kv.get<SerializedThreadType>(key)));

    return threads
      .filter(thread => thread?.resourceid === resourceid)
      .map(thread => this.parseThread(thread as SerializedThreadType));
  }

  async saveThread({ thread }: { thread: ThreadType }): Promise<ThreadType> {
    const key = this.getThreadKey(thread.id);
    const serializedThread: SerializedThreadType = {
      ...thread,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
    await this.kv.set(key, serializedThread);
    return thread;
  }

  async updateThread(id: string, title: string, metadata: Record<string, unknown>): Promise<ThreadType> {
    const key = this.getThreadKey(id);
    const thread = await this.kv.get<SerializedThreadType>(key);

    if (!thread) {
      throw new Error(`Thread ${id} not found`);
    }

    const updatedThread: SerializedThreadType = {
      ...thread,
      title,
      metadata,
      updatedAt: new Date().toISOString(),
    };

    await this.kv.set(key, updatedThread);
    return this.parseThread(updatedThread);
  }

  async deleteThread(id: string): Promise<void> {
    await this.kv.del(this.getThreadKey(id));
    await this.kv.del(this.getMessagesKey(id));
  }

  /**
   * Tool Cache
   */

  async validateToolCallArgs({ hashedArgs }: { hashedArgs: string }): Promise<boolean> {
    const cacheKey = this.getToolCacheKey(hashedArgs);
    const cached = await this.kv.get<ToolCacheData>(cacheKey);
    return !!cached && new Date(cached.expireAt) > new Date();
  }

  async getToolResult({
    threadId,
    toolArgs,
    toolName,
  }: {
    threadId: string;
    toolArgs: Record<string, unknown>;
    toolName: string;
  }): Promise<ToolResultPart['result'] | null> {
    const hashedToolArgs = crypto
      .createHash('sha256')
      .update(JSON.stringify({ args: toolArgs, threadId, toolName }))
      .digest('hex');

    const cacheKey = this.getToolCacheKey(hashedToolArgs);
    const cached = await this.kv.get<ToolCacheData>(cacheKey);

    if (cached && new Date(cached.expireAt) > new Date()) {
      return cached.result || null;
    }

    return null;
  }

  async getContextWindow<T extends 'raw' | 'core_message'>({
    threadId,
    startDate,
    endDate,
    // @ts-ignore
    format = 'raw' as T,
  }: {
    format?: T;
    threadId: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const messagesKey = this.getMessagesKey(threadId);
    const messages = await this.kv.lrange<MessageType>(messagesKey, 0, -1);

    let filteredMessages = messages.filter(msg => msg.type === 'text' || msg.type === 'tool-result');

    if (startDate) {
      filteredMessages = filteredMessages.filter(msg => new Date(msg.createdAt) >= startDate);
    }

    if (endDate) {
      filteredMessages = filteredMessages.filter(msg => new Date(msg.createdAt) <= endDate);
    }

    if (this.MAX_CONTEXT_TOKENS) {
      let totalTokens = 0;
      const messagesWithinTokenLimit: MessageType[] = [];

      // Process messages from newest to oldest
      for (const message of filteredMessages.reverse()) {
        const content =
          message.role === 'assistant'
            ? (message.content as Array<TextPart>)[0]?.text || ''
            : (message.content as string);

        // Use a more aggressive token estimation
        // Roughly estimate 1 token per 4 characters
        const tokens = Math.ceil(content.length / 4);

        // Check if adding this message would exceed the token limit
        if (totalTokens + tokens > this.MAX_CONTEXT_TOKENS) {
          break;
        }

        totalTokens += tokens;
        messagesWithinTokenLimit.unshift({
          ...message,
          tokens,
        });
      }

      // Return messages in chronological order
      return this.parseMessages(messagesWithinTokenLimit) as MessageResponse<T>;
    }

    return this.parseMessages(filteredMessages) as MessageResponse<T>;
  }

  /**
   * Messages
   */

  async getMessages({
    threadId,
  }: {
    threadId: string;
  }): Promise<{ messages: MessageType[]; uiMessages: AiMessageType[] }> {
    const messagesKey = this.getMessagesKey(threadId);
    const messages = await this.kv.lrange<MessageType>(messagesKey, 0, -1);
    const parsedMessages = this.parseMessages(messages);
    const uiMessages = this.convertToUIMessages(parsedMessages);

    return { messages: parsedMessages, uiMessages };
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    const processedMessages: MessageType[] = [];

    for (const message of messages) {
      const { threadId, toolCallArgs, toolNames, createdAt } = message;
      const messagesKey = this.getMessagesKey(threadId);

      const processedMessage = { ...message };

      if (message.type === 'text') {
        const content =
          message.role === 'assistant'
            ? (message.content as Array<TextPart>)[0]?.text || ''
            : (message.content as string);
        processedMessage.tokens = this.estimateTokens(content);
      }

      if (toolCallArgs?.length) {
        const hashedToolCallArgs = toolCallArgs.map((args, index) =>
          crypto
            .createHash('sha256')
            .update(JSON.stringify({ args, threadId, toolName: toolNames?.[index] }))
            .digest('hex'),
        );

        let validArgExists = true;
        for (const hashedArg of hashedToolCallArgs) {
          const isValid = await this.validateToolCallArgs({ hashedArgs: hashedArg });
          if (!isValid) {
            validArgExists = false;
            break;
          }
        }

        const expireAt = validArgExists ? createdAt : new Date(createdAt.getTime() + 5 * 60 * 1000); // 5 minutes

        for (const hashedArg of hashedToolCallArgs) {
          const cacheKey = this.getToolCacheKey(hashedArg);
          await this.kv.set(cacheKey, { expireAt: expireAt.toISOString() } as ToolCacheData);
        }
      }

      await this.kv.rpush(messagesKey, processedMessage);
      processedMessages.push(processedMessage);
    }

    return processedMessages;
  }

  async deleteMessage(id: string): Promise<void> {
    const pattern = `${this.prefix}:messages:*`;
    const keys = await this.kv.keys(pattern);

    for (const key of keys) {
      const messages = await this.kv.lrange<MessageType>(key, 0, -1);
      const filteredMessages = messages.filter(msg => msg.id !== id);

      if (messages.length !== filteredMessages.length) {
        await this.kv.del(key);
        if (filteredMessages.length > 0) {
          await this.kv.rpush(key, ...filteredMessages);
        }
      }
    }
  }

  /**
   * Cleanup
   */

  async drop(): Promise<void> {
    const pattern = `${this.prefix}:*`;
    const keys = await this.kv.keys(pattern);
    if (keys.length > 0) {
      await this.kv.del(...keys);
    }
  }

  parseThread(thread: SerializedThreadType): ThreadType {
    return {
      ...thread,
      createdAt: new Date(thread.createdAt),
      updatedAt: new Date(thread.updatedAt),
    };
  }

  parseMessages(messages: MessageType[]): MessageType[] {
    return messages.map(message => ({
      ...message,
      createdAt: new Date(message.createdAt),
    }));
  }
}
