import type { MastraMessageContentV2 } from '../../../agent';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import type {
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageOrderBy,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
} from '../../types';
import { StorageDomain } from '../base';

// Constants for metadata key validation
const SAFE_METADATA_KEY_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_METADATA_KEY_LENGTH = 128;
const DISALLOWED_METADATA_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export abstract class MemoryStorage extends StorageDomain {
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

  /**
   * List threads with optional filtering by resourceId and metadata.
   *
   * @param args - Filter, pagination, and ordering options
   * @param args.filter - Optional filters for resourceId and/or metadata
   * @param args.filter.resourceId - Optional resource ID to filter by
   * @param args.filter.metadata - Optional metadata key-value pairs to filter by (AND logic)
   * @returns Paginated list of threads matching the filters
   */
  abstract listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput>;

  /**
   * Clone a thread and its messages to create a new independent thread.
   * The cloned thread will have clone metadata stored in its metadata field.
   *
   * @param args - Clone configuration options
   * @returns The newly created thread and the cloned messages
   */
  async cloneThread(_args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    throw new Error(
      `Thread cloning is not implemented by this storage adapter (${this.constructor.name}). ` +
        `The cloneThread method needs to be implemented in the storage adapter.`,
    );
  }

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

  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in THREAD_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in THREAD_THREAD_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  /**
   * Validates metadata keys to prevent SQL injection attacks and prototype pollution.
   * Keys must start with a letter or underscore, followed by alphanumeric characters or underscores.
   * @param metadata - The metadata object to validate
   * @throws Error if any key contains invalid characters or is a disallowed key
   */
  protected validateMetadataKeys(metadata: Record<string, unknown> | undefined): void {
    if (!metadata) return;

    for (const key of Object.keys(metadata)) {
      // First check for disallowed prototype pollution keys
      if (DISALLOWED_METADATA_KEYS.has(key)) {
        throw new Error(`Invalid metadata key: "${key}".`);
      }

      // Then check pattern
      if (!SAFE_METADATA_KEY_PATTERN.test(key)) {
        throw new Error(
          `Invalid metadata key: "${key}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
        );
      }

      // Also limit key length to prevent potential issues
      if (key.length > MAX_METADATA_KEY_LENGTH) {
        throw new Error(`Metadata key "${key}" exceeds maximum length of ${MAX_METADATA_KEY_LENGTH} characters.`);
      }
    }
  }

  /**
   * Validates pagination parameters and returns safe offset.
   * @param page - Page number (0-indexed)
   * @param perPage - Items per page (0 is allowed and returns empty results)
   * @throws Error if page is negative, perPage is negative/invalid, or offset would overflow
   */
  protected validatePagination(page: number, perPage: number): void {
    if (!Number.isFinite(page) || !Number.isSafeInteger(page) || page < 0) {
      throw new Error('page must be >= 0');
    }

    // perPage: 0 is allowed (returns empty results), negative values are rejected
    if (!Number.isFinite(perPage) || !Number.isSafeInteger(perPage) || perPage < 0) {
      throw new Error('perPage must be >= 0');
    }

    // Skip overflow check when perPage is 0 (no offset needed)
    if (perPage === 0) {
      return;
    }

    // Prevent overflow when calculating offset
    const offset = page * perPage;
    if (!Number.isSafeInteger(offset) || offset > Number.MAX_SAFE_INTEGER) {
      throw new Error('page value too large');
    }
  }

  /**
   * Validates pagination input before normalization.
   * Use this when accepting raw perPageInput (number | false) from callers.
   *
   * When perPage is false (fetch all), page must be 0 since pagination is disabled.
   * When perPage is a number, delegates to validatePagination for full validation.
   *
   * @param page - Page number (0-indexed)
   * @param perPageInput - Items per page as number, or false to fetch all results
   * @throws Error if perPageInput is false and page !== 0
   * @throws Error if perPageInput is invalid (not false or a non-negative safe integer)
   * @throws Error if page is invalid or offset would overflow
   */
  protected validatePaginationInput(page: number, perPageInput: number | false): void {
    // Validate perPageInput type first
    if (perPageInput !== false) {
      if (typeof perPageInput !== 'number' || !Number.isFinite(perPageInput) || !Number.isSafeInteger(perPageInput)) {
        throw new Error('perPage must be false or a safe integer');
      }
      if (perPageInput < 0) {
        throw new Error('perPage must be >= 0');
      }
    }

    // When fetching all (perPage: false), only page 0 is valid
    if (perPageInput === false) {
      if (page !== 0) {
        throw new Error('page must be 0 when perPage is false');
      }
      // Still validate page is a valid integer
      if (!Number.isFinite(page) || !Number.isSafeInteger(page)) {
        throw new Error('page must be >= 0');
      }
      return;
    }

    // For numeric perPage, delegate to existing validation
    this.validatePagination(page, perPageInput);
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
