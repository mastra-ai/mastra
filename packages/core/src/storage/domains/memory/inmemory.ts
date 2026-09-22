import { MessageList } from '../../../agent/message-list';
import type { MastraDBMessage, StorageThreadType } from '../../../memory/types';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageMessageType,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageListMessagesInput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageCloneThreadInput,
  StorageCopyThreadOutput,
  StorageRollbackThreadCloneInput,
  StorageRollbackThreadCloneResult,
  StorageObservationalMemoryCloneReceipt,
  ThreadCloneMetadata,
  ObservationalMemoryRecord,
  ObservationalMemoryHistoryOptions,
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  ClearObservationalMemoryOptions,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  SwapBufferedReflectionToActiveInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryWriteGuard,
  ObservationalMemoryRetractionReceipt,
  RetractObservationalMemoryInput,
  RetractObservationalMemoryResult,
  UpdateObservationalMemoryConfigInput,
  ApplyWorkingMemoryUpdateInput,
  WorkingMemorySnapshot,
  WorkingMemorySnapshotInput,
  StorageThreadToResourceWorkingMemoryTransitionPreparation,
  StorageTransitionThreadToResourceWorkingMemoryInput,
  StorageTransitionThreadToResourceWorkingMemoryOutput,
  StorageMutateThreadWithWorkingMemoryInput,
  StorageMutateThreadWithWorkingMemoryOutput,
} from '../../types';
import {
  filterByDateRange,
  jsonValueEquals,
  safelyParseJSON,
  storageMessageMatchesMetadataFilter,
  validateStorageMetadataFilter,
} from '../../utils';
import type { InMemoryDB } from '../inmemory-db';
import { assertObservationalMemoryClearExpectation, MemoryStorage } from './base';
import {
  applyWorkingMemorySnapshotUpdate,
  assertGovernedThreadResourceUnchanged,
  assertThreadWorkingMemoryRemoved,
  assertThreadWorkingMemoryIsUngoverned,
  assertWorkingMemorySnapshotUnchanged,
  assertWorkingMemoryTransitionParticipant,
  hasWorkingMemorySnapshotControls,
  mergeThreadMetadataForWorkingMemoryTransition,
  preserveWorkingMemorySnapshotControls,
  readWorkingMemoryIncarnation,
  readWorkingMemorySnapshot,
  reincarnateWorkingMemorySnapshotMetadata,
  retractObserverWorkingMemorySnapshot,
  stripThreadWorkingMemoryMetadata,
  writeWorkingMemorySnapshotMetadata,
  WorkingMemoryValidationError,
} from './working-memory-snapshot';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneResourceMetadataBoundary(
  metadata: Record<string, unknown> | undefined,
  freezeWorkingMemoryControl = false,
): Record<string, unknown> | undefined {
  // Same isolation as thread metadata: callers must not be able to mutate
  // stored resource metadata through a returned nested object.
  return cloneThreadMetadataBoundary(metadata, freezeWorkingMemoryControl);
}

function cloneThreadMetadataBoundary(
  metadata: Record<string, unknown> | undefined,
  freezeWorkingMemoryControl = false,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined;
  const clone = cloneMemoryBoundaryValue(metadata);
  if (!isRecord(metadata.mastra)) return clone;
  const mastra = cloneMemoryBoundaryValue({ ...metadata.mastra });
  if (Object.prototype.hasOwnProperty.call(metadata.mastra, 'workingMemory')) {
    const control = structuredClone(metadata.mastra.workingMemory);
    mastra.workingMemory = freezeWorkingMemoryControl ? freezeMemoryBoundaryValue(control) : control;
  }
  clone.mastra = mastra;
  return clone;
}

function cloneThreadBoundary(thread: StorageThreadType, freezeWorkingMemoryControl = true): StorageThreadType {
  return {
    ...thread,
    metadata: cloneThreadMetadataBoundary(thread.metadata, freezeWorkingMemoryControl),
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  };
}

function cloneResourceBoundary(resource: StorageResourceType, freezeWorkingMemoryControl = true): StorageResourceType {
  return {
    ...resource,
    metadata: cloneResourceMetadataBoundary(resource.metadata, freezeWorkingMemoryControl),
    createdAt: new Date(resource.createdAt),
    updatedAt: new Date(resource.updatedAt),
  };
}

function isPlainBoundaryObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneMemoryBoundaryValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const cached = seen.get(value);
  if (cached !== undefined) return cached as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const nested of value) clone.push(cloneMemoryBoundaryValue(nested, seen));
    return clone as T;
  }
  // In-memory boundary containers are JSON-like, but can hold live model instances and callbacks.
  // Keep those opaque runtime values usable while isolating every mutable plain data container around them.
  if (!isPlainBoundaryObject(value)) return value;

  const clone = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: cloneMemoryBoundaryValue((value as Record<string, unknown>)[key], seen),
    });
  }
  return clone as T;
}

function freezeMemoryBoundaryValue<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  if (!Array.isArray(value) && !(value instanceof Date) && !isPlainBoundaryObject(value)) return value;

  seen.add(value);
  for (const nested of Object.values(value)) freezeMemoryBoundaryValue(nested, seen);
  return Object.freeze(value);
}

function cloneObservationalMemoryBoundary(record: ObservationalMemoryRecord, freeze = true): ObservationalMemoryRecord {
  const clone = cloneMemoryBoundaryValue(record);
  return freeze ? freezeMemoryBoundaryValue(clone) : clone;
}

function preserveGovernedThreadMetadata(
  current: Record<string, unknown> | undefined,
  proposed: Record<string, unknown> | undefined,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const currentValue = typeof current?.workingMemory === 'string' ? current.workingMemory : null;
  assertWorkingMemorySnapshotUnchanged({
    currentValue,
    currentMetadata: current,
    proposedValue: proposed?.workingMemory,
    proposedValueProvided: proposed !== undefined && Object.prototype.hasOwnProperty.call(proposed, 'workingMemory'),
    proposedMetadata: proposed,
  });
  if (!current || !hasWorkingMemorySnapshotControls(current)) return next;

  const preserved = preserveWorkingMemorySnapshotControls(current, next);
  if (current !== undefined && Object.prototype.hasOwnProperty.call(current, 'workingMemory')) {
    preserved.workingMemory = current.workingMemory;
  } else {
    delete preserved.workingMemory;
  }
  return preserved;
}

function replaceThreadMetadataPreservingWorkingMemory(
  current: Record<string, unknown> | undefined,
  proposed: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (current === undefined && proposed === undefined) return undefined;
  const next = proposed ?? {};
  return preserveGovernedThreadMetadata(current, proposed, next);
}

function mergeThreadMetadataPreservingWorkingMemory(
  current: Record<string, unknown> | undefined,
  update: Record<string, unknown>,
): Record<string, unknown> {
  const existing = current ?? {};
  const merged = { ...existing, ...update };
  const existingMastra = isRecord(existing.mastra) ? existing.mastra : {};
  const updateMastra = isRecord(update.mastra) ? update.mastra : {};
  if (Object.keys(existingMastra).length > 0 || Object.keys(updateMastra).length > 0) {
    merged.mastra = { ...existingMastra, ...updateMastra };
  }
  return preserveGovernedThreadMetadata(current, update, merged);
}

function mergeObservationalThreadMetadata(
  current: Record<string, unknown> | undefined,
  update: Record<string, unknown>,
): Record<string, unknown> {
  const existing = current ?? {};
  const existingMastra = isRecord(existing.mastra) ? existing.mastra : {};
  const updateMastra = isRecord(update.mastra) ? update.mastra : {};
  if (!Object.prototype.hasOwnProperty.call(updateMastra, 'om')) return existing;
  return { ...existing, mastra: { ...existingMastra, om: updateMastra.om } };
}

function getManagedWorkingMemoryScopes(records: readonly ObservationalMemoryRecord[]): Set<'thread' | 'resource'> {
  const scopes = new Set<'thread' | 'resource'>();
  for (const record of records) {
    const scope = record.config?._managedWorkingMemoryScope;
    if (scope === 'thread' || scope === 'resource') {
      scopes.add(scope);
    }
  }
  return scopes;
}

function removeObservationalMemoryMetadata(
  metadata: Record<string, unknown> | undefined,
  clearWorkingMemory: boolean,
): {
  metadata: Record<string, unknown>;
  removed: boolean;
  derivedTitle?: string;
} {
  const current = metadata ?? {};
  const cleaned = { ...current };
  let removed = false;
  if (clearWorkingMemory && Object.prototype.hasOwnProperty.call(cleaned, 'workingMemory')) {
    delete cleaned.workingMemory;
    removed = true;
  }

  if (!isRecord(current.mastra) || !isRecord(current.mastra.om)) {
    return { metadata: cleaned, removed };
  }

  const om = current.mastra.om;
  const mastra = { ...current.mastra };
  const derivedTitle = typeof om.threadTitle === 'string' ? om.threadTitle : undefined;
  delete mastra.om;
  return {
    metadata: { ...cleaned, mastra },
    removed: true,
    ...(derivedTitle === undefined ? {} : { derivedTitle }),
  };
}

