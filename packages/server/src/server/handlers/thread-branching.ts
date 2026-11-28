import type { MastraMemory, StorageThreadType } from '@mastra/core/memory';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage, StorageListThreadsOutput } from '@mastra/core/storage';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import {
  assertNoReservedThreadBranchMetadata,
  createThreadBranchError,
  getThreadBranchAuthorizationCandidates,
  inspectThreadBranchState,
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_METADATA_KEYS,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
  persistMessagesWithThreadCreation,
} from './thread-branching-compat';
import type {
  InternalThreadBranchAuthorizationCandidate,
  InternalThreadBranchState,
  ThreadBranchHistoryOutput,
} from './thread-branching-compat';
import { enforceThreadAccess } from './utils';

export function assertThreadBranchingSupported(memory: MastraMemory): void {
  if (!memory.supportsThreadBranching) {
    throw createThreadBranchError(
      'BRANCHING_UNSUPPORTED',
      `Thread branching is not supported by this memory implementation (${memory.constructor.name}).`,
    );
  }
}

export async function inspectVisibleMemoryThread(
  memory: MastraMemory,
  threadId: string,
  { allowCreate = false }: { allowCreate?: boolean } = {},
): Promise<InternalThreadBranchState> {
  const state = await inspectThreadBranchState(memory, threadId);
  if (state.state === 'pending' || (state.state === 'absent' && !allowCreate)) {
    throwThreadBranchNotFound();
  }
  return state;
}

/**
 * Read-side guard for observational-memory status lookups: authorize threads that
 * actually exist, hide pending branches, and let absent thread rows through after
 * the FGA check so pre-first-message lookups (e.g. `/chat/new`) keep returning the
 * empty record exactly like the pre-branch handler did.
 */
export async function authorizeMemoryThreadForOMRead({
  mastra,
  requestContext,
  memory,
  threadId,
  effectiveResourceId,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  threadId: string;
  effectiveResourceId?: string;
}): Promise<void> {
  const state = await inspectThreadBranchState(memory, threadId);
  if (state.state === 'pending') throwThreadBranchNotFound();
  if (state.state === 'absent') {
    // No row to own-check, but FGA still decides whether the caller may read this thread id
    // (a resource-scoped record would otherwise be read for any caller-supplied resourceId).
    await enforceThreadAccess({ mastra, requestContext, threadId, thread: null, effectiveResourceId });
    return;
  }
  const thread = await memory.getThreadById({ threadId });
  if (!thread) throwThreadBranchNotFound();
  await authorizeMemoryThreadAccess({ mastra, requestContext, memory, thread, effectiveResourceId });
}

