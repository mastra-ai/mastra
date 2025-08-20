import { expect } from 'vitest';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2, MemoryConfig } from '../memory';
import type { StorageGetMessagesArg } from '../storage';
import { MessageList } from './message-list';

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
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    let results = Array.from(this.messages.values());
    if (threadId) results = results.filter(m => m.threadId === threadId);
    if (resourceId) results = results.filter(m => m.resourceId === resourceId);
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

  async rememberMessages() {
    const list = new MessageList().add(Array.from(this.messages.values()), `memory`);
    return { messages: list.get.remembered.v1(), messagesV2: list.get.remembered.v2() };
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
  async query() {
    return { messages: [], uiMessages: [] };
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