export class InMemoryMemory extends MemoryStorage {
  override readonly supportsPartialThreadUpdate: boolean = true;
  readonly supportsObservationalMemory = true;
  readonly supportsAtomicObservationalMemoryRetraction = true;
  readonly supportsRevisionedWorkingMemory = true;
  readonly supportsThreadUpdatedBeforeFilter = true;
  readonly supportsAtomicThreadCloneRollback = true;
  readonly supportsThreadCloneSourceSnapshot = true;
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  private withMemoryStateRollback<T>(enabled: boolean, operation: () => T): T {
    if (!enabled) return operation();

    const threads = new Map([...this.db.threads].map(([key, value]) => [key, cloneThreadBoundary(value, true)]));
    const messages = new Map([...this.db.messages].map(([key, value]) => [key, { ...value }]));
    const resources = new Map([...this.db.resources].map(([key, value]) => [key, cloneResourceBoundary(value, true)]));
    const observationalMemory = new Map([...this.db.observationalMemory].map(([key, value]) => [key, [...value]]));
    const threadGenerations = new Map(this.db.memoryThreadGenerations);
    const observationalGenerations = new Map(this.db.memoryObservationalGenerations);
    const restore = <K, V>(target: Map<K, V>, snapshot: Map<K, V>) => {
      target.clear();
      for (const [key, value] of snapshot) target.set(key, value);
    };

    try {
      return operation();
    } catch (error) {
      restore(this.db.threads, threads);
      restore(this.db.messages, messages);
      restore(this.db.resources, resources);
      restore(this.db.observationalMemory, observationalMemory);
      restore(this.db.memoryThreadGenerations, threadGenerations);
      restore(this.db.memoryObservationalGenerations, observationalGenerations);
      throw error;
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.threads.clear();
    this.db.messages.clear();
    this.db.resources.clear();
    this.db.observationalMemory.clear();
    this.db.memoryThreadGenerations.clear();
    this.db.memoryObservationalGenerations.clear();
  }

  private rotateThreadGeneration(threadId: string): string {
    const generation = crypto.randomUUID();
    this.db.memoryThreadGenerations.set(threadId, generation);
    return generation;
  }

  private rotateObservationalMemoryGeneration(recordId: string): string {
    const generation = crypto.randomUUID();
    this.db.memoryObservationalGenerations.set(recordId, generation);
    return generation;
  }

  private forgetObservationalMemoryGenerations(records: readonly ObservationalMemoryRecord[]): void {
    for (const record of records) this.db.memoryObservationalGenerations.delete(record.id);
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    const thread = this.db.threads.get(threadId);
    if (!thread || (resourceId !== undefined && thread.resourceId !== resourceId)) return null;
    return cloneThreadBoundary(thread);
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const current = this.db.threads.get(thread.id);
    if (current) {
      assertGovernedThreadResourceUnchanged({
        currentResourceId: current.resourceId,
        currentMetadata: current.metadata,
        proposedResourceId: thread.resourceId,
      });
    }
    const proposedMetadata = replaceThreadMetadataPreservingWorkingMemory(current?.metadata, thread.metadata);
    const metadata = hasWorkingMemorySnapshotControls(current?.metadata)
      ? proposedMetadata
      : reincarnateWorkingMemorySnapshotMetadata(proposedMetadata);
    const stored = cloneThreadBoundary({ ...thread, metadata }, true);
    this.db.threads.set(thread.id, stored);
    this.rotateThreadGeneration(thread.id);
    return cloneThreadBoundary(stored);
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const thread = this.db.threads.get(id);

    if (!thread) {
      throw new Error(`Thread with id ${id} not found`);
    }

    const mergedMetadata =
      metadata === undefined ? thread.metadata : mergeThreadMetadataPreservingWorkingMemory(thread.metadata, metadata);
    const nextMetadata = hasWorkingMemorySnapshotControls(thread.metadata)
      ? mergedMetadata
      : reincarnateWorkingMemorySnapshotMetadata(mergedMetadata);
    const updated = cloneThreadBoundary(
      {
        ...thread,
        ...(title === undefined ? {} : { title }),
        ...(metadata === undefined ? {} : { metadata: nextMetadata }),
        updatedAt: new Date(),
      },
      true,
    );
    this.db.threads.set(id, updated);
    this.rotateThreadGeneration(id);
    return cloneThreadBoundary(updated);
  }

  async deleteThread({
    threadId,
    observationalMemoryRetractions,
  }: {
    threadId: string;
    observationalMemoryRetractions?: ObservationalMemoryRetractionReceipt[];
  }): Promise<void> {
    const thread = this.db.threads.get(threadId);
    let committedRetraction: ObservationalMemoryRetractionReceipt | undefined;

    this.withMemoryStateRollback(true, () => {
      this.db.threads.delete(threadId);
      this.db.memoryThreadGenerations.delete(threadId);

      this.db.messages.forEach((msg, key) => {
        if (msg.thread_id === threadId) {
          this.db.messages.delete(key);
        }
      });

      if (thread?.resourceId) {
        const input = { resourceId: thread.resourceId, threadId };
        const result = this.retractObservationalMemoryState(input);
        committedRetraction = { input, result };
      }
    });

    if (committedRetraction) observationalMemoryRetractions?.push(committedRetraction);
  }

  async listMessages({
    threadId,
    resourceId: optionalResourceId,
    include,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);
    // Normalize threadId to array
    const threadIds = Array.isArray(threadId) ? threadId : [threadId];

    if (threadIds.length === 0 || threadIds.some(id => !id.trim())) {
      throw new Error('threadId must be a non-empty string or array of non-empty strings');
    }

    const threadIdSet = new Set(threadIds);

    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 40)
    const perPage = normalizePerPage(perPageInput, 40);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values that could cause performance issues
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Calculate offset from page
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // When perPage is 0 with no includes, there's nothing to return.
    if (perPage === 0 && (!include || include.length === 0)) {
      return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
    }

    // Step 1: Get messages matching threadId(s) and optionally resourceId
    let threadMessages = Array.from(this.db.messages.values()).filter((msg: any) => {
      // Message must be in one of the specified threads
      if (threadIdSet && !threadIdSet.has(msg.thread_id)) return false;
      // If optionalResourceId provided, message must match it
      if (optionalResourceId && msg.resourceId !== optionalResourceId) return false;
      return true;
    });

    // Apply date filtering
    threadMessages = filterByDateRange(threadMessages, (msg: any) => new Date(msg.createdAt), filter?.dateRange);
    threadMessages = threadMessages.filter(message =>
      storageMessageMatchesMetadataFilter(message.content, metadataFilter),
    );

    // Sort thread messages before pagination
    threadMessages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    // Get total count of thread messages (for pagination metadata). When
    // perPage is 0, the count query is skipped so the response total is 0.
    const totalThreadMessages = perPage === 0 ? 0 : threadMessages.length;

    // Apply pagination to thread messages. When perPage is 0, skip the main
    // pagination entirely so only included messages are returned.
    const paginatedThreadMessages = perPage === 0 ? [] : threadMessages.slice(offset, offset + perPage);

    // Convert paginated thread messages to MastraDBMessage
    const messages: MastraDBMessage[] = [];
    const messageIds = new Set<string>();

    for (const msg of paginatedThreadMessages) {
      const convertedMessage = this.parseStoredMessage(msg);
      messages.push(convertedMessage);
      messageIds.add(msg.id);
    }

    // Step 2: Add included messages with context (if any), excluding duplicates.
    // The main filter above treats an empty resourceId as "no resource scope", so the
    // include lookup is given the same meaning instead of scoping to the empty string.
    for (const message of this.resolveIncludedMessages({ include, resourceId: optionalResourceId || undefined })) {
      if (messageIds.has(message.id)) continue;
      messages.push(this.parseStoredMessage(message));
      messageIds.add(message.id);
    }

    // Sort all messages (paginated + included) for final output
    messages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    // Calculate hasMore
    let hasMore;
    if (perPage === 0) {
      // perPage=0 fast path skips pagination entirely
      hasMore = false;
    } else if (metadataFilter) {
      hasMore = offset + paginatedThreadMessages.length < totalThreadMessages;
    } else if (include && include.length > 0) {
      // When using include, check if we've returned all messages from the queried
      // threads because include might bring in messages beyond the pagination
      // window. threadId can be an array, so match against the normalized set;
      // included messages from other threads must not count toward the total.
      const returnedThreadMessageIds = new Set(
        messages.filter(m => m.threadId !== undefined && threadIdSet.has(m.threadId)).map(m => m.id),
      );
      hasMore = returnedThreadMessageIds.size < totalThreadMessages;
    } else {
      // Standard pagination: check if there are more pages
      hasMore = offset + perPage < totalThreadMessages;
    }

    return {
      messages,
      total: totalThreadMessages,
      page,
      perPage: perPageForResponse,
      hasMore,
    };
  }

