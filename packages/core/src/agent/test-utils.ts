import type { CoreMessage } from 'ai';
import type { UIMessage as AIV5UIMessage, ModelMessage as AIV5ModelMessage } from 'ai-v5';
import { expect } from 'vitest';

import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2, MemoryConfig } from '../memory';
import type { StorageGetMessagesArg } from '../storage';
import type { MessageFormat } from '../types';

import { MessageList } from './message-list';
import type { UIMessageWithMetadata } from './message-list';

export class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};
  messages: Map<string, MastraMessageV1 | MastraMessageV2> = new Map();

  constructor() {
    super({ name: 'mock' });
    Object.defineProperty(this, 'storage', {
      get: () => ({
        init: async () => {},
        getThreadById: this.getThreadById.bind(this),
        saveThread: async ({ thread }: { thread: StorageThreadType }) => {
          return this.saveThread({ thread });
        },
        getMessages: this.getMessages.bind(this),
        saveMessages: this.saveMessages.bind(this),
      }),
    });
    this._hasOwnStorage = true;
  }

  /**
   * Type-safe helper to convert messages to requested format.
   */
  private convertToFormat<F extends MessageFormat>(
    messageList: MessageList,
    format: F,
  ): F extends 'mastra-db'
    ? MastraMessageV2[]
    : F extends 'aiv4-ui'
      ? UIMessageWithMetadata[]
      : F extends 'aiv4-core'
        ? CoreMessage[]
        : F extends 'aiv5-ui'
          ? AIV5UIMessage[]
          : F extends 'aiv5-model'
            ? AIV5ModelMessage[]
            : never {
    switch (format) {
      case 'mastra-db':
        return messageList.get.all.v2() as any;
      case 'aiv4-ui':
        return messageList.get.all.aiV4.ui() as any;
      case 'aiv4-core':
        return messageList.get.all.aiV4.core() as any;
      case 'aiv5-ui':
        return messageList.get.all.aiV5.ui() as any;
      case 'aiv5-model':
        return messageList.get.all.aiV5.model() as any;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.threads[threadId] || null;
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    const newThread = { ...thread, updatedAt: new Date() };
    if (!newThread.createdAt) {
      newThread.createdAt = new Date();
    }
    this.threads[thread.id] = newThread;
    return this.threads[thread.id] as StorageThreadType;
  }

  // Overloads for getMessages
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]>;

  // Implementation for getMessages
  async getMessages({
    threadId,
    resourceId,
    format = 'v1',
    selectBy,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    let results = Array.from(this.messages.values());
    if (threadId) results = results.filter(m => m.threadId === threadId);
    if (resourceId) results = results.filter(m => m.resourceId === resourceId);
    if (selectBy) {
      if (selectBy.include) {
        results = results.filter(m => selectBy.include?.some(i => i.id === m.id));
      }
      if (selectBy.last) {
        results = results.slice(-selectBy.last);
      }
    }
    if (format === 'v2') return results as MastraMessageV2[];
    return results as MastraMessageV1[];
  }

  // saveMessages for both v1 and v2
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    const { messages, format } = args as any;

    for (const msg of messages) {
      const existing = this.messages.get(msg.id);
      if (existing) {
        this.messages.set(msg.id, {
          ...existing,
          ...msg,
          createdAt: existing.createdAt,
        });
      } else {
        this.messages.set(msg.id, msg);
      }
    }
    return this.getMessages({ threadId: messages[0].threadId, resourceId: messages[0].resourceId, format });
  }

  async rememberMessages<F extends MessageFormat = 'mastra-db'>({
    threadId,
    resourceId: _resourceId,
    vectorMessageSearch: _vectorMessageSearch,
    memoryConfig: _memoryConfig,
    format = 'mastra-db' as F,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    memoryConfig?: MemoryConfig;
    format?: F;
  }): Promise<
    F extends 'mastra-db'
      ? MastraMessageV2[]
      : F extends 'aiv4-ui'
        ? UIMessageWithMetadata[]
        : F extends 'aiv4-core'
          ? CoreMessage[]
          : F extends 'aiv5-ui'
            ? AIV5UIMessage[]
            : F extends 'aiv5-model'
              ? AIV5ModelMessage[]
              : never
  > {
    const messagesV2: MastraMessageV2[] = [];

    for (const [, message] of this.messages) {
      if ('threadId' in message && message.threadId === threadId) {
        if (!('role' in message)) {
          messagesV2.push(message as MastraMessageV2);
        }
      }
    }

    // Convert to requested format using MessageList
    const messageList = new MessageList().add(messagesV2, 'memory');
    return this.convertToFormat(messageList, format);
  }

  async getThreadsByResourceId() {
    return [];
  }

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & any, // ThreadSortOptions
  ): Promise<any & { threads: StorageThreadType[] }> {
    // Mock implementation - return empty results with pagination info
    return {
      threads: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: args.page,
      perPage: args.perPage,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
  async query<F extends MessageFormat = 'mastra-db'>(
    args: StorageGetMessagesArg & {
      format?: F;
    },
  ): Promise<any> {
    const { threadId, selectBy, format = 'mastra-db' as F } = args;
    const messagesV2: MastraMessageV2[] = [];

    for (const [, message] of this.messages) {
      if ('threadId' in message && message.threadId === threadId) {
        if (!('role' in message)) {
          messagesV2.push(message as MastraMessageV2);
        }
      }
    }

    // Apply selectBy filters if provided
    let filteredMessages = messagesV2;
    if (selectBy?.last) {
      filteredMessages = messagesV2.slice(-selectBy.last);
    }

    // Convert to requested format using MessageList
    const messageList = new MessageList().add(filteredMessages, 'memory');

    // Use switch statement with type assertions to satisfy TypeScript
    switch (format) {
      case 'mastra-db':
        return { messages: messageList.get.all.v2() } as any;
      case 'aiv4-ui':
        return { messages: messageList.get.all.aiV4.ui() } as any;
      case 'aiv4-core':
        return { messages: messageList.get.all.aiV4.core() } as any;
      case 'aiv5-ui':
        return { messages: messageList.get.all.aiV5.ui() } as any;
      case 'aiv5-model':
        return { messages: messageList.get.all.aiV5.model() } as any;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async deleteThread(threadId: string) {
    delete this.threads[threadId];
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    // Mock implementation - remove messages by ID
    for (const messageId of messageIds) {
      this.messages.delete(messageId);
    }
  }

  // Add missing method implementations
  async getWorkingMemory({
    threadId: _threadId,
    resourceId: _resourceId,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    memoryConfig?: MemoryConfig;
  }): Promise<string | null> {
    return null;
  }

  async getWorkingMemoryTemplate({
    memoryConfig: _memoryConfig,
  }: {
    memoryConfig?: MemoryConfig;
  } = {}): Promise<any | null> {
    return null;
  }

  getMergedThreadConfig(config?: MemoryConfig) {
    return config || {};
  }

  async updateWorkingMemory({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    memoryConfig?: MemoryConfig;
  }) {
    // Mock implementation - just return void
    return;
  }

  async __experimental_updateWorkingMemoryVNext({
    threadId: _threadId,
    resourceId: _resourceId,
    workingMemory: _workingMemory,
    searchString: _searchString,
    memoryConfig: _memoryConfig,
  }: {
    threadId: string;
    resourceId?: string;
    workingMemory: string;
    searchString?: string;
    memoryConfig?: MemoryConfig;
  }) {
    // Mock implementation for abstract method
    return { success: true, reason: 'Mock implementation' };
  }

  async updateMessages({ messages }: { messages: MastraMessageV2[] }) {
    return this.saveMessages({ messages, format: 'v2' });
  }
}

export function assertNoDuplicateParts(parts: any[]) {
  // Check for duplicate tool-invocation results by toolCallId
  const seenToolResults = new Set();
  for (const part of parts) {
    if (part.type === 'tool-invocation' && part.toolInvocation.state === 'result') {
      const key = `${part.toolInvocation.toolCallId}|${JSON.stringify(part.toolInvocation.result)}`;
      expect(seenToolResults.has(key)).toBe(false);
      seenToolResults.add(key);
    }
  }

  // Check for duplicate text parts
  const seenTexts = new Set();
  for (const part of parts) {
    if (part.type === 'text') {
      expect(seenTexts.has(part.text)).toBe(false);
      seenTexts.add(part.text);
    }
  }
}
