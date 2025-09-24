import type { MastraMessageContentV2 } from '@mastra/core/agent';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '@mastra/core/memory';
import { MemoryStorage } from '@mastra/core/storage';
import type {
  StorageGetMessagesArg,
  PaginationInfo,
  StorageResourceType,
  ThreadSortOptions,
} from '@mastra/core/storage';

export class MemoryDrizzle extends MemoryStorage {
  private db: any; // Will be Drizzle instance
  private schema: any; // Will be schema definitions

  constructor({ db, schema }: { db: any; schema: any }) {
    super();
    this.db = db;
    this.schema = schema;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getThreadById not implemented');
  }

  async getThreadsByResourceId({
    resourceId,
    orderBy,
    sortDirection,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getThreadsByResourceId not implemented');
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.saveThread not implemented');
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.updateThread not implemented');
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.deleteThread not implemented');
  }

  // Message methods with overloads
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessages(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    // TODO: Implement with Drizzle query
    // Using parameter to avoid unused variable warning
    void args;
    throw new Error('MemoryDrizzle.getMessages not implemented');
  }

  async getMessagesById({ messageIds, format }: { messageIds: string[]; format: 'v1' }): Promise<MastraMessageV1[]>;
  async getMessagesById({ messageIds, format }: { messageIds: string[]; format?: 'v2' }): Promise<MastraMessageV2[]>;
  async getMessagesById({
    messageIds,
    format,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getMessagesById not implemented');
  }

  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.saveMessages not implemented');
  }

  async updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.updateMessages not implemented');
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.deleteMessages not implemented');
  }

  async getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getThreadsByResourceIdPaginated not implemented');
  }

  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getMessagesPaginated not implemented');
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.getResourceById not implemented');
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.saveResource not implemented');
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    // TODO: Implement with Drizzle query
    throw new Error('MemoryDrizzle.updateResource not implemented');
  }
}
