import { MessageList } from '../agent/message-list';
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
    return this.storage.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    return this.storage.saveThread({ thread });
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

    return this.storage.saveMessages({ messages: dbMessages });
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    return this.storage.listThreadsByResourceId(args);
  }

  async recall(args: StorageListMessagesInput & { threadConfig?: MemoryConfig; vectorSearchString?: string }): Promise<{
    messages: MastraDBMessage[];
  }> {
    // Get raw messages from storage
    const result = await this.storage.listMessages({
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
    return this.storage.deleteThread({ threadId });
  }

  async deleteMessages(messageIds: MessageDeleteInput): Promise<void> {
    const ids = Array.isArray(messageIds)
      ? messageIds?.map(item => (typeof item === 'string' ? item : item.id))
      : [messageIds];
    return this.storage.deleteMessages(ids);
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
    const result = await this.saveMessages({ messages });
    return result.messages;
  }
}
