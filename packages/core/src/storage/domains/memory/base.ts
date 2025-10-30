import type { MastraMessageContentV2 } from '../../../agent';
import { MastraBase } from '../../../base';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
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

  abstract getMessages(args: StorageGetMessagesArg): Promise<MastraDBMessage[]>;

  abstract getMessagesById({ messageIds }: { messageIds: string[] }): Promise<MastraDBMessage[]>;

  abstract saveMessages(args: { messages: MastraDBMessage[] }): Promise<MastraDBMessage[]>;

  abstract updateMessages(args: {
    messages: Partial<Omit<MastraDBMessage, 'createdAt'>> &
      {
        id: string;
        content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
      }[];
  }): Promise<MastraDBMessage[]>;

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

  abstract getMessagesPaginated(args: StorageGetMessagesArg): Promise<PaginationInfo & { messages: MastraDBMessage[] }>;

  async getResourceById(_: { resourceId: string }): Promise<StorageResourceType | null> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
    );
  }

  async saveResource(_: { resource: StorageResourceType }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
    );
  }

  async updateResource(_: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    throw new Error(
      `Resource working memory is not implemented by this storage adapter (${this.constructor.name}). ` +
        `This is likely a bug - all Mastra storage adapters should implement resource support. ` +
        `Please report this issue at https://github.com/mastra-ai/mastra/issues`,
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
