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

  async getMessages({
    threadId,
    resourceId,
    selectBy,
  }: StorageGetMessagesArg): Promise<MastraDBMessage[]> {
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
    return results as MastraDBMessage[];
  }

  async saveMessages(args: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;

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
    const firstMessage = messages[0];
    if (!firstMessage?.threadId || !firstMessage?.resourceId) {
      throw new Error('First message must have threadId and resourceId');
    }
    const savedMessages = await this.getMessages({ threadId: firstMessage.threadId, resourceId: firstMessage.resourceId });
    return { messages: savedMessages };
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

  async listThreadsByResourceId(args: {
    resourceId: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    threads: StorageThreadType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    const threads = Object.values(this.threads).filter(
      thread => thread.resourceId === args.resourceId,
    );
    return {
      threads,
      total: threads.length,
      page: 1,
      perPage: threads.length,
      hasMore: false,
    };
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
    for (const msg of messages) {
      const existing = this.messages.get(msg.id);
      if (existing) {
        this.messages.set(msg.id, {
          ...existing,
          ...msg,
          createdAt: existing.createdAt,
        });
      }
    }
    return messages;
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