  /**
   * Resolves `include` entries to their target message plus the requested context window.
   * The thread is discovered from the target message itself so cross-thread includes work,
   * but the resource scope of the query is always honoured: when a `resourceId` is given,
   * neither the target nor its neighbours may belong to another resource.
   */
  private resolveIncludedMessages({
    include,
    resourceId,
  }: {
    include: StorageListMessagesInput['include'];
    resourceId?: string;
  }): StorageMessageType[] {
    if (!include || include.length === 0) return [];

    const resolved: StorageMessageType[] = [];
    const resolvedIds = new Set<string>();
    const hasResourceScope = resourceId !== undefined;

    for (const includeItem of include) {
      const targetMessage = this.db.messages.get(includeItem.id);
      if (!targetMessage) continue;
      if (hasResourceScope && targetMessage.resourceId !== resourceId) continue;

      const contextWindow = Array.from(this.db.messages.values())
        .filter(
          msg => msg.thread_id === targetMessage.thread_id && (!hasResourceScope || msg.resourceId === resourceId),
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const targetIndex = contextWindow.findIndex(msg => msg.id === includeItem.id);
      if (targetIndex === -1) continue;

      const startIndex = Math.max(0, targetIndex - (includeItem.withPreviousMessages ?? 0));
      const endIndex = targetIndex + (includeItem.withNextMessages ?? 0) + 1;

      for (const message of contextWindow.slice(startIndex, endIndex)) {
        if (resolvedIds.has(message.id)) continue;
        resolved.push(message);
        resolvedIds.add(message.id);
      }
    }

    return resolved;
  }

  async listMessagesByResourceId({
    resourceId,
    include,
    filter,
    perPage: perPageInput,
    page = 0,
    orderBy,
  }: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    const metadataFilter = validateStorageMetadataFilter(filter?.metadata);
    const { field, direction } = this.parseOrderBy(orderBy, 'ASC');

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 40)
    const perPage = normalizePerPage(perPageInput, 40);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values that could cause performance issues
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Get all messages matching the resourceId (across all threads)
    let messages = Array.from(this.db.messages.values()).filter((msg: any) => msg.resourceId === resourceId);

    // Apply date filtering
    messages = filterByDateRange(messages, (msg: any) => new Date(msg.createdAt), filter?.dateRange);
    messages = messages.filter(message => storageMessageMatchesMetadataFilter(message.content, metadataFilter));

    // Sort messages
    messages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    // Get total count for pagination
    const total = messages.length;

    // Apply pagination
    const paginatedMessages = messages.slice(offset, offset + perPage);

    const hasMore = offset + paginatedMessages.length < total;

    // Add included messages with context, excluding duplicates. The include lookup is
    // scoped to this resource, so it can never pull in another resource's messages.
    const paginatedIds = new Set(paginatedMessages.map(m => m.id));
    const includedMessages = this.resolveIncludedMessages({ include, resourceId }).filter(
      message => !paginatedIds.has(message.id),
    );

    const list = new MessageList().add(
      [...paginatedMessages, ...includedMessages].map(m => this.parseStoredMessage(m)),
      'memory',
    );

    // Sort all messages (paginated + included) for final output
    const finalMessages = list.get.all.db();
    finalMessages.sort((a: any, b: any) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return {
      messages: finalMessages,
      total,
      page,
      perPage: perPageForResponse,
      hasMore,
    };
  }

  protected parseStoredMessage(message: StorageMessageType): MastraDBMessage {
    const { resourceId, content, role, thread_id, createdAt, ...rest } = message;

    // Parse content using safelyParseJSON utility
    let parsedContent = safelyParseJSON(content);

    // If the result is a plain string (V1 format), wrap it in V2 structure
    if (typeof parsedContent === 'string') {
      parsedContent = {
        format: 2,
        content: parsedContent,
        parts: [{ type: 'text', text: parsedContent }],
      };
    }

    return {
      ...rest,
      threadId: thread_id,
      ...(message.resourceId && { resourceId: message.resourceId }),
      content: parsedContent,
      role: role as MastraDBMessage['role'],
      createdAt: new Date(createdAt),
    } satisfies MastraDBMessage;
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    const rawMessages = messageIds.map(id => this.db.messages.get(id)).filter(message => !!message);

    const list = new MessageList().add(
      rawMessages.map(m => this.parseStoredMessage(m)),
      'memory',
    );
    return { messages: list.get.all.db() };
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    const { messages } = args;
    // Simulate error handling for testing - check before saving
    if (messages.some(msg => msg.id === 'error-message' || msg.resourceId === null)) {
      throw new Error('Simulated error for testing');
    }

    // Update thread timestamps for each unique threadId
    const threadIds = new Set(messages.map(msg => msg.threadId).filter((id): id is string => Boolean(id)));
    for (const threadId of threadIds) {
      const thread = this.db.threads.get(threadId);
      if (thread) {
        thread.updatedAt = new Date();
        this.rotateThreadGeneration(threadId);
      }
    }

    for (const message of messages) {
      const key = message.id;
      // Convert MastraDBMessage to StorageMessageType
      const storageMessage: StorageMessageType = {
        id: message.id,
        thread_id: message.threadId || '',
        content: JSON.stringify(message.content),
        role: message.role || 'user',
        type: message.type || 'text',
        createdAt: new Date(message.createdAt),
        resourceId: message.resourceId || null,
      };
      this.db.messages.set(key, storageMessage);
    }

    const list = new MessageList().add(messages, 'memory');
    return { messages: list.get.all.db() };
  }

  async updateMessages(args: {
    messages: (Partial<MastraDBMessage> & { id: string })[];
    retractObservationalMemory?: boolean;
    observationalMemoryRetractions?: ObservationalMemoryRetractionReceipt[];
  }): Promise<MastraDBMessage[]> {
    const canonicalUpdates = [...new Map(args.messages.map(message => [message.id, message])).values()];
    const committedRetractions: ObservationalMemoryRetractionReceipt[] = [];
    const updatedMessages = this.withMemoryStateRollback(args.retractObservationalMemory === true, () => {
      const retractionCoordinates: Array<{ resourceId: string; threadId: string }> = [];
      if (args.retractObservationalMemory) {
        const coordinates = new Map<string, { resourceId: string; threadId: string }>();
        const addCoordinate = (resourceId: string | undefined, threadId: string | undefined) => {
          if (!resourceId || !threadId) return;
          coordinates.set(`${resourceId}\u0000${threadId}`, { resourceId, threadId });
        };
        for (const update of canonicalUpdates) {
          const message = this.db.messages.get(update.id);
          if (!message?.thread_id) continue;
          const source = this.resolveObservationalMemoryRetractionInput(
            message.thread_id,
            message.resourceId ?? undefined,
          );
          addCoordinate(source?.resourceId, source?.threadId);

          const destinationThreadId = update.threadId ?? message.thread_id;
          const destination = this.resolveObservationalMemoryRetractionInput(
            destinationThreadId,
            update.resourceId ??
              (destinationThreadId === message.thread_id ? (message.resourceId ?? undefined) : undefined),
          );
          addCoordinate(destination?.resourceId, destination?.threadId);
        }
        retractionCoordinates.push(
          ...[...coordinates.values()].sort((a, b) =>
            `${a.resourceId}\u0000${a.threadId}`.localeCompare(`${b.resourceId}\u0000${b.threadId}`),
          ),
        );
      }

      const mutationResults: MastraDBMessage[] = [];
      for (const update of canonicalUpdates) {
        const storageMsg = this.db.messages.get(update.id);
        if (!storageMsg) continue;

        // Track old threadId for possible move
        const oldThreadId = storageMsg.thread_id;
        const newThreadId = update.threadId || oldThreadId;
        let threadIdChanged = false;
        if (update.threadId && update.threadId !== oldThreadId) {
          threadIdChanged = true;
        }

        // Update fields
        if (update.role !== undefined) storageMsg.role = update.role;
        if (update.type !== undefined) storageMsg.type = update.type;
        if (update.createdAt !== undefined) storageMsg.createdAt = new Date(update.createdAt);
        if (update.resourceId !== undefined) storageMsg.resourceId = update.resourceId;
        // Deep merge content if present
        if (update.content !== undefined) {
          let oldContent = safelyParseJSON(storageMsg.content);
          let newContent = update.content;
          if (typeof newContent === 'object' && typeof oldContent === 'object') {
            // Deep merge for metadata/content fields
            newContent = { ...oldContent, ...newContent };
            if (oldContent.metadata && newContent.metadata) {
              newContent.metadata = { ...oldContent.metadata, ...newContent.metadata };
            }
          }
          storageMsg.content = JSON.stringify(newContent);
        }
        // Handle threadId change
        if (threadIdChanged) {
          storageMsg.thread_id = newThreadId;
          // Update updatedAt for both threads, ensuring strictly greater and not equal
          const base = Date.now();
          let oldThreadNewTime: number | undefined;
          const oldThread = this.db.threads.get(oldThreadId);
          if (oldThread) {
            const prev = new Date(oldThread.updatedAt).getTime();
            oldThreadNewTime = Math.max(base, prev + 1);
            oldThread.updatedAt = new Date(oldThreadNewTime);
            this.rotateThreadGeneration(oldThreadId);
          }
          const newThread = this.db.threads.get(newThreadId);
          if (newThread) {
            const prev = new Date(newThread.updatedAt).getTime();
            let newThreadNewTime = Math.max(base + 1, prev + 1);
            if (oldThreadNewTime !== undefined && newThreadNewTime <= oldThreadNewTime) {
              newThreadNewTime = oldThreadNewTime + 1;
            }
            newThread.updatedAt = new Date(newThreadNewTime);
            this.rotateThreadGeneration(newThreadId);
          }
        } else {
          // Only update the thread's updatedAt if not a move
          const thread = this.db.threads.get(oldThreadId);
          if (thread) {
            const prev = new Date(thread.updatedAt).getTime();
            let newTime = Date.now();
            if (newTime <= prev) newTime = prev + 1;
            thread.updatedAt = new Date(newTime);
            this.rotateThreadGeneration(oldThreadId);
          }
        }
        // Save the updated message
        this.db.messages.set(update.id, storageMsg);
        // Return as MastraDBMessage
        mutationResults.push({
          id: storageMsg.id,
          threadId: storageMsg.thread_id,
          content: safelyParseJSON(storageMsg.content),
          role: storageMsg.role === 'user' || storageMsg.role === 'assistant' ? storageMsg.role : 'user',
          type: storageMsg.type,
          createdAt: new Date(storageMsg.createdAt),
          resourceId: storageMsg.resourceId === null ? undefined : storageMsg.resourceId,
        });
      }

      for (const input of retractionCoordinates) {
        const result = this.retractObservationalMemoryState(input);
        committedRetractions.push({ input, result });
      }
      return mutationResults;
    });
    args.observationalMemoryRetractions?.push(...committedRetractions);
    return updatedMessages;
  }

  async deleteMessages(
    messageIds: string[],
    options?: {
      retractObservationalMemory?: boolean;
      observationalMemoryRetractions?: ObservationalMemoryRetractionReceipt[];
    },
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) {
      return;
    }

    const committedRetractions: ObservationalMemoryRetractionReceipt[] = [];
    this.withMemoryStateRollback(options?.retractObservationalMemory === true, () => {
      const retractionCoordinates: Array<{ resourceId: string; threadId: string }> = [];
      if (options?.retractObservationalMemory) {
        const coordinates = new Map<string, { resourceId: string; threadId: string }>();
        for (const messageId of messageIds) {
          const message = this.db.messages.get(messageId);
          if (!message?.thread_id) continue;
          const input = this.resolveObservationalMemoryRetractionInput(
            message.thread_id,
            message.resourceId ?? undefined,
          );
          if (!input) continue;
          coordinates.set(`${input.resourceId}\u0000${input.threadId}`, input);
        }
        retractionCoordinates.push(
          ...[...coordinates.values()].sort((a, b) =>
            `${a.resourceId}\u0000${a.threadId}`.localeCompare(`${b.resourceId}\u0000${b.threadId}`),
          ),
        );
      }

      // Collect thread IDs to update
      const threadIds = new Set<string>();

      for (const messageId of messageIds) {
        const message = this.db.messages.get(messageId);
        if (message && message.thread_id) {
          threadIds.add(message.thread_id);
        }
        // Delete the message
        this.db.messages.delete(messageId);
      }

      // Update thread timestamps
      const now = new Date();
      for (const threadId of threadIds) {
        const thread = this.db.threads.get(threadId);
        if (thread) {
          thread.updatedAt = now;
          this.rotateThreadGeneration(threadId);
        }
      }

      for (const input of retractionCoordinates) {
        const result = this.retractObservationalMemoryState(input);
        committedRetractions.push({ input, result });
      }
    });
    options?.observationalMemoryRetractions?.push(...committedRetractions);
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;
    const { field, direction } = this.parseOrderBy(orderBy);

    // Validate pagination input before normalization
    // This ensures page === 0 when perPageInput === false
    this.validatePaginationInput(page, perPageInput ?? 100);

    const perPage = normalizePerPage(perPageInput, 100);

    // Start with all threads
    let threads = Array.from(this.db.threads.values());

    // Apply resourceId filter if provided
    if (filter?.resourceId) {
      threads = threads.filter((t: any) => t.resourceId === filter.resourceId);
    }

    if (filter?.updatedBefore) {
      if (!(filter.updatedBefore instanceof Date) || Number.isNaN(filter.updatedBefore.getTime())) {
        throw new TypeError('updatedBefore must be a valid Date.');
      }
      const updatedBefore = filter.updatedBefore.getTime();
      threads = threads.filter(thread => new Date(thread.updatedAt).getTime() < updatedBefore);
    }

    // Validate metadata keys before filtering
    this.validateMetadataKeys(filter?.metadata);

    // Apply metadata filter if provided (AND logic - all key-value pairs must match)
    if (filter?.metadata && Object.keys(filter.metadata).length > 0) {
      threads = threads.filter(thread => {
        if (!thread.metadata) return false;
        return Object.entries(filter.metadata!).every(([key, value]) => jsonValueEquals(thread.metadata![key], value));
      });
    }

    const sortedThreads = this.sortThreads(threads, field, direction);
    const clonedThreads = sortedThreads.map(thread => cloneThreadBoundary(thread));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      threads: clonedThreads.slice(offset, offset + perPage),
      total: clonedThreads.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedThreads.length,
    };
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    const resource = this.db.resources.get(resourceId);
    return resource ? cloneResourceBoundary(resource) : null;
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    const current = this.db.resources.get(resource.id);
    assertWorkingMemorySnapshotUnchanged({
      currentValue: current?.workingMemory,
      currentMetadata: current?.metadata,
      proposedValue: resource.workingMemory,
      proposedValueProvided: Object.prototype.hasOwnProperty.call(resource, 'workingMemory'),
      proposedMetadata: resource.metadata,
    });
    const stored = cloneResourceBoundary(
      current && hasWorkingMemorySnapshotControls(current.metadata)
        ? {
            ...resource,
            workingMemory: current.workingMemory,
            metadata: preserveWorkingMemorySnapshotControls(current.metadata, resource.metadata ?? {}),
          }
        : {
            ...resource,
            metadata: reincarnateWorkingMemorySnapshotMetadata(resource.metadata),
          },
      true,
    );
    this.db.resources.set(resource.id, stored);
    return cloneResourceBoundary(stored);
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
    const current = this.db.resources.get(resourceId);

