import { expect } from 'vitest';

import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraMessageV1, MastraDBMessage, MemoryConfig } from '../memory';
import type { StorageGetMessagesArg } from '../storage';

export class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};
  messages: Map<string, MastraMessageV1 | MastraDBMessage> = new Map();

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
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraDBMessage[]>;
  async getMessages(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<MastraMessageV1[] | MastraDBMessage[]>;

  // Implementation for getMessages
  async getMessages({
    threadId,
    resourceId,
    format = 'v1',
    selectBy,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraDBMessage[]> {
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
    if (format === 'v2') return results as MastraDBMessage[];
    return results as MastraMessageV1[];
  }

  // saveMessages for both v1 and v2
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraDBMessage[]; format: 'v2' }): Promise<MastraDBMessage[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraDBMessage[]; format: 'v2' },
  ): Promise<MastraDBMessage[] | MastraMessageV1[]> {
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

  async rememberMessages({
    threadId,
    resourceId: _resourceId,
    vectorMessageSearch: _vectorMessageSearch,
    config: _config,
  }: {
    threadId: string;
    resourceId?: string;
    vectorMessageSearch?: string;
    config?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const messagesV2: MastraDBMessage[] = [];

    for (const [, message] of this.messages) {
      if ('threadId' in message && message.threadId === threadId) {
        if (!('role' in message)) {
          messagesV2.push(message as MastraDBMessage);
        }
      }
    }

    // Always return mastra-db format (V2) in object wrapper for consistency
    return { messages: messagesV2 };
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
  async query(
    args: StorageGetMessagesArg & {
      threadConfig?: MemoryConfig;
    },
  ): Promise<{ messages: MastraDBMessage[] }> {
    const { threadId, selectBy } = args;
    const messagesV2: MastraDBMessage[] = [];

    for (const [, message] of this.messages) {
      if ('threadId' in message && message.threadId === threadId) {
        if (!('role' in message)) {
          messagesV2.push(message as MastraDBMessage);
        }
      }
    }

    // Apply selectBy filters if provided
    let filteredMessages = messagesV2;
    if (selectBy?.last) {
      filteredMessages = messagesV2.slice(-selectBy.last);
    }

    // Always return mastra-db format (V2)
    return { messages: filteredMessages };
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

  async updateMessages({ messages }: { messages: MastraDBMessage[] }) {
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
