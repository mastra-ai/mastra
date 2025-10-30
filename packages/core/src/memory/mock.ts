import type { UIMessageWithMetadata } from '../agent';
import { MessageList } from '../agent/message-list';
import type { CoreMessage } from '../llm';
import { MastraMemory } from '../memory';
import type { StorageThreadType, MastraMessageV1, MastraMessageV2, MemoryConfig, MessageDeleteInput } from '../memory';
import { InMemoryStore } from '../storage';
import type {
  StorageGetMessagesArg,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  ThreadSortOptions,
} from '../storage';

export class MockMemory extends MastraMemory {
  threads: Record<string, StorageThreadType> = {};
  messages: Map<string, MastraMessageV1 | MastraMessageV2> = new Map();

  constructor(storage?: InMemoryStore) {
    super({ name: 'mock', storage: storage || new InMemoryStore() });
    this._hasOwnStorage = true;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.storage.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType; memoryConfig?: MemoryConfig }): Promise<StorageThreadType> {
    return this.storage.saveThread({ thread });
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
    return this.storage.getMessages({ threadId, resourceId, format, selectBy });
  }

  // saveMessages for both v1 and v2
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages({
    messages,
  }: {
    messages: (MastraMessageV1 | MastraMessageV2)[];
    memoryConfig?: MemoryConfig;
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    // Convert all messages to v2 format before saving (like the real Memory class does)
    const v2Messages = new MessageList().add(messages, 'memory').get.all.v2();
    return this.storage.saveMessages({ messages: v2Messages, format: 'v2' });
  }

  async rememberMessages() {
    const list = new MessageList().add(Array.from(this.messages.values()), `memory`);
    return { messages: list.get.remembered.v1(), messagesV2: list.get.remembered.v2() };
  }

  async getThreadsByResourceId(props: { resourceId: string } & ThreadSortOptions) {
    return this.storage.getThreadsByResourceId(props);
  }

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & any, // ThreadSortOptions
  ): Promise<any & { threads: StorageThreadType[] }> {
    return this.storage.getThreadsByResourceIdPaginated(args);
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    return this.storage.listThreadsByResourceId(args);
  }

  async query({ threadId, resourceId, selectBy }: StorageGetMessagesArg): Promise<{
    messages: CoreMessage[];
    uiMessages: UIMessageWithMetadata[];
    messagesV2: MastraMessageV2[];
  }> {
    // Get raw messages from storage
    const rawMessages = await this.storage.getMessages({
      threadId,
      resourceId,
      format: 'v2',
      selectBy,
    });

    // Convert using MessageList like the real Memory class does
    const list = new MessageList({ threadId, resourceId }).add(rawMessages, 'memory');
    return {
      get messages() {
        const v1Messages = list.get.all.v1();
        // Handle selectBy.last if provided
        if (selectBy?.last && v1Messages.length > selectBy.last) {
          return v1Messages.slice(v1Messages.length - selectBy.last) as CoreMessage[];
        }
        return v1Messages as CoreMessage[];
      },
      get uiMessages() {
        return list.get.all.ui();
      },
      get messagesV2() {
        return list.get.all.v2();
      },
    };
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

  async updateMessages({ messages }: { messages: MastraMessageV2[] }) {
    return this.saveMessages({ messages, format: 'v2' });
  }
}
