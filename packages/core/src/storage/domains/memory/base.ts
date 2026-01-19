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
  ObservationalMemoryRecord,
  CreateObservationalMemoryInput,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  CreateReflectionGenerationInput,
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

  // ============================================
  // Observational Memory Methods
  // ============================================

  /**
   * Get the current observational memory record for a thread/resource.
   * Returns the most recent active record.
   */
  async getObservationalMemory(
    _threadId: string | null,
    _resourceId: string,
  ): Promise<ObservationalMemoryRecord | null> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Get observational memory history (previous generations).
   * Returns records in reverse chronological order (newest first).
   */
  async getObservationalMemoryHistory(
    _threadId: string | null,
    _resourceId: string,
    _limit?: number,
  ): Promise<ObservationalMemoryRecord[]> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Create a new observational memory record.
   * Called when starting observations for a new thread/resource.
   */
  async initializeObservationalMemory(_input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update active observations.
   * Called when observations are created and immediately activated (no buffering).
   */
  async updateActiveObservations(_input: UpdateActiveObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update buffered observations.
   * Called when observations are created asynchronously.
   */
  async updateBufferedObservations(_input: UpdateBufferedObservationsInput): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Swap buffered observations to active.
   * Atomic operation that:
   * 1. Moves bufferedObservations → activeObservations
   * 2. Moves bufferedMessageIds → observedMessageIds
   * 3. Clears buffered state
   */
  async swapBufferedToActive(_id: string): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Mark messages as currently being observed (in-flight).
   */
  async markMessagesAsBuffering(_id: string, _messageIds: string[]): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Mark messages as buffered (observation complete but not active).
   * Moves messageIds from bufferingMessageIds → bufferedMessageIds.
   */
  async markMessagesAsBuffered(_id: string, _messageIds: string[]): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Create a new generation from a reflection.
   * Creates a new record with:
   * - originType: 'reflection'
   * - previousGenerationId pointing to current record
   * - activeObservations containing the reflection
   */
  async createReflectionGeneration(_input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Update buffered reflection (async reflection in progress).
   */
  async updateBufferedReflection(_id: string, _reflection: string): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Swap buffered reflection to active observations.
   * Creates a new generation and makes it the active one.
   */
  async swapReflectionToActive(_id: string): Promise<ObservationalMemoryRecord> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the isReflecting flag.
   */
  async setReflectingFlag(_id: string, _isReflecting: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Set the isObserving flag.
   */
  async setObservingFlag(_id: string, _isObserving: boolean): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Clear all observational memory for a thread/resource.
   * Removes all records and history.
   */
  async clearObservationalMemory(_threadId: string | null, _resourceId: string): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
  }

  /**
   * Add to the pending message token count.
   * Called when messages are processed but observation hasn't triggered yet.
   * This allows accumulating tokens across multiple sessions.
   */
  async addPendingMessageTokens(_id: string, _tokenCount: number): Promise<void> {
    throw new Error(`Observational memory is not implemented by this storage adapter (${this.constructor.name}).`);
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