    assertWorkingMemorySnapshotUnchanged({
      currentValue: current?.workingMemory,
      currentMetadata: current?.metadata,
      proposedValue: workingMemory,
      proposedValueProvided: workingMemory !== undefined,
      proposedMetadata: metadata,
    });

    let resource = current;

    if (!resource) {
      // Create new resource if it doesn't exist
      resource = {
        id: resourceId,
        workingMemory,
        metadata: reincarnateWorkingMemorySnapshotMetadata(metadata) ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      const mergedMetadata = {
        ...resource.metadata,
        ...metadata,
      };
      resource = {
        ...resource,
        workingMemory:
          hasWorkingMemorySnapshotControls(resource.metadata) || workingMemory === undefined
            ? resource.workingMemory
            : workingMemory,
        metadata: hasWorkingMemorySnapshotControls(resource.metadata)
          ? preserveWorkingMemorySnapshotControls(resource.metadata, mergedMetadata)
          : reincarnateWorkingMemorySnapshotMetadata(mergedMetadata),
        updatedAt: new Date(),
      };
    }

    const stored = cloneResourceBoundary(resource, true);
    this.db.resources.set(resourceId, stored);
    return cloneResourceBoundary(stored);
  }

  async updateResourceFromObservationalMemory({
    resourceId,
    workingMemory,
    guard,
  }: {
    resourceId: string;
    workingMemory: string;
    guard: ObservationalMemoryWriteGuard;
  }): Promise<StorageResourceType> {
    if (guard.resourceId !== resourceId) {
      throw new Error('Observational memory guard does not match the target resource.');
    }
    const current = this.db.observationalMemory.get(
      this.getObservationalMemoryKey(guard.threadId, guard.resourceId),
    )?.[0];
    if (current?.id !== guard.recordId) {
      throw new Error('Observational memory generation is no longer current.');
    }
    const resource = this.db.resources.get(resourceId);
    assertWorkingMemorySnapshotUnchanged({
      currentValue: resource?.workingMemory,
      currentMetadata: resource?.metadata,
      proposedValue: workingMemory,
      proposedValueProvided: true,
      proposedMetadata: undefined,
    });
    return this.updateResource({ resourceId, workingMemory });
  }

  async updateThreadFromObservationalMemory({
    id,
    title,
    metadata,
    guard,
  }: {
    id: string;
    title?: string;
    metadata: Record<string, unknown>;
    guard: ObservationalMemoryWriteGuard;
  }): Promise<StorageThreadType> {
    if (guard.threadId !== null && guard.threadId !== id) {
      throw new Error('Observational memory guard does not match the target thread.');
    }
    const thread = this.db.threads.get(id);
    if (!thread || thread.resourceId !== guard.resourceId) {
      throw new Error('Observational memory guard does not match the target thread resource.');
    }
    const current = this.db.observationalMemory.get(
      this.getObservationalMemoryKey(guard.threadId, guard.resourceId),
    )?.[0];
    if (current?.id !== guard.recordId) {
      throw new Error('Observational memory generation is no longer current.');
    }
    return this.updateThread({
      id,
      title,
      metadata: mergeObservationalThreadMetadata(thread.metadata, metadata),
    });
  }

  async getWorkingMemorySnapshot(input: WorkingMemorySnapshotInput): Promise<WorkingMemorySnapshot> {
    if (input.scope === 'resource') {
      const resource = this.db.resources.get(input.resourceId);
      return readWorkingMemorySnapshot(resource?.workingMemory, resource?.metadata);
    }

    const thread = this.db.threads.get(input.threadId);
    if (!thread || thread.resourceId !== input.resourceId) {
      throw new WorkingMemoryValidationError('Working-memory thread was not found in the requested resource.');
    }
    const value = typeof thread.metadata?.workingMemory === 'string' ? thread.metadata.workingMemory : null;
    return readWorkingMemorySnapshot(value, thread.metadata);
  }

  async prepareThreadToResourceWorkingMemoryTransition({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId: string;
  }): Promise<StorageThreadToResourceWorkingMemoryTransitionPreparation> {
    const thread = this.db.threads.get(threadId);
    if (thread && thread.resourceId !== resourceId) {
      throw new WorkingMemoryValidationError('Working-memory thread does not belong to the requested resource.');
    }
    const threadValue = typeof thread?.metadata?.workingMemory === 'string' ? thread.metadata.workingMemory : null;
    const resource = this.db.resources.get(resourceId);
    return {
      threadId,
      resourceId,
      sourceThread: {
        snapshot: readWorkingMemorySnapshot(threadValue, thread?.metadata),
        workingMemoryIncarnation: readWorkingMemoryIncarnation(thread?.metadata),
      },
      destinationResource: {
        snapshot: readWorkingMemorySnapshot(resource?.workingMemory, resource?.metadata),
        workingMemoryIncarnation: readWorkingMemoryIncarnation(resource?.metadata),
      },
    };
  }

