import type { MastraMessageContentV2 } from '../../../agent';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import type {
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageOrderBy,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageBranchThreadInput,
  StorageBranchThreadOutput,
  StoragePromoteBranchInput,
  StoragePromoteBranchOutput,
} from '../../types';
import { StorageDomain } from '../base';

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

  abstract listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput>;

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

  /**
   * Branch a thread at a specific message point, creating a new thread that
   * references the parent's messages up to the branch point instead of copying them.
   *
   * Unlike cloning, branched threads share message history with their parent
   * up to the branch point. Messages added after branching are independent.
   *
   * @param args - Branch configuration options
   * @returns The newly created thread and count of inherited messages
   */
  async branchThread(_args: StorageBranchThreadInput): Promise<StorageBranchThreadOutput> {
    throw new Error(
      `Thread branching is not implemented by this storage adapter (${this.constructor.name}). ` +
        `The branchThread method needs to be implemented in the storage adapter.`,
    );
  }

  /**
   * Promote a branch to become the canonical thread, optionally archiving
   * or deleting the parent's messages that came after the branch point.
   *
   * @param args - Promotion configuration options
   * @returns The promoted thread and optionally the archive thread
   */
  async promoteBranch(_args: StoragePromoteBranchInput): Promise<StoragePromoteBranchOutput> {
    throw new Error(
      `Branch promotion is not implemented by this storage adapter (${this.constructor.name}). ` +
        `The promoteBranch method needs to be implemented in the storage adapter.`,
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
}

const THREAD_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const THREAD_THREAD_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};
