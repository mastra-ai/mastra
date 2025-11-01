import type { MastraMessageContentV2 } from '../../../agent';
import { MastraBase } from '../../../base';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import type {
  StorageGetMessagesArg,
  PaginationInfo,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageOrderBy,
} from '../../types';

export abstract class MemoryStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'MEMORY',
    });
  }

  abstract getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null>;

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

  abstract getMessages(args: StorageGetMessagesArg): Promise<{ messages: MastraDBMessage[] }>;

  abstract listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput>;

  abstract listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }>;

  abstract saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }>;

  abstract updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]>;

  async deleteMessages(_messageIds: string[]): Promise<void> {
    throw new Error(
      `Message deletion is not supported by this storage adapter (${this.constructor.name}). ` +
        `The deleteMessages method needs to be implemented in the storage adapter.`,
    );
  }

  abstract listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput>;

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

  protected parseOrderBy(orderBy?: StorageOrderBy): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in THREAD_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in THREAD_THREAD_SORT_DIRECTION_SET ? orderBy.direction : 'DESC',
    };
  }

  /**
   * Normalizes perPage input for pagination queries.
   *
   * @param perPageInput - The raw perPage value from the user
   * @param defaultValue - The default perPage value to use when undefined (typically 40 for messages, 100 for threads)
   * @returns A numeric perPage value suitable for queries (false becomes MAX_SAFE_INTEGER, negative values fall back to default)
   */
  protected normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
    if (perPageInput === false) {
      return Number.MAX_SAFE_INTEGER; // Get all results
    } else if (perPageInput === 0) {
      return 0; // Return zero results
    } else if (typeof perPageInput === 'number' && perPageInput > 0) {
      return perPageInput; // Valid positive number
    }
    // For undefined, negative, or other invalid values, use default
    return defaultValue;
  }

  /**
   * Preserves the original perPage value for API responses.
   * When perPageInput is false, returns false; otherwise returns the normalized numeric value.
   *
   * @param perPageInput - The raw perPage value from the user
   * @param normalizedValue - The normalized numeric value from normalizePerPage
   * @returns The value to include in the response (preserves false when input was false)
   */
  protected preservePerPageForResponse(
    perPageInput: number | false | undefined,
    normalizedValue: number,
  ): number | false {
    return perPageInput === false ? false : normalizedValue;
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