  async applyWorkingMemoryUpdate(input: ApplyWorkingMemoryUpdateInput): Promise<WorkingMemorySnapshot> {
    return this.withMemoryStateRollback(true, () => {
      if (input.observationalMemoryGuard) {
        if (input.source !== 'observer') {
          throw new WorkingMemoryValidationError('Only observer updates may carry an observational-memory guard.');
        }
        const guard = input.observationalMemoryGuard;
        if (guard.resourceId !== input.resourceId || (guard.threadId !== null && guard.threadId !== input.threadId)) {
          throw new WorkingMemoryValidationError(
            'Observational memory guard does not match the working-memory target.',
          );
        }
        const currentGeneration = this.db.observationalMemory.get(
          this.getObservationalMemoryKey(guard.threadId, guard.resourceId),
        )?.[0];
        if (currentGeneration?.id !== guard.recordId) {
          throw new WorkingMemoryValidationError('Observational memory generation is no longer current.');
        }
      }

      const now = new Date();
      if (input.scope === 'resource') {
        const resource = this.db.resources.get(input.resourceId);
        const current = readWorkingMemorySnapshot(resource?.workingMemory, resource?.metadata);
        const next = applyWorkingMemorySnapshotUpdate(current, input, now.toISOString());
        if (next === current) return current;
        this.db.resources.set(
          input.resourceId,
          cloneResourceBoundary(
            {
              id: input.resourceId,
              ...(next.value === null ? {} : { workingMemory: next.value }),
              metadata: writeWorkingMemorySnapshotMetadata(resource?.metadata, next),
              createdAt: resource?.createdAt ?? now,
              updatedAt: now,
            },
            true,
          ),
        );
        return next;
      }

      const thread = this.db.threads.get(input.threadId);
      if (!thread || thread.resourceId !== input.resourceId) {
        throw new WorkingMemoryValidationError('Working-memory thread was not found in the requested resource.');
      }
      const currentValue = typeof thread.metadata?.workingMemory === 'string' ? thread.metadata.workingMemory : null;
      const current = readWorkingMemorySnapshot(currentValue, thread.metadata);
      const next = applyWorkingMemorySnapshotUpdate(current, input, now.toISOString());
      if (next === current) return current;
      const metadata = writeWorkingMemorySnapshotMetadata(thread.metadata, next);
      if (next.value === null) delete metadata.workingMemory;
      else metadata.workingMemory = next.value;
      this.db.threads.set(input.threadId, cloneThreadBoundary({ ...thread, metadata, updatedAt: now }, true));
      this.rotateThreadGeneration(input.threadId);
      return next;
    });
  }

  async mutateThreadWithWorkingMemory(
    input: StorageMutateThreadWithWorkingMemoryInput,
  ): Promise<StorageMutateThreadWithWorkingMemoryOutput> {
    return this.withMemoryStateRollback(true, () => {
      const threadId = input.mutation.type === 'save' ? input.mutation.thread.id : input.mutation.id;
      const currentThread = this.db.threads.get(threadId);
      if (input.mutation.type === 'update' && !currentThread) {
        throw new Error(`Thread with id ${threadId} not found`);
      }

      const proposedMetadata =
        input.mutation.type === 'save' ? input.mutation.thread.metadata : input.mutation.metadata;
      assertThreadWorkingMemoryRemoved(proposedMetadata);

      const resourceId = input.mutation.type === 'save' ? input.mutation.thread.resourceId : currentThread!.resourceId;
      if (input.mutation.type === 'save' && currentThread) {
        assertGovernedThreadResourceUnchanged({
          currentResourceId: currentThread.resourceId,
          currentMetadata: currentThread.metadata,
          proposedResourceId: resourceId,
        });
      }
      if (input.workingMemory.type === 'observer-update' && input.workingMemory.resourceId !== resourceId) {
        throw new WorkingMemoryValidationError('Working-memory update does not match the mutated thread resource.');
      }

      let workingMemory: WorkingMemorySnapshot | undefined;
      let currentWorkingMemory: WorkingMemorySnapshot | undefined;
      if (input.workingMemory.type === 'require-ungoverned') {
        assertThreadWorkingMemoryIsUngoverned(currentThread?.metadata);
      } else {
        const currentValue =
          typeof currentThread?.metadata?.workingMemory === 'string' ? currentThread.metadata.workingMemory : null;
        currentWorkingMemory = readWorkingMemorySnapshot(currentValue, currentThread?.metadata);
        workingMemory = applyWorkingMemorySnapshotUpdate(
          currentWorkingMemory,
          {
            value: input.workingMemory.value,
            expectedRevision: input.workingMemory.expectedRevision,
            source: 'observer',
            ...(input.workingMemory.maxDataBytes === undefined
              ? {}
              : { maxDataBytes: input.workingMemory.maxDataBytes }),
          },
          new Date().toISOString(),
        );
      }

      const baseMetadata =
        input.mutation.type === 'save'
          ? preserveWorkingMemorySnapshotControls(currentThread?.metadata, input.mutation.thread.metadata ?? {})
          : input.mutation.metadata === undefined
            ? (currentThread!.metadata ?? {})
            : mergeThreadMetadataPreservingWorkingMemory(currentThread!.metadata, input.mutation.metadata);
      let metadata: Record<string, unknown>;
      if (input.workingMemory.type === 'require-ungoverned') {
        metadata = stripThreadWorkingMemoryMetadata(baseMetadata) ?? {};
      } else {
        metadata =
          workingMemory !== currentWorkingMemory || hasWorkingMemorySnapshotControls(currentThread?.metadata)
            ? writeWorkingMemorySnapshotMetadata(baseMetadata, workingMemory!)
            : { ...baseMetadata };
        if (workingMemory!.value === null) delete metadata.workingMemory;
        else metadata.workingMemory = workingMemory!.value;
      }

      const thread =
        input.mutation.type === 'save'
          ? cloneThreadBoundary({ ...input.mutation.thread, metadata }, true)
          : cloneThreadBoundary(
              {
                ...currentThread!,
                ...(input.mutation.title === undefined ? {} : { title: input.mutation.title }),
                metadata,
                updatedAt: new Date(),
              },
              true,
            );
      this.db.threads.set(threadId, thread);
      this.rotateThreadGeneration(threadId);
      return {
        thread: cloneThreadBoundary(thread),
        ...(workingMemory === undefined ? {} : { workingMemory: structuredClone(workingMemory) }),
      };
    });
  }

  async transitionThreadToResourceWorkingMemory(
    input: StorageTransitionThreadToResourceWorkingMemoryInput,
  ): Promise<StorageTransitionThreadToResourceWorkingMemoryOutput> {
    return this.withMemoryStateRollback(true, () => {
      const threadId = input.mutation.type === 'save' ? input.mutation.thread.id : input.mutation.id;
      const resourceId = input.mutation.type === 'save' ? input.mutation.thread.resourceId : input.mutation.resourceId;
      if (input.preparation.threadId !== threadId || input.preparation.resourceId !== resourceId) {
        throw new WorkingMemoryValidationError('Working-memory transition preparation does not match its target.');
      }
      const proposedMetadata =
        input.mutation.type === 'save' ? input.mutation.thread.metadata : input.mutation.metadata;
      assertThreadWorkingMemoryRemoved(proposedMetadata);

      const currentThread = this.db.threads.get(threadId);
      if (input.mutation.type === 'update' && !currentThread) {
        throw new Error(`Thread with id ${threadId} not found`);
      }
      if (currentThread && currentThread.resourceId !== resourceId) {
        throw new WorkingMemoryValidationError('Working-memory thread does not belong to the requested resource.');
      }
      const currentThreadValue =
        typeof currentThread?.metadata?.workingMemory === 'string' ? currentThread.metadata.workingMemory : null;
      const currentThreadSnapshot = readWorkingMemorySnapshot(currentThreadValue, currentThread?.metadata);
      assertWorkingMemoryTransitionParticipant(
        currentThreadSnapshot,
        readWorkingMemoryIncarnation(currentThread?.metadata),
        input.preparation.sourceThread,
      );

      const now = new Date();
      const currentResource = this.db.resources.get(resourceId);
      const current = readWorkingMemorySnapshot(currentResource?.workingMemory, currentResource?.metadata);
      assertWorkingMemoryTransitionParticipant(
        current,
        readWorkingMemoryIncarnation(currentResource?.metadata),
        input.preparation.destinationResource,
      );
      const next = applyWorkingMemorySnapshotUpdate(
        current,
        {
          value: input.value,
          expectedRevision: input.preparation.destinationResource.snapshot.revision,
          source: 'observer',
          ...(input.maxDataBytes === undefined ? {} : { maxDataBytes: input.maxDataBytes }),
        },
        now.toISOString(),
      );
      const resource = cloneResourceBoundary(
        {
          id: resourceId,
          workingMemory: next.value ?? undefined,
          metadata: writeWorkingMemorySnapshotMetadata(currentResource?.metadata, next),
          createdAt: currentResource?.createdAt ?? now,
          updatedAt: now,
        },
        true,
      );
      const thread =
        input.mutation.type === 'save'
          ? cloneThreadBoundary(input.mutation.thread, true)
          : cloneThreadBoundary(
              {
                ...currentThread!,
                ...(input.mutation.title === undefined ? {} : { title: input.mutation.title }),
                metadata: mergeThreadMetadataForWorkingMemoryTransition(
                  currentThread!.metadata,
                  input.mutation.metadata,
                ),
                updatedAt: now,
              },
              true,
            );
      this.db.resources.set(resource.id, resource);
      this.db.threads.set(thread.id, thread);
      this.rotateThreadGeneration(thread.id);
      return {
        thread: cloneThreadBoundary(thread),
        workingMemory: structuredClone(next),
      };
    });
  }

