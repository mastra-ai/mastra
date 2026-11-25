import {
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_METADATA_KEYS,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
  createThreadBranchError,
} from '@mastra/core/memory';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type { InternalThreadBranchMetadata, MemoryStorage, PublicThreadBranchMetadata } from '@mastra/core/storage';

export const MAX_THREAD_BRANCH_DEPTH = 100;

const CHILD_THREAD_PAGE_SIZE = 100;

export type MessageTuple = {
  createdAt: Date;
  id: string;
};

export type ResolvedThreadLineageEntry = {
  thread: StorageThreadType;
  branch: InternalThreadBranchMetadata | null;
};

export type ResolvedThreadLineage = {
  entries: ResolvedThreadLineageEntry[];
  messages: MastraDBMessage[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', `Stored thread branch field "${field}" is invalid.`);
  }
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', `Stored thread branch field "${field}" is invalid.`);
  }
  return date;
}

export function compareMessageTuples(a: MessageTuple, b: MessageTuple): number {
  const timeDifference = a.createdAt.getTime() - b.createdAt.getTime();
  return timeDifference === 0 ? a.id.localeCompare(b.id) : timeDifference;
}

export function parseThreadBranchMetadata(thread: StorageThreadType): InternalThreadBranchMetadata | null {
  const raw = thread.metadata?.[MASTRA_THREAD_BRANCH_METADATA_KEY];
  const indexedParent = thread.metadata?.[MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY];
  const indexedState = thread.metadata?.[MASTRA_THREAD_BRANCH_STATE_METADATA_KEY];
  if (raw === undefined) {
    if (indexedParent !== undefined || indexedState !== undefined) {
      throw createThreadBranchError(
        'BRANCH_LINEAGE_CORRUPT',
        `Stored branch lineage for thread "${thread.id}" is invalid.`,
      );
    }
    return null;
  }
  if (!isRecord(raw)) {
    throw createThreadBranchError(
      'BRANCH_LINEAGE_CORRUPT',
      `Stored branch lineage for thread "${thread.id}" is invalid.`,
    );
  }

  const allowedKeys = new Set([
    'parentThreadId',
    'branchPointMessageId',
    'branchPointCreatedAt',
    'branchCreatedAt',
    'observationalMemoryThreadId',
    'state',
  ]);
  if (Object.keys(raw).some(key => !allowedKeys.has(key))) {
    throw createThreadBranchError(
      'BRANCH_LINEAGE_CORRUPT',
      `Stored branch lineage for thread "${thread.id}" is invalid.`,
    );
  }
  if (
    typeof raw.parentThreadId !== 'string' ||
    raw.parentThreadId.length === 0 ||
    typeof raw.branchPointMessageId !== 'string' ||
    raw.branchPointMessageId.length === 0 ||
    typeof raw.observationalMemoryThreadId !== 'string' ||
    raw.observationalMemoryThreadId.length === 0 ||
    (raw.state !== 'pending' && raw.state !== 'ready') ||
    indexedParent !== raw.parentThreadId ||
    indexedState !== raw.state
  ) {
    throw createThreadBranchError(
      'BRANCH_LINEAGE_CORRUPT',
      `Stored branch lineage for thread "${thread.id}" is invalid.`,
    );
  }

  return {
    parentThreadId: raw.parentThreadId,
    branchPointMessageId: raw.branchPointMessageId,
    branchPointCreatedAt: parseDate(raw.branchPointCreatedAt, 'branchPointCreatedAt'),
    branchCreatedAt: parseDate(raw.branchCreatedAt, 'branchCreatedAt'),
    observationalMemoryThreadId: raw.observationalMemoryThreadId,
    state: raw.state,
  };
}

export function serializeThreadBranchMetadata(branch: InternalThreadBranchMetadata): Record<string, unknown> {
  return {
    parentThreadId: branch.parentThreadId,
    branchPointMessageId: branch.branchPointMessageId,
    branchPointCreatedAt: branch.branchPointCreatedAt.toISOString(),
    branchCreatedAt: branch.branchCreatedAt.toISOString(),
    observationalMemoryThreadId: branch.observationalMemoryThreadId,
    state: branch.state,
  };
}

