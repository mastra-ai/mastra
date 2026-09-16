import {
  assertNoReservedThreadBranchMetadata,
  createThreadBranchError,
  MASTRA_THREAD_BRANCH_METADATA_KEY,
} from '@mastra/core/memory';
import type { MastraMemory, StorageThreadType, ThreadBranchHistoryOutput } from '@mastra/core/memory';
import {
  getThreadBranchAuthorizationCandidates,
  inspectThreadBranchState,
  persistMessagesWithThreadCreation,
} from '@mastra/core/memory/internal';
import type {
  InternalThreadBranchAuthorizationCandidate,
  InternalThreadBranchState,
} from '@mastra/core/memory/internal';
import type { RequestContext } from '@mastra/core/request-context';
import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
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
  if (!thread.metadata || !Object.prototype.hasOwnProperty.call(thread.metadata, MASTRA_THREAD_BRANCH_METADATA_KEY)) {
    return thread;
  }

  const metadata = { ...thread.metadata };
  delete metadata[MASTRA_THREAD_BRANCH_METADATA_KEY];
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
  if (memory.supportsThreadBranching) {
    await authorizeThread({
      mastra,
      requestContext,
      thread,
      effectiveResourceId,
      permission,
    });
  } else {
    await enforceThreadAccess({
      mastra,
      requestContext,
      threadId: thread.id,
      thread,
      effectiveResourceId,
      permission,
    });
  }

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

  assertLegacyThreadAvailableOrThrow({
    threadId: thread.id,
    threads: (await memory.listThreads({ perPage: false })).threads,
  });
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