  async deleteResource({
    resourceId,
    observationalMemoryRecordIds,
  }: {
    resourceId: string;
    observationalMemoryRecordIds?: string[];
  }): Promise<void> {
    const resourceObservationalMemoryKey = this.getObservationalMemoryKey(null, resourceId);
    const erasedRecordIds = (this.db.observationalMemory.get(resourceObservationalMemoryKey) ?? []).map(
      record => record.id,
    );
    this.db.resources.delete(resourceId);
    // Resource erasure must not orphan the resource-scoped observational
    // memory record (thread-scoped records stay with their threads, which
    // deleteResource deliberately preserves).
    this.db.observationalMemory.delete(resourceObservationalMemoryKey);
    for (const recordId of erasedRecordIds) this.db.memoryObservationalGenerations.delete(recordId);
    observationalMemoryRecordIds?.push(...erasedRecordIds);
  }

  async copyThread(args: StorageCloneThreadInput): Promise<StorageCopyThreadOutput> {
    const { sourceThreadId, newThreadId: providedThreadId, resourceId, title, metadata, options } = args;

    // Get the source thread
    const sourceThread = this.db.threads.get(sourceThreadId);
    if (!sourceThread) {
      throw new Error(`Source thread with id ${sourceThreadId} not found`);
    }
    const sourceResourceId = sourceThread.resourceId;

    // Use provided ID or generate a new one
    const newThreadId = providedThreadId || crypto.randomUUID();

    // Check if the new thread ID already exists
    if (this.db.threads.has(newThreadId)) {
      throw new Error(`Thread with id ${newThreadId} already exists`);
    }

    // Get messages from the source thread
    let sourceMessages = Array.from(this.db.messages.values())
      .filter((msg: StorageMessageType) => msg.thread_id === sourceThreadId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Apply message filters if provided
    if (options?.messageFilter) {
      const { startDate, endDate, messageIds } = options.messageFilter;

      if (messageIds && messageIds.length > 0) {
        const messageIdSet = new Set(messageIds);
        sourceMessages = sourceMessages.filter(msg => messageIdSet.has(msg.id));
      }

      if (startDate) {
        sourceMessages = sourceMessages.filter(msg => new Date(msg.createdAt) >= startDate);
      }

      if (endDate) {
        sourceMessages = sourceMessages.filter(msg => new Date(msg.createdAt) <= endDate);
      }
    }

    // Apply message limit (take from the end to get most recent)
    if (options?.messageLimit && options.messageLimit > 0 && sourceMessages.length > options.messageLimit) {
      sourceMessages = sourceMessages.slice(-options.messageLimit);
    }

    const now = new Date();

    // Determine the last message ID for clone metadata
    const lastMessageId = sourceMessages.length > 0 ? sourceMessages[sourceMessages.length - 1]!.id : undefined;

    // Create clone metadata
    const cloneMetadata: ThreadCloneMetadata = {
      sourceThreadId,
      clonedAt: now,
      ...(lastMessageId && { lastMessageId }),
    };

    // Create the new thread
    const newThread: StorageThreadType = {
      id: newThreadId,
      resourceId: resourceId || sourceResourceId,
      title: title || (sourceThread.title ? `Clone of ${sourceThread.title}` : undefined),
      metadata: reincarnateWorkingMemorySnapshotMetadata({
        ...metadata,
        clone: cloneMetadata,
      }),
      createdAt: now,
      updatedAt: now,
    };

    return this.withMemoryStateRollback(true, () => {
      // Save the new thread
      const storedThread = cloneThreadBoundary(newThread, true);
      this.db.threads.set(newThreadId, storedThread);

      // Copy raw storage rows under new IDs; payloads are never parsed here.
      const messageIdMap: Record<string, string> = {};
      const targetResourceId = resourceId || sourceResourceId;
      for (const sourceMsg of sourceMessages) {
        const newMessageId = crypto.randomUUID();
        messageIdMap[sourceMsg.id] = newMessageId;

        this.db.messages.set(newMessageId, {
          id: newMessageId,
          thread_id: newThreadId,
          content: sourceMsg.content,
          role: sourceMsg.role,
          type: sourceMsg.type,
          createdAt: new Date(sourceMsg.createdAt),
          resourceId: targetResourceId,
        });
      }

      const clonedMessageIds = Object.values(messageIdMap);
      return {
        thread: cloneThreadBoundary(storedThread, true),
        messageIdMap,
        sourceResourceId,
        rollbackReceipt: {
          threadId: newThreadId,
          storageGeneration: this.rotateThreadGeneration(newThreadId),
          clonedMessageIds,
        },
      };
    });
  }

  async rollbackThreadClone(input: StorageRollbackThreadCloneInput): Promise<StorageRollbackThreadCloneResult> {
    return this.withMemoryStateRollback(true, () => {
      const { thread: receipt, observationalMemory, unverifiedObservationalMemoryRecordId } = input;
      if (
        !this.db.threads.has(receipt.threadId) ||
        this.db.memoryThreadGenerations.get(receipt.threadId) !== receipt.storageGeneration
      ) {
        return { status: 'conflict', reason: 'thread' };
      }

      const expectedMessageIds = [...receipt.clonedMessageIds].sort();
      const currentMessageIds = [...this.db.messages.values()]
        .filter(message => message.thread_id === receipt.threadId)
        .map(message => message.id)
        .sort();
      if (
        expectedMessageIds.length !== currentMessageIds.length ||
        expectedMessageIds.some((messageId, index) => messageId !== currentMessageIds[index])
      ) {
        return { status: 'conflict', reason: 'messages' };
      }

      if (unverifiedObservationalMemoryRecordId && !observationalMemory) {
        if (this.findObservationalMemoryRecordById(unverifiedObservationalMemoryRecordId)) {
          return { status: 'conflict', reason: 'observational_memory' };
        }
      }

      if (observationalMemory) {
        if (
          unverifiedObservationalMemoryRecordId &&
          observationalMemory.recordId !== unverifiedObservationalMemoryRecordId
        ) {
          return { status: 'conflict', reason: 'observational_memory' };
        }
        const key = this.getObservationalMemoryKey(observationalMemory.threadId, observationalMemory.resourceId);
        const currentRecords = this.db.observationalMemory.get(key) ?? [];
        const expectedRecordIds = [...observationalMemory.priorRecordIds, observationalMemory.recordId].sort();
        const currentRecordIds = currentRecords.map(record => record.id).sort();
        if (
          expectedRecordIds.length !== currentRecordIds.length ||
          expectedRecordIds.some((recordId, index) => recordId !== currentRecordIds[index]) ||
          this.db.memoryObservationalGenerations.get(observationalMemory.recordId) !==
            observationalMemory.storageGeneration
        ) {
          return { status: 'conflict', reason: 'observational_memory' };
        }
      } else {
        const threadRecords = this.db.observationalMemory.get(
          this.getObservationalMemoryKey(receipt.threadId, this.db.threads.get(receipt.threadId)!.resourceId),
        );
        if (threadRecords?.length) return { status: 'conflict', reason: 'observational_memory' };
      }

      if (observationalMemory) {
        const key = this.getObservationalMemoryKey(observationalMemory.threadId, observationalMemory.resourceId);
        const remaining = (this.db.observationalMemory.get(key) ?? []).filter(
          record => record.id !== observationalMemory.recordId,
        );
        if (remaining.length > 0) this.db.observationalMemory.set(key, remaining);
        else this.db.observationalMemory.delete(key);
        this.db.memoryObservationalGenerations.delete(observationalMemory.recordId);
      }
      for (const messageId of expectedMessageIds) this.db.messages.delete(messageId);
      this.db.threads.delete(receipt.threadId);
      this.db.memoryThreadGenerations.delete(receipt.threadId);
      return { status: 'rolled_back' };
    });
  }

  private sortThreads(threads: any[], field: ThreadOrderBy, direction: ThreadSortDirection): any[] {
    return threads.sort((a, b) => {
      const isDateField = field === 'createdAt' || field === 'updatedAt';
      const aValue = isDateField ? new Date(a[field]).getTime() : a[field];
      const bValue = isDateField ? new Date(b[field]).getTime() : b[field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (direction === 'ASC') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  // ============================================
  // Observational Memory Implementation
  // ============================================

  private getObservationalMemoryKey(threadId: string | null, resourceId: string): string {
    if (threadId) {
      return `thread:${threadId}`;
    }
    return `resource:${resourceId}`;
  }

  private resolveObservationalMemoryRetractionInput(
    threadId: string,
    fallbackResourceId?: string,
  ): RetractObservationalMemoryInput | null {
    const threadRecords = this.db.observationalMemory.get(this.getObservationalMemoryKey(threadId, '')) ?? [];
    const resourceId = threadRecords[0]?.resourceId ?? fallbackResourceId ?? this.db.threads.get(threadId)?.resourceId;
    return resourceId ? { resourceId, threadId } : null;
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key);
    return records?.[0] ? cloneObservationalMemoryBoundary(records[0]) : null;
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit?: number,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    let records = this.db.observationalMemory.get(key) ?? [];

    if (options?.from) {
      records = records.filter(r => r.createdAt >= options.from!);
    }
    if (options?.to) {
      records = records.filter(r => r.createdAt <= options.to!);
    }
    if (options?.offset != null) {
      records = records.slice(options.offset);
    }

    const selected = limit != null ? records.slice(0, limit) : records;
    return selected.map(record => cloneObservationalMemoryBoundary(record));
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    const { threadId, resourceId, scope, config, observedTimezone } = input;
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const now = new Date();

    const record: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope,
      threadId,
      resourceId,
      // Timestamps at top level
      createdAt: now,
      updatedAt: now,
      // lastObservedAt starts undefined - all messages are "unobserved" initially
      // This ensures historical data (like LongMemEval fixtures) works correctly
      lastObservedAt: undefined,
      originType: 'initial',
      generationCount: 0,
      activeObservations: '',
      // Buffering (for async observation/reflection)
      bufferedObservations: undefined,
      bufferedReflection: undefined,
      // Message tracking
      // Note: Message ID tracking removed in favor of cursor-based lastObservedAt
      // Token tracking
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      // State flags
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      // Configuration
      config,
      // Timezone used for observation date formatting
      observedTimezone,
      // Extensible metadata (optional)
      metadata: {},
    };

    const stored = cloneObservationalMemoryBoundary(record, false);

    // Add as first record (most recent)
    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [stored, ...existing]);
    this.rotateObservationalMemoryGeneration(stored.id);

    return cloneObservationalMemoryBoundary(stored);
  }

  async insertObservationalMemoryRecord(
    record: ObservationalMemoryRecord,
  ): Promise<StorageObservationalMemoryCloneReceipt> {
    const stored = cloneObservationalMemoryBoundary(record, false);
    const key = this.getObservationalMemoryKey(stored.threadId, stored.resourceId);
    const existing = this.db.observationalMemory.get(key) ?? [];
    const priorRecordIds = existing.map(existingRecord => existingRecord.id);
    // Insert in order by generationCount descending (newest first)
    let inserted = false;
    for (let i = 0; i < existing.length; i++) {
      if (stored.generationCount >= existing[i]!.generationCount) {
        existing.splice(i, 0, stored);
        inserted = true;
        break;
      }
    }
    if (!inserted) existing.push(stored);
    this.db.observationalMemory.set(key, existing);
    return {
      recordId: stored.id,
      threadId: stored.threadId,
      resourceId: stored.resourceId,
      storageGeneration: this.rotateObservationalMemoryGeneration(stored.id),
      priorRecordIds,
    };
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    const { id, observations, tokenCount, lastObservedAt, observedMessageIds } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.activeObservations = observations;
    record.observationTokenCount = tokenCount;
    record.totalTokensObserved += tokenCount;
    // Reset pending tokens since we've now observed them
    record.pendingMessageTokens = 0;

    // Update timestamps (top-level, not in metadata)
    record.lastObservedAt = new Date(lastObservedAt);
    record.updatedAt = new Date();

    // Store observed message IDs as safeguard against re-observation
    if (observedMessageIds) {
      record.observedMessageIds = [...observedMessageIds];
    }
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    const { id, chunk } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const existingChunks = Array.isArray(record.bufferedObservationChunks) ? record.bufferedObservationChunks : [];
    if (existingChunks.some(existing => existing.cycleId === chunk.cycleId)) return;

    // Create a new chunk with generated id and timestamp
    const newChunk: BufferedObservationChunk = cloneMemoryBoundaryValue({
      id: `ombuf-${crypto.randomUUID()}`,
      cycleId: chunk.cycleId,
      observations: chunk.observations,
      tokenCount: chunk.tokenCount,
      messageIds: chunk.messageIds,
      messageTokens: chunk.messageTokens,
      lastObservedAt: chunk.lastObservedAt,
      createdAt: new Date(),
      suggestedContinuation: chunk.suggestedContinuation,
      currentTask: chunk.currentTask,
      threadTitle: chunk.threadTitle,
      extractedValues: chunk.extractedValues,
      extractionFailures: chunk.extractionFailures,
    });

    // Add chunk to the array
    record.bufferedObservationChunks = [...existingChunks, newChunk];

    if (input.lastBufferedAtTime) {
      record.lastBufferedAtTime = new Date(input.lastBufferedAtTime);
    }

    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    const { id, activationRatio, lastObservedAt } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    // Use caller-provided refreshed chunks (with up-to-date token weights) for
    // activation math, falling back to persisted chunks otherwise.
    // Keep refreshed chunks local — don't overwrite the stored buffer.
    const persistedChunks = Array.isArray(record.bufferedObservationChunks) ? record.bufferedObservationChunks : [];
    const chunks = Array.isArray(input.bufferedChunks)
      ? cloneMemoryBoundaryValue(input.bufferedChunks)
      : persistedChunks;
    if (chunks.length === 0) {
      return {
        chunksActivated: 0,
        messageTokensActivated: 0,
        observationTokensActivated: 0,
        messagesActivated: 0,
        activatedCycleIds: [],
        activatedMessageIds: [],
      };
    }

    // Calculate target: how many message tokens to remove so that
    // (1 - activationRatio) * threshold worth of raw messages remain.
    // e.g., ratio=0.8, threshold=5000, pending=6000 → remove 6000 - 1000 = 5000
    const retentionFloor = input.messageTokensThreshold * (1 - activationRatio);
    const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

    // Find the closest chunk boundary to the target, biased over (prefer removing
    // slightly more than the target so remaining context lands at or below retentionFloor).
    // Track both best-over and best-under boundaries so we can fall back to under
    // if the over boundary would overshoot by too much.
    let cumulativeMessageTokens = 0;
    let bestOverBoundary = 0;
    let bestOverTokens = 0;
    let bestUnderBoundary = 0;
    let bestUnderTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      cumulativeMessageTokens += chunks[i]!.messageTokens ?? 0;
      const boundary = i + 1;

      if (cumulativeMessageTokens >= targetMessageTokens) {
        // Over or equal — track the closest (lowest) over boundary
        if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
          bestOverBoundary = boundary;
          bestOverTokens = cumulativeMessageTokens;
        }
      } else {
        // Under — track the closest (highest) under boundary
        if (cumulativeMessageTokens > bestUnderTokens) {
          bestUnderBoundary = boundary;
          bestUnderTokens = cumulativeMessageTokens;
        }
      }
    }

    // Safeguard: if the over boundary would eat into more than 95% of the
    // retention floor, fall back to the best under boundary instead.
    // This prevents edge cases where a large chunk overshoots dramatically.
    // When forceMaxActivation is set (above blockAfter), still prefer the over
    // boundary, but never if it would leave fewer than the smaller of 1000
    // tokens or the retention floor remaining.
    const maxOvershoot = retentionFloor * 0.95;
    const overshoot = bestOverTokens - targetMessageTokens;
    const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
    const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
    // When activationRatio ≈ 1.0, retentionFloor is 0 and minRemaining becomes 0 — intentional for "activate everything" configs.
    const minRemaining = Math.min(1000, retentionFloor);

    let chunksToActivate: number;
    if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
      chunksToActivate = bestOverBoundary;
    } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
      chunksToActivate = bestOverBoundary;
    } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
      chunksToActivate = bestUnderBoundary;
    } else if (bestOverBoundary > 0) {
      // All boundaries are over and exceed the safeguard — still activate
      // the closest over boundary (better than nothing)
      chunksToActivate = bestOverBoundary;
    } else {
      chunksToActivate = 1;
    }
    const activatedChunks = chunks.slice(0, chunksToActivate);
    const remainingChunks = chunks.slice(chunksToActivate);

    // Combine activated chunks into content
    const activatedContent = activatedChunks.map(c => c.observations).join('\n\n');
    const activatedTokens = activatedChunks.reduce((sum, c) => sum + c.tokenCount, 0);
    const activatedMessageTokens = activatedChunks.reduce((sum, c) => sum + (c.messageTokens ?? 0), 0);
    const activatedMessageCount = activatedChunks.reduce((sum, c) => sum + c.messageIds.length, 0);
    const activatedCycleIds = activatedChunks.map(c => c.cycleId).filter((id): id is string => !!id);
    const activatedMessageIds = activatedChunks.flatMap(c => c.messageIds);

    // Derive lastObservedAt from the latest activated chunk, or use provided value
    const latestChunk = activatedChunks[activatedChunks.length - 1];
    const derivedLastObservedAt = lastObservedAt
      ? new Date(lastObservedAt)
      : latestChunk?.lastObservedAt
        ? new Date(latestChunk.lastObservedAt)
        : new Date();

    // Append activated content to active observations with message boundary for cache stability
    if (record.activeObservations) {
      const boundary = `\n\n--- message boundary (${derivedLastObservedAt.toISOString()}) ---\n\n`;
      record.activeObservations = `${record.activeObservations}${boundary}${activatedContent}`;
    } else {
      record.activeObservations = activatedContent;
    }

    // Update observation token count
    record.observationTokenCount = (record.observationTokenCount ?? 0) + activatedTokens;

    // Decrement pending message tokens (clamped to zero)
    record.pendingMessageTokens = Math.max(0, (record.pendingMessageTokens ?? 0) - activatedMessageTokens);

    // NOTE: We intentionally do NOT add activatedMessageIds to record.observedMessageIds.
    // observedMessageIds is used by getUnobservedMessages to filter future messages.
    // Since AI SDK may reuse message IDs for new content, adding them here would
    // permanently block new content from being observed. Instead, we return
    // activatedMessageIds so the caller can remove them from messageList directly.

    // Update buffered state with remaining chunks
    record.bufferedObservationChunks = remainingChunks.length > 0 ? remainingChunks : undefined;

    // Update timestamps
    record.lastObservedAt = derivedLastObservedAt;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);

    // Use hints from the most recent activated chunk only — stale hints from older chunks are discarded
    const latestChunkHints = activatedChunks[activatedChunks.length - 1];

    return {
      chunksActivated: activatedChunks.length,
      messageTokensActivated: activatedMessageTokens,
      observationTokensActivated: activatedTokens,
      messagesActivated: activatedMessageCount,
      activatedCycleIds,
      activatedMessageIds,
      observations: activatedContent,
      perChunk: activatedChunks.map(c => ({
        cycleId: c.cycleId ?? '',
        messageTokens: c.messageTokens ?? 0,
        observationTokens: c.tokenCount,
        messageCount: c.messageIds.length,
        observations: c.observations,
      })),
      suggestedContinuation: latestChunkHints?.suggestedContinuation ?? undefined,
      currentTask: latestChunkHints?.currentTask ?? undefined,
    };
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord, reflection, tokenCount } = input;
    const key = this.getObservationalMemoryKey(currentRecord.threadId, currentRecord.resourceId);
    if (this.db.observationalMemory.get(key)?.[0]?.id !== currentRecord.id) {
      throw new Error('Observational memory generation is no longer current.');
    }
    const now = new Date();

    const newRecord: ObservationalMemoryRecord = {
      id: crypto.randomUUID(),
      scope: currentRecord.scope,
      threadId: currentRecord.threadId,
      resourceId: currentRecord.resourceId,
      // Timestamps at top level
      createdAt: now,
      updatedAt: now,
      lastObservedAt: currentRecord.lastObservedAt ?? now, // Carry over from observation (which always runs before reflection)
      originType: 'reflection',
      generationCount: currentRecord.generationCount + 1,
      activeObservations: reflection,
      config: currentRecord.config,
      totalTokensObserved: currentRecord.totalTokensObserved,
      observationTokenCount: tokenCount,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      // Timezone used for observation date formatting
      observedTimezone: currentRecord.observedTimezone,
      // Extensible metadata (optional)
      metadata: {},
    };

    const stored = cloneObservationalMemoryBoundary(newRecord, false);

    // Add as first record (most recent)
    const existing = this.db.observationalMemory.get(key) ?? [];
    this.db.observationalMemory.set(key, [stored, ...existing]);
    this.rotateObservationalMemoryGeneration(stored.id);

    return cloneObservationalMemoryBoundary(stored);
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    const { id, reflection, tokenCount, inputTokenCount, reflectedObservationLineCount } = input;
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    const existing = record.bufferedReflection || '';
    record.bufferedReflection = existing ? `${existing}\n\n${reflection}` : reflection;
    record.bufferedReflectionTokens = (record.bufferedReflectionTokens || 0) + tokenCount;
    record.bufferedReflectionInputTokens = (record.bufferedReflectionInputTokens || 0) + inputTokenCount;
    record.reflectedObservationLineCount = reflectedObservationLineCount;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    const { currentRecord } = input;
    const record = this.findObservationalMemoryRecordById(currentRecord.id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${currentRecord.id}`);
    }

    if (!record.bufferedReflection) {
      throw new Error('No buffered reflection to swap');
    }

    const bufferedReflection = record.bufferedReflection;
    const reflectedLineCount = record.reflectedObservationLineCount ?? 0;

    // Split current activeObservations by the boundary line count.
    // Lines 0..reflectedLineCount were reflected on → replaced by bufferedReflection.
    // Lines after reflectedLineCount were added after reflection started → kept as-is.
    const currentObservations = record.activeObservations ?? '';
    const allLines = currentObservations.split('\n');
    const unreflectedLines = allLines.slice(reflectedLineCount);
    const unreflectedContent = unreflectedLines.join('\n').trim();

    // New activeObservations = bufferedReflection + unreflected observations
    const newObservations = unreflectedContent ? `${bufferedReflection}\n\n${unreflectedContent}` : bufferedReflection;

    // Create a new generation with the merged content.
    // tokenCount is computed by the processor using its token counter on the combined content.
    const newRecord = await this.createReflectionGeneration({
      currentRecord: record,
      reflection: newObservations,
      tokenCount: input.tokenCount,
    });

    // Clear buffered state on old record
    record.bufferedReflection = undefined;
    record.bufferedReflectionTokens = undefined;
    record.bufferedReflectionInputTokens = undefined;
    record.reflectedObservationLineCount = undefined;
    this.rotateObservationalMemoryGeneration(record.id);

    return newRecord;
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isReflecting = isReflecting;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isObserving = isObserving;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isBufferingObservation = isBuffering;
    if (lastBufferedAtTokens !== undefined) {
      record.lastBufferedAtTokens = lastBufferedAtTokens;
    }
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.isBufferingReflection = isBuffering;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async clearObservationalMemory(
    threadId: string | null,
    resourceId: string,
    options?: ClearObservationalMemoryOptions,
  ): Promise<void> {
    const key = this.getObservationalMemoryKey(threadId, resourceId);
    const records = this.db.observationalMemory.get(key) ?? [];
    assertObservationalMemoryClearExpectation(records[0] ?? null, resourceId, options);
    this.forgetObservationalMemoryGenerations(records);
    this.db.observationalMemory.delete(key);
  }

  private retractObservationalMemoryState(input: RetractObservationalMemoryInput): RetractObservationalMemoryResult {
    const resourceKey = this.getObservationalMemoryKey(null, input.resourceId);
    const threadKey = this.getObservationalMemoryKey(input.threadId, input.resourceId);
    const resourceRecords = this.db.observationalMemory.get(resourceKey) ?? [];
    const threadRecords = this.db.observationalMemory.get(threadKey) ?? [];
    const clearedScopes: Array<'resource' | 'thread'> = [];
    if (resourceRecords.length > 0) clearedScopes.push('resource');
    if (threadRecords.length > 0) clearedScopes.push('thread');
    this.forgetObservationalMemoryGenerations(resourceRecords);
    this.forgetObservationalMemoryGenerations(threadRecords);
    this.db.observationalMemory.delete(resourceKey);
    this.db.observationalMemory.delete(threadKey);

    const resourceManagedWorkingMemoryScopes = getManagedWorkingMemoryScopes(resourceRecords);
    const threadManagedWorkingMemoryScopes = getManagedWorkingMemoryScopes(threadRecords);
    const resource = this.db.resources.get(input.resourceId);
    let clearedResourceWorkingMemory = false;
    if (
      resource &&
      (resourceManagedWorkingMemoryScopes.has('resource') || threadManagedWorkingMemoryScopes.has('resource')) &&
      (resource.workingMemory !== undefined || hasWorkingMemorySnapshotControls(resource.metadata))
    ) {
      if (hasWorkingMemorySnapshotControls(resource.metadata)) {
        const current = readWorkingMemorySnapshot(resource.workingMemory, resource.metadata);
        const next = retractObserverWorkingMemorySnapshot(current);
        clearedResourceWorkingMemory = next.value !== current.value;
        if (next !== current) {
          this.db.resources.set(input.resourceId, {
            ...resource,
            workingMemory: next.value ?? undefined,
            metadata: writeWorkingMemorySnapshotMetadata(resource.metadata, next),
            updatedAt: new Date(),
          });
        }
      } else {
        clearedResourceWorkingMemory = true;
        this.db.resources.set(input.resourceId, {
          ...resource,
          workingMemory: undefined,
          updatedAt: new Date(),
        });
      }
    }

    let clearedThreadMetadata = false;
    const threads =
      resourceRecords.length > 0
        ? [...this.db.threads.values()].filter(thread => thread.resourceId === input.resourceId)
        : threadRecords.length > 0
          ? [this.db.threads.get(input.threadId)].filter((thread): thread is StorageThreadType => thread !== undefined)
          : [];
    for (const thread of threads) {
      const clearWorkingMemory =
        resourceManagedWorkingMemoryScopes.has('thread') ||
        (thread.id === input.threadId && threadManagedWorkingMemoryScopes.has('thread'));
      const hasControls = clearWorkingMemory && hasWorkingMemorySnapshotControls(thread.metadata);
      const cleaned = removeObservationalMemoryMetadata(thread.metadata, clearWorkingMemory && !hasControls);
      let metadata = cleaned.metadata;
      let workingMemoryStateChanged = false;
      if (hasControls) {
        const currentValue = typeof thread.metadata?.workingMemory === 'string' ? thread.metadata.workingMemory : null;
        const current = readWorkingMemorySnapshot(currentValue, thread.metadata);
        const next = retractObserverWorkingMemorySnapshot(current);
        workingMemoryStateChanged = next !== current;
        metadata = writeWorkingMemorySnapshotMetadata(metadata, next);
        if (next.value === null) delete metadata.workingMemory;
        else metadata.workingMemory = next.value;
      }
      if (!cleaned.removed && !workingMemoryStateChanged) continue;
      clearedThreadMetadata = true;
      this.db.threads.set(thread.id, {
        ...thread,
        title: cleaned.derivedTitle === thread.title ? '' : thread.title,
        metadata,
        updatedAt: new Date(),
      });
      this.rotateThreadGeneration(thread.id);
    }

    return {
      clearedScopes,
      clearedResourceWorkingMemory,
      clearedThreadMetadata,
    };
  }

  async retractObservationalMemory(input: RetractObservationalMemoryInput): Promise<RetractObservationalMemoryResult> {
    return this.withMemoryStateRollback(true, () => this.retractObservationalMemoryState(input));
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    const record = this.findObservationalMemoryRecordById(id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${id}`);
    }

    record.pendingMessageTokens = tokenCount;
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    const record = this.findObservationalMemoryRecordById(input.id);
    if (!record) {
      throw new Error(`Observational memory record not found: ${input.id}`);
    }

    record.config = cloneMemoryBoundaryValue(
      this.deepMergeConfig(record.config as Record<string, unknown>, cloneMemoryBoundaryValue(input.config)),
    );
    record.updatedAt = new Date();
    this.rotateObservationalMemoryGeneration(record.id);
  }

  /**
   * Helper to find an observational memory record by ID across all keys
   */
  private findObservationalMemoryRecordById(id: string): ObservationalMemoryRecord | null {
    for (const records of this.db.observationalMemory.values()) {
      const record = records.find(r => r.id === id);
      if (record) return record;
    }
    return null;
  }
}