export async function createMemoryThreadIfAbsent(
  memory: MastraMemory,
  input: {
    threadId: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<StorageThreadType> {
  assertNoReservedThreadBranchMetadata(input.metadata);
  if (!memory.supportsThreadBranching) return memory.createThread(input);

  const now = new Date();
  await persistMessagesWithThreadCreation(
    memory,
    {
      messages: [],
      thread: {
        id: input.threadId,
        resourceId: input.resourceId,
        title: input.title ?? '',
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      },
      requireThreadCreation: true,
    },
    [],
  );
  const thread = await memory.getThreadById({ threadId: input.threadId });
  if (!thread) throwThreadBranchNotFound();
  return thread;
}

type StoredBranchMarker = {
  parentThreadId: string;
  state: 'pending' | 'ready';
};

function readStoredBranchMarker(thread: StorageThreadType): StoredBranchMarker | null {
  if (!thread.metadata || !Object.prototype.hasOwnProperty.call(thread.metadata, MASTRA_THREAD_BRANCH_METADATA_KEY)) {
    return null;
  }

  const value = thread.metadata[MASTRA_THREAD_BRANCH_METADATA_KEY];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch lineage is malformed.');
  }

  const marker = value as Record<string, unknown>;
  if (
    typeof marker.parentThreadId !== 'string' ||
    (marker.state !== 'pending' && marker.state !== 'ready') ||
    typeof marker.branchPointMessageId !== 'string' ||
    typeof marker.observationalMemoryThreadId !== 'string'
  ) {
    throw createThreadBranchError('BRANCH_LINEAGE_CORRUPT', 'Stored thread branch lineage is malformed.');
  }

  return { parentThreadId: marker.parentThreadId, state: marker.state };
}

export function sanitizeThreadForResponse(thread: StorageThreadType): StorageThreadType {
  const threadMetadata = thread.metadata;
  if (!threadMetadata || !MASTRA_THREAD_BRANCH_METADATA_KEYS.some(key => Object.hasOwn(threadMetadata, key))) {
    return thread;
  }

  const metadata = { ...threadMetadata };
  for (const key of MASTRA_THREAD_BRANCH_METADATA_KEYS) delete metadata[key];
  return { ...thread, metadata };
}

export function sanitizeLegacyThreadListOrThrow(threads: StorageThreadType[]): StorageThreadType[] {
  const visible = threads.filter(thread => readStoredBranchMarker(thread)?.state !== 'pending');
  if (visible.some(thread => readStoredBranchMarker(thread)?.state === 'ready')) {
    throw createThreadBranchError(
      'BRANCHING_UNSUPPORTED',
      'Thread branching requires a branching-capable memory implementation.',
    );
  }
  return visible.map(sanitizeThreadForResponse);
}

export function assertLegacyThreadAvailableOrThrow({
  threadId,
  threads,
}: {
  threadId: string;
  threads: StorageThreadType[];
}): StorageThreadType {
  const thread = threads.find(candidate => candidate.id === threadId);
  if (!thread || readStoredBranchMarker(thread)?.state === 'pending') {
    throwThreadBranchNotFound();
  }

  const marker = readStoredBranchMarker(thread);
  const hasReadyChild = threads.some(candidate => {
    const candidateMarker = readStoredBranchMarker(candidate);
    return candidateMarker?.state === 'ready' && candidateMarker.parentThreadId === threadId;
  });
  if (marker?.state === 'ready' || hasReadyChild) {
    throw createThreadBranchError(
      'BRANCHING_UNSUPPORTED',
      'Thread branching requires a branching-capable memory implementation.',
    );
  }

  return sanitizeThreadForResponse(thread);
}

type LegacyThreadReader = Pick<MemoryStorage, 'getThreadById' | 'listThreads'> | MastraMemory;

/**
 * Same check as `assertLegacyThreadAvailableOrThrow`, read with one row lookup and one
 * indexed ready-child query instead of listing the thread table.
 */
export async function loadLegacyThreadAvailableOrThrow({
  threadId,
  store,
  thread,
}: {
  threadId: string;
  store: LegacyThreadReader;
  thread?: StorageThreadType | null;
}): Promise<StorageThreadType> {
  const row = thread === undefined ? await store.getThreadById({ threadId }) : thread;
  if (!row) throwThreadBranchNotFound();
  const readyChildren = await store.listThreads({
    filter: {
      resourceId: row.resourceId,
      metadata: {
        [MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY]: threadId,
        [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: 'ready',
      },
    },
    page: 0,
    perPage: 1,
  });
  return assertLegacyThreadAvailableOrThrow({ threadId, threads: [row, ...readyChildren.threads] });
}

type ListThreadsArgs = Parameters<MemoryStorage['listThreads']>[0];

/**
 * Lists one page of threads for memory that cannot branch, with the same result as
 * `sanitizeLegacyThreadListOrThrow` over the whole listing. Two indexed one-row queries
 * look for branch rows in the filter's scope: a ready branch refuses the listing. Returns
 * null when a pending branch exists, since hiding it from a page would make the counts wrong;
 * the caller then lists the whole scope and sanitizes it.
 */
export async function listLegacyThreadsPageOrThrow({
  store,
  filter,
  page,
  perPage,
  orderBy,
}: {
  store: LegacyThreadReader;
  filter: ListThreadsArgs['filter'];
  page?: number;
  perPage?: number | false;
  orderBy?: ListThreadsArgs['orderBy'];
}): Promise<StorageListThreadsOutput | null> {
  const hasBranchRow = async (state: 'ready' | 'pending') => {
    const result = await store.listThreads({
      filter: { ...filter, metadata: { ...filter?.metadata, [MASTRA_THREAD_BRANCH_STATE_METADATA_KEY]: state } },
      page: 0,
      perPage: 1,
    });
    return result.threads.length > 0;
  };

  if (await hasBranchRow('ready')) {
    throw createThreadBranchError(
      'BRANCHING_UNSUPPORTED',
      'Thread branching requires a branching-capable memory implementation.',
    );
  }

  if (await hasBranchRow('pending')) return null;

  // A branch can be committed between the probes and this read, so check the page rows too.
  const result = await store.listThreads({ filter, page, perPage, orderBy });
  if (result.threads.some(thread => readStoredBranchMarker(thread)?.state === 'pending')) return null;
  return { ...result, threads: sanitizeLegacyThreadListOrThrow(result.threads) };
}

function isAccessDenied(error: unknown): boolean {
  return error instanceof HTTPException && (error.status === 403 || error.status === 404);
}

export function throwThreadBranchNotFound(_cause?: unknown): never {
  throw createThreadBranchError('BRANCH_NOT_FOUND', 'Thread branch was not found or is not accessible.');
}

async function authorizeRawBranchCandidates({
  mastra,
  requestContext,
  memory,
  threadId,
  direction,
  effectiveResourceId,
  permission,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  threadId: string;
  direction: 'ancestors' | 'descendants';
  effectiveResourceId?: string;
  permission: string;
}): Promise<InternalThreadBranchAuthorizationCandidate[]> {
  const candidates = await getThreadBranchAuthorizationCandidates(memory, threadId, direction);
  if (candidates.length === 0) throwThreadBranchNotFound();
  for (const candidate of candidates) {
    await authorizeThread({
      mastra,
      requestContext,
      thread: candidate as StorageThreadType,
      effectiveResourceId,
      permission,
    });
  }
  return candidates;
}

async function authorizeThread({
  mastra,
  requestContext,
  thread,
  effectiveResourceId,
  permission,
}: {
  mastra: any;
  requestContext?: RequestContext;
  thread: StorageThreadType;
  effectiveResourceId?: string;
  permission: string;
}): Promise<void> {
  try {
    await enforceThreadAccess({
      mastra,
      requestContext,
      threadId: thread.id,
      thread,
      effectiveResourceId,
      permission,
    });
  } catch (error) {
    if (
      isAccessDenied(error) ||
      (error && typeof error === 'object' && (error as { status?: unknown }).status === 403)
    ) {
      throwThreadBranchNotFound(error);
    }
    throw error;
  }
}

export async function authorizeMemoryThreadAccess({
  mastra,
  requestContext,
  memory,
  thread,
  effectiveResourceId,
  permission = MastraFGAPermissions.MEMORY_READ,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  thread: StorageThreadType;
  effectiveResourceId?: string;
  permission?: string;
}): Promise<void> {
  // The requested thread keeps the ordinary access errors (403 for another owner's thread); only
  // the lineage around it is reported as BRANCH_NOT_FOUND so hidden ancestors are not disclosed.
  await enforceThreadAccess({
    mastra,
    requestContext,
    threadId: thread.id,
    thread,
    effectiveResourceId,
    permission,
  });

  if (memory.supportsThreadBranching) {
    await authorizeRawBranchCandidates({
      mastra,
      requestContext,
      memory,
      threadId: thread.id,
      direction: 'ancestors',
      effectiveResourceId,
      permission,
    });
    const history = await memory.getBranchHistory({ threadId: thread.id });
    if (history.history.length === 0 || history.history.at(-1)?.thread.id !== thread.id) {
      throwThreadBranchNotFound();
    }
    for (const entry of history.history.slice(0, -1)) {
      await authorizeThread({
        mastra,
        requestContext,
        thread: entry.thread,
        effectiveResourceId,
        permission,
      });
    }
    return;
  }

  await loadLegacyThreadAvailableOrThrow({ threadId: thread.id, store: memory });
}

export async function filterThreadsByBranchAccess({
  mastra,
  requestContext,
  memory,
  threads,
  effectiveResourceId,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  threads: StorageThreadType[];
  effectiveResourceId?: string;
}): Promise<StorageThreadType[]> {
  if (!memory.supportsThreadBranching) {
    return threads;
  }

  const accessible: StorageThreadType[] = [];
  for (const thread of threads) {
    try {
      await authorizeMemoryThreadAccess({
        mastra,
        requestContext,
        memory,
        thread,
        effectiveResourceId,
      });
      accessible.push(thread);
    } catch (error) {
      if (error && typeof error === 'object' && (error as { id?: unknown }).id === 'BRANCH_NOT_FOUND') {
        continue;
      }
      throw error;
    }
  }
  return accessible;
}

export async function authorizeThreadBranchTree({
  mastra,
  requestContext,
  memory,
  thread,
  effectiveResourceId,
  permission,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  thread: StorageThreadType;
  effectiveResourceId?: string;
  permission: string;
}): Promise<void> {
  await authorizeMemoryThreadAccess({
    mastra,
    requestContext,
    memory,
    thread,
    effectiveResourceId,
    permission,
  });
  if (!memory.supportsThreadBranching) {
    return;
  }

  const candidates = await authorizeRawBranchCandidates({
    mastra,
    requestContext,
    memory,
    threadId: thread.id,
    direction: 'descendants',
    effectiveResourceId,
    permission,
  });
  for (const candidate of candidates) {
    if (candidate.id === thread.id) continue;
    await memory.getBranchHistory({ threadId: candidate.id });
  }
}

export async function authorizeThreadBranchHistory({
  mastra,
  requestContext,
  memory,
  threadId,
  effectiveResourceId,
  currentPermission = MastraFGAPermissions.MEMORY_READ,
}: {
  mastra: any;
  requestContext?: RequestContext;
  memory: MastraMemory;
  threadId: string;
  effectiveResourceId?: string;
  currentPermission?: string;
}): Promise<ThreadBranchHistoryOutput> {
  assertThreadBranchingSupported(memory);

  await authorizeRawBranchCandidates({
    mastra,
    requestContext,
    memory,
    threadId,
    direction: 'ancestors',
    effectiveResourceId,
    permission: currentPermission,
  });

  const currentThread = await memory.getThreadById({ threadId });
  if (!currentThread) {
    throwThreadBranchNotFound();
  }

  await authorizeThread({
    mastra,
    requestContext,
    thread: currentThread,
    effectiveResourceId,
    permission: currentPermission,
  });

  const history = await memory.getBranchHistory({ threadId });
  if (history.history.length === 0 || history.history.at(-1)?.thread.id !== threadId) {
    throwThreadBranchNotFound();
  }

  for (const entry of history.history.slice(0, -1)) {
    await authorizeThread({
      mastra,
      requestContext,
      thread: entry.thread,
      effectiveResourceId,
      permission: currentPermission,
    });
  }

  return {
    history: history.history.map(entry => ({
      thread: sanitizeThreadForResponse(entry.thread),
      branch: entry.branch,
    })),
  };
}
