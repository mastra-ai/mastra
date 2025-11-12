import { MessageList } from '../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraDBMessage, MemoryConfig, MessageDeleteInput } from '../memory';
import { InMemoryStore } from '../storage';
import type {
  StorageListMessagesInput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
} from '../storage';

export class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};

  constructor({ storage }: { storage?: InMemoryStore } = {}) {
    super({ name: 'mock', storage: storage || new InMemoryStore() });
    this._hasOwnStorage = true;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_GET_THREAD_BY_ID_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_SAVE_THREAD_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.saveThread({ thread });
  }

  async saveMessages({
    messages,
  }: {
    messages: MastraDBMessage[];
    memoryConfig?: MemoryConfig;
  }): Promise<{ messages: MastraDBMessage[] }> {
    // Convert messages to MastraDBMessage format and ensure IDs are generated
    const dbMessages = new MessageList({
      generateMessageId: () => this.generateId(),
    })
      .add(messages, 'memory')
      .get.all.db();

    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_SAVE_MESSAGES_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.saveMessages({ messages: dbMessages });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_LIST_THREADS_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.listThreadsByResourceId(args);
  }

  async recall(args: StorageListMessagesInput & { threadConfig?: MemoryConfig; vectorSearchString?: string }): Promise<{
    messages: MastraDBMessage[];
  }> {
    // Get raw messages from storage
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_LIST_MESSAGES_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    const result = await memoryStore.listMessages({
      threadId: args.threadId,
      resourceId: args.resourceId,
      perPage: args.perPage,
      page: args.page,
      orderBy: args.orderBy,
      filter: args.filter,
      include: args.include,
    });

    return result;
  }
  async deleteThread(threadId: string) {
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_DELETE_THREAD_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.deleteThread({ threadId });
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    const ids = Array.isArray(messageIds)
      ? messageIds?.map(item => (typeof item === 'string' ? item : item.id))
      : [messageIds];
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_DELETE_MESSAGES_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    return memoryStore.deleteMessages(ids);
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

  async updateMessages({ messages }: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]> {
    const memoryStore = this.storage.getStore('memory');
    if (!memoryStore) {
      throw new MastraError({
        id: 'MASTRA_STORAGE_UPDATE_MESSAGES_NOT_SUPPORTED',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.SYSTEM,
        text: 'Memory store not found',
      });
    }
    const result = await memoryStore.updateMessages({ messages });
    return result;
  }
}