/**
 * The thread metadata entries that store `branch`: the lineage record plus top-level copies of its
 * parent and state, which `listThreads` metadata filters use to find a thread's branches.
 */
export function threadBranchMetadataFields(branch: InternalThreadBranchMetadata): Record<string, unknown> {
  return {
    [MASTRA_THREAD_BRANCH_METADATA_KEY]: serializeThreadBranchMetadata(branch),
    [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: branch.parentThreadId,
    [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: branch.state,
  };
}

export function toPublicThreadBranchMetadata(branch: InternalThreadBranchMetadata): PublicThreadBranchMetadata {
  return {
    parentThreadId: branch.parentThreadId,
    branchPointMessageId: branch.branchPointMessageId,
    branchPointCreatedAt: new Date(branch.branchPointCreatedAt),
    branchCreatedAt: new Date(branch.branchCreatedAt),
  };
}

export function sanitizeThread(thread: StorageThreadType): StorageThreadType {
  const ownedKeys = MASTRA_THREAD_BRANCH_METADATA_KEYS.filter(
    (key: string) => thread.metadata && Object.prototype.hasOwnProperty.call(thread.metadata, key),
  );
  if (!thread.metadata || ownedKeys.length === 0) {
    return { ...thread, metadata: thread.metadata ? { ...thread.metadata } : thread.metadata };
  }
  const metadata = { ...thread.metadata };
  for (const key of ownedKeys) delete metadata[key];
  return { ...thread, metadata: Object.keys(metadata).length > 0 ? metadata : undefined };
}

export function isPendingThread(thread: StorageThreadType): boolean {
  return parseThreadBranchMetadata(thread)?.state === 'pending';
}

async function loadPhysicalMessages(memoryStore: MemoryStorage, thread: StorageThreadType): Promise<MastraDBMessage[]> {
  const { messages } = await memoryStore.listMessages({
    threadId: thread.id,
    resourceId: thread.resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  });
  if (messages.some(message => message.threadId !== thread.id || message.resourceId !== thread.resourceId)) {
    throw createThreadBranchError(
      'BRANCH_LINEAGE_CORRUPT',
      `Thread "${thread.id}" contains a message with invalid ownership.`,
    );
  }
  return messages.sort(compareMessageTuples);
}

export async function resolveThreadLineageEntries(
  memoryStore: MemoryStorage,
  threadId: string,
  options: { includePending?: boolean } = {},
): Promise<ResolvedThreadLineageEntry[]> {
  const reverseEntries: ResolvedThreadLineageEntry[] = [];
  const visited = new Set<string>();
  let currentId: string | undefined = threadId;
  let resourceId: string | undefined;
  let depth = 0;

  while (currentId) {
    if (visited.has(currentId)) {
      throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch lineage contains a cycle.');
    }
    if (depth > MAX_THREAD_BRANCH_DEPTH) {
      throw createThreadBranchError(
        'BRANCH_INVALID_REQUEST',
        `Thread branch ancestry exceeds the maximum depth of ${MAX_THREAD_BRANCH_DEPTH}.`,
      );
    }
    visited.add(currentId);

    const thread = await memoryStore.getThreadById({ threadId: currentId });
    if (!thread) {
      throw createThreadBranchError('BRANCH_NOT_FOUND', 'The requested thread branch is unavailable.');
    }
    const branch = parseThreadBranchMetadata(thread);
    if (branch && branch.observationalMemoryThreadId !== thread.id) {
      throw createThreadBranchError(
        'BRANCH_LINEAGE_CORRUPT',
        'Stored thread branch lineage contains an invalid Observational Memory locator.',
      );
    }
    if (branch?.state === 'pending' && !options.includePending) {
      throw createThreadBranchError('BRANCH_NOT_FOUND', 'The requested thread branch is unavailable.');
    }
    resourceId ??= thread.resourceId;
    if (thread.resourceId !== resourceId) {
      throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch lineage crosses resources.');
    }

    reverseEntries.push({ thread, branch });
    currentId = branch?.parentThreadId;
    depth += 1;
  }

  return reverseEntries.reverse();
}

export async function resolveThreadLineage(
  memoryStore: MemoryStorage,
  threadId: string,
  options: { includePending?: boolean } = {},
): Promise<ResolvedThreadLineage> {
  const entries = await resolveThreadLineageEntries(memoryStore, threadId, options);
  let reachableMessages: MastraDBMessage[] = [];
  for (const entry of entries) {
    const physicalMessages = await loadPhysicalMessages(memoryStore, entry.thread);
    if (!entry.branch) {
      reachableMessages = physicalMessages;
      continue;
    }

    const branchPoint = reachableMessages.find(message => message.id === entry.branch!.branchPointMessageId);
    if (
      !branchPoint ||
      branchPoint.createdAt.getTime() !== entry.branch.branchPointCreatedAt.getTime() ||
      branchPoint.resourceId !== entry.thread.resourceId
    ) {
      throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch point is not reachable.');
    }

    const cutoff = { createdAt: entry.branch.branchPointCreatedAt, id: entry.branch.branchPointMessageId };
    const invalidPhysicalMessage = physicalMessages.find(message => compareMessageTuples(message, cutoff) <= 0);
    if (invalidPhysicalMessage) {
      throw createThreadBranchError(
        'BRANCH_LINEAGE_CORRUPT',
        `Thread "${entry.thread.id}" contains a message outside its branch segment.`,
      );
    }

    reachableMessages = reachableMessages
      .filter(message => compareMessageTuples(message, cutoff) <= 0)
      .concat(physicalMessages)
      .sort(compareMessageTuples);
  }

  return { entries, messages: reachableMessages };
}

function compareThreadsByCreation(a: StorageThreadType, b: StorageThreadType): number {
  const timeDifference = a.createdAt.getTime() - b.createdAt.getTime();
  return timeDifference === 0 ? a.id.localeCompare(b.id) : timeDifference;
}

type ThreadRef = Pick<StorageThreadType, 'id' | 'resourceId'>;

function childThreadFilter(parent: ThreadRef, state?: 'pending' | 'ready') {
  return {
    resourceId: parent.resourceId,
    metadata: {
      [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: parent.id,
      ...(state ? { [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: state } : {}),
    },
  };
}

/**
 * Lists `parent`'s direct branches, optionally only those in `state`, oldest first. Storage filters
 * on the indexed parent key, so only branch threads are read, never the rest of the resource.
 */
export async function listChildThreads(
  memoryStore: MemoryStorage,
  parent: ThreadRef,
  state?: 'pending' | 'ready',
): Promise<StorageThreadType[]> {
  const children: StorageThreadType[] = [];
  for (let page = 0; ; page += 1) {
    const result = await memoryStore.listThreads({
      filter: childThreadFilter(parent, state),
      orderBy: { field: 'createdAt', direction: 'ASC' },
      page,
      perPage: CHILD_THREAD_PAGE_SIZE,
    });
    children.push(...result.threads);
    if (!result.hasMore || result.threads.length === 0) break;
  }
  return children.sort(compareThreadsByCreation);
}

/** One storage page of `parent`'s direct branches in `state`, oldest first. */
export function listChildThreadPage(
  memoryStore: MemoryStorage,
  parent: ThreadRef,
  state: 'pending' | 'ready',
  page: number,
  perPage: number,
): ReturnType<MemoryStorage['listThreads']> {
  return memoryStore.listThreads({
    filter: childThreadFilter(parent, state),
    orderBy: { field: 'createdAt', direction: 'ASC' },
    page,
    perPage,
  });
}

/** Whether `parent` has at least one direct branch, optionally only in `state`. */
export async function hasChildThread(
  memoryStore: MemoryStorage,
  parent: ThreadRef,
  state?: 'pending' | 'ready',
): Promise<boolean> {
  const result = await memoryStore.listThreads({
    filter: childThreadFilter(parent, state),
    page: 0,
    perPage: 1,
  });
  return result.threads.length > 0;
}

/** Whether `resourceId` owns at least one branch thread in `state`. */
export async function resourceHasBranch(
  memoryStore: MemoryStorage,
  resourceId: string,
  state: 'pending' | 'ready',
): Promise<boolean> {
  const result = await memoryStore.listThreads({
    filter: { resourceId, metadata: { [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: state } },
    page: 0,
    perPage: 1,
  });
  return result.threads.length > 0;
}
