import type { MastraMessageContentV2 } from '../../../agent';
import { MastraBase } from '../../../base';
import type { MastraMessageV1, MastraMessageV2, StorageThreadType } from '../../../memory/types';
import type {
  StorageGetMessagesArg,
  PaginationInfo,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  ThreadSortOptions,
} from '../../types';

export abstract class MemoryStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'MEMORY',
    });
  }

  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

  abstract getThreadsByResourceId({
    resourceId,
  }: { resourceId: string } & ThreadSortOptions): Promise<StorageThreadType[]>;

  abstract saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType>;

  abstract updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType>;

  abstract deleteThread({ threadId }: { threadId: string }): Promise<void>;

  abstract getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;
  abstract getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;
  abstract getMessages({
    threadId,
    resourceId,
    selectBy,
    format,
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]>;
  abstract getMessagesById({ messageIds }: { messageIds: string[]; format: 'v1' }): Promise<MastraMessageV1[]>;
  abstract getMessagesById({ messageIds }: { messageIds: string[]; format?: 'v2' }): Promise<MastraMessageV2[]>;
  abstract getMessagesById({
    messageIds,
  }: {
    messageIds: string[];
    format?: 'v1' | 'v2';
  }): Promise<MastraMessageV1[] | MastraMessageV2[]>;

  abstract saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;
  abstract saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;
  abstract saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV2[] | MastraMessageV1[]>;

  abstract updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraMessageV2[]>;

  async deleteMessages(_messageIds: string[]): Promise<void> {
    throw new Error(
      `Message deletion is not supported by this storage adapter (${this.constructor.name}). ` +
        `The deleteMessages method needs to be implemented in the storage adapter.`,
    );
  }

  abstract getThreadsByResourceIdPaginated(
    args: {
      resourceId: string;
      page: number;
      perPage: number;
    } & ThreadSortOptions,
  ): Promise<PaginationInfo & { threads: StorageThreadType[] }>;

  abstract getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV1[] | MastraMessageV2[] }>;

  async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async saveResource(_: { resource: StorageResourceType }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  async updateResource(_: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not supported by this storage adapter (${this.constructor.name}). ` +
        `Supported storage adapters: LibSQL (@mastra/libsql), PostgreSQL (@mastra/pg), Upstash (@mastra/upstash). ` +
        `To use per-resource working memory, switch to one of these supported storage adapters.`,
    );
  }

  protected castThreadOrderBy(v: unknown): ThreadOrderBy {
    return (v as string) in THREAD_ORDER_BY_SET ? (v as ThreadOrderBy) : 'createdAt';
  }

  protected castThreadSortDirection(v: unknown): ThreadSortDirection {
    return (v as string) in THREAD_THREAD_SORT_DIRECTION_SET ? (v as ThreadSortDirection) : 'DESC';
  }
}

const THREAD_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const THREAD_THREAD_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};
