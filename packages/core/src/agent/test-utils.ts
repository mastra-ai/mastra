import { expect } from 'vitest';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2, MemoryConfig, MemoryQueryResult } from '../memory';
import { InMemoryStore, type StorageListMessagesInput } from '../storage';
import { MessageList } from './message-list';

export class MockMemory extends MastraMemory {
  constructor({ storage }: { storage?: InMemoryStore } = {}) {
    super({ name: 'mock', storage: storage || new InMemoryStore() });
    this._hasOwnStorage = true;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    return this.storage.saveThread({ thread });
  }

  // saveMessages for both v1 and v2
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    return this.storage.saveMessages(args);
  }

  async rememberMessages({ threadId }: { threadId: string }) {
    const { messages } = await this.storage.listMessages({ threadId });
    const list = new MessageList().add(messages, `memory`);
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
  async query(
    args: Omit<StorageListMessagesInput, 'format' | 'include'> & {
      threadConfig?: MemoryConfig;
      vectorSearchString?: string;
    },
  ): Promise<MemoryQueryResult> {
    return { messages: [], uiMessages: [], total: 0, page: 0, perPage: 0, hasMore: false };
  }
  async deleteThread(threadId: string) {
    return this.storage.deleteThread({ threadId });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.storage.deleteMessages(messageIds);
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
