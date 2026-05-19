import type { HarnessMessage, SessionDisplayState, SessionRecord } from '@mastra/core/harness/v1';
import {
  HarnessAdmissionConflictError,
  HarnessConfigError,
  HarnessQueueFullError,
  HarnessSessionClosedError,
  HarnessSessionClosingError,
  HarnessSessionDeleteBlockedError,
  HarnessSessionDeletedError,
  HarnessSessionLockedError,
  HarnessSessionNotFoundError,
  HarnessStorageError,
  HarnessSubagentDepthExceededError,
  HarnessValidationError,
  HarnessWorkspaceLostError,
  HarnessWorkspaceProviderMismatchError,
  HarnessWorkspaceProvisioningError,
} from '@mastra/core/harness/v1';
import type { RequestContext } from '@mastra/core/request-context';
import type { ValidationErrorHook } from '@mastra/core/server';
import type { ZodError } from 'zod/v4';

import { MastraFGAPermissions } from '../fga-permissions';
import { HTTPException } from '../http-exception';
import type { StatusCode } from '../http-exception';
import {
  createHarnessSessionBodySchema,
  createHarnessSessionResponseSchema,
  harnessNamePathParams,
  harnessSessionPathParams,
  harnessSessionSnapshotSchema,
  listHarnessSessionsQuerySchema,
  listHarnessSessionsResponseSchema,
} from '../schemas/harness';
import { createRoute } from '../server-adapter/routes/route-builder';

import { enforceThreadAccess, getEffectiveResourceId } from './utils';

type SessionLifecycleStatus = 'active' | 'closing' | 'closed';
type PendingInboxKind = 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';

type HarnessSessionListItem = {
  sessionId: string;
  harnessName: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  lifecycle: SessionLifecycleStatus;
  createdAt: number;
  lastActivityAt: number;
  closingAt?: number;
  closeDeadlineAt?: number;
  closedAt?: number;
  modeId: string;
  modelId: string;
  busy: boolean;
  queueDepth: number;
  pendingInbox: {
    count: number;
    kinds: PendingInboxKind[];
    sessionOwnedOnly: true;
  };
  durableWork: {
    activeCount: number;
    waitingCount: number;
    retryingCount: number;
    failedCount: number;
    sessionOwnedOnly: true;
  };
  goal?: {
    id: string;
    status: 'active' | 'paused' | 'done';
    turnsUsed: number;
    maxTurns: number;
    lastDecision?: {
      decision: 'done' | 'continue' | 'waiting';
      judgedAt: number;
    };
  };
};

type HarnessSessionSnapshot = {
  summary: HarnessSessionListItem;
  state: unknown;
  queue: {
    depth: number;
    queuedItemIds: string[];
  };
  pendingInbox: unknown[];
  durableWork: {
    active: unknown[];
    recentTerminal: unknown[];
    truncated: boolean;
    nextCursor?: string;
    sessionOwnedOnly: true;
  };
  displayState?: SessionDisplayState;
  goal?: unknown | null;
  channelBindings: unknown[];
  tokenUsage: SessionRecord['tokenUsage'];
  messages: {
    cursor: {
      threadId: string;
      route: 'thread-messages';
      cursor?: string;
    };
    recent?: {
      messages: HarnessMessage[];
      nextCursor?: string;
      truncated: boolean;
    };
  };
};

type HarnessLike = {
  session(opts: Record<string, unknown>): Promise<{
    id: string;
    getRecord(): Readonly<SessionRecord>;
    getDisplayState(): SessionDisplayState;
    getState(): Promise<unknown>;
    listMessages(opts?: { limit?: number }): Promise<HarnessMessage[]>;
  }>;
  listSessions(opts: {
    resourceId: string;
    includeClosed?: boolean;
  }): Promise<
    Array<
      Pick<
        SessionRecord,
        | 'harnessName'
        | 'id'
        | 'resourceId'
        | 'threadId'
        | 'parentSessionId'
        | 'origin'
        | 'modeId'
        | 'modelId'
        | 'lastActivityAt'
        | 'closingAt'
        | 'closeDeadlineAt'
        | 'closedAt'
      >
    >
  >;
  loadSession(opts: { sessionId: string; includeClosed?: boolean }): Promise<SessionRecord | null>;
  closeSession(opts: { sessionId: string; resourceId?: string }): Promise<void>;
  ownerId?: string;
};

type MemoryThreadLike = { resourceId?: string | null };

type MemoryStoreLike = {
  getThreadById(opts: { threadId: string; resourceId?: string }): Promise<MemoryThreadLike | null>;
};

type MastraStorageLike = {
  stores?: { memory?: MemoryStoreLike };
  getStore?(name: string): Promise<MemoryStoreLike | undefined>;
};

const DEFAULT_LIST_LIMIT = 50;
const SNAPSHOT_MESSAGE_LIMIT = 50;

function toHarnessErrorBody(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  retryable?: boolean,
): { code: string; message: string; details?: Record<string, unknown>; retryable?: boolean } {
  return {
    code,
    message,
    ...(details ? { details } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
  };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });
}

function isClosingUnderActiveForeignLease(record: SessionRecord, harness: Pick<HarnessLike, 'ownerId'>): boolean {
  return (
    record.closingAt !== undefined &&
    record.ownerId !== undefined &&
    record.ownerId !== harness.ownerId &&
    record.leaseExpiresAt !== undefined &&
    record.leaseExpiresAt > Date.now()
  );
}

function throwHarnessHttpError(
  status: StatusCode,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  retryable?: boolean,
): never {
  throw new HTTPException(status, {
    message,
    res: jsonResponse(toHarnessErrorBody(code, message, details, retryable), { status }),
  });
}

function getAuthResourceId(requestContext: RequestContext): string {
  const resourceId = getEffectiveResourceId(requestContext, undefined);
  if (!resourceId) {
    throwHarnessHttpError(403, 'harness.permission_denied', 'Harness routes require an authenticated resource', {
      reason: 'missing_resource',
    });
  }
  return resourceId;
}

function resolveHarness(mastra: { getHarness(name: string): HarnessLike }, name: string): HarnessLike {
  try {
    return mastra.getHarness(name);
  } catch (error) {
    const status = Number((error as { details?: { status?: number } }).details?.status);
    throwHarnessHttpError(
      status === 404 ? 400 : 500,
      status === 404 ? 'harness.bad_request' : 'harness.internal',
      error instanceof Error ? error.message : `Harness "${name}" could not be resolved`,
      { name },
    );
  }
}

async function getMemoryStore(mastra: { getStorage?: () => unknown }): Promise<MemoryStoreLike | null> {
  const storage = mastra.getStorage?.() as MastraStorageLike | undefined;
  if (!storage) return null;
  if (storage.stores?.memory) return storage.stores.memory;
  return (await storage.getStore?.('memory')) ?? null;
}

async function assertExistingThreadAccess({
  mastra,
  requestContext,
  threadId,
  resourceId,
}: {
  mastra: { getStorage?: () => unknown };
  requestContext: RequestContext;
  threadId: string;
  resourceId: string;
}): Promise<void> {
  const memoryStore = await getMemoryStore(mastra);
  if (!memoryStore) return;
  const thread =
    (await memoryStore.getThreadById({ threadId, resourceId })) ?? (await memoryStore.getThreadById({ threadId }));
  if (!thread) return;
  try {
    await enforceThreadAccess({
      mastra,
      requestContext,
      threadId,
      thread,
      effectiveResourceId: resourceId,
      permission: MastraFGAPermissions.MEMORY_WRITE,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throwHarnessHttpError(403, 'harness.permission_denied', 'Harness session cannot attach to this thread', {
        threadId,
        reason: 'thread_access_denied',
      });
    }
    throw error;
  }
}

function assertRequestedThreadMatchesExistingSession({
  requestedThreadId,
  existing,
}: {
  requestedThreadId?: string | { fresh: true };
  existing: SessionRecord;
}): void {
  if (typeof requestedThreadId === 'string' && existing.threadId !== requestedThreadId) {
    throwHarnessHttpError(409, 'harness.session_conflict', 'Requested session is bound to a different thread', {
      sessionId: existing.id,
      threadId: requestedThreadId,
      existingThreadId: existing.threadId,
    });
  }
}

function assertRequestedThreadDidNotResolveDifferentSession({
  requestedSessionId,
  requestedThreadId,
  resolved,
}: {
  requestedSessionId?: string;
  requestedThreadId?: string | { fresh: true };
  resolved: SessionRecord;
}): void {
  if (
    requestedSessionId !== undefined &&
    typeof requestedThreadId === 'string' &&
    resolved.threadId === requestedThreadId &&
    resolved.id !== requestedSessionId
  ) {
    throwHarnessHttpError(409, 'harness.session_conflict', 'Requested thread is already bound to a different session', {
      sessionId: requestedSessionId,
      threadId: requestedThreadId,
      existingSessionId: resolved.id,
    });
  }
}

function assertResolvedSessionMatchesRequestedParent({
  requestedParentSessionId,
  resolved,
}: {
  requestedParentSessionId?: string;
  resolved: SessionRecord;
}): void {
  if (requestedParentSessionId !== undefined && resolved.parentSessionId !== requestedParentSessionId) {
    throwHarnessHttpError(409, 'harness.session_conflict', 'Requested parent is not bound to the resolved session', {
      parentSessionId: requestedParentSessionId,
      sessionId: resolved.id,
      ...(resolved.parentSessionId !== undefined ? { resolvedParentSessionId: resolved.parentSessionId } : {}),
    });
  }
}

function mapHarnessError(error: unknown): never {
  if (error instanceof HTTPException) {
    throw error;
  }
  if (error instanceof HarnessValidationError) {
    throwHarnessHttpError(400, 'harness.validation', error.message, { field: error.field, reason: error.reason });
  }
  if (error instanceof HarnessConfigError) {
    throwHarnessHttpError(400, 'harness.validation', error.message, { field: error.field, reason: error.reason });
  }
  if (error instanceof HarnessQueueFullError) {
    throwHarnessHttpError(429, 'harness.queue_full', error.message, {
      sessionId: error.sessionId,
      maxQueueDepth: error.maxQueueDepth,
    });
  }
  if (error instanceof HarnessAdmissionConflictError) {
    throwHarnessHttpError(409, 'harness.admission_conflict', error.message, {
      sessionId: error.sessionId,
      admissionId: error.admissionId,
      storedAdmissionHash: error.storedAdmissionHash,
      attemptedAdmissionHash: error.attemptedAdmissionHash,
    });
  }
  if (error instanceof HarnessSessionNotFoundError) {
    throwHarnessHttpError(404, 'harness.session_not_found', error.message, { sessionId: error.sessionId });
  }
  if (error instanceof HarnessSessionClosedError) {
    throwHarnessHttpError(404, 'harness.session_closed', error.message, { sessionId: error.sessionId });
  }
  if (error instanceof HarnessSessionDeletedError) {
    throwHarnessHttpError(404, 'harness.session_deleted', error.message, { sessionId: error.sessionId });
  }
  if (error instanceof HarnessSessionClosingError) {
    throwHarnessHttpError(409, 'harness.session_closing', error.message, {
      sessionId: error.sessionId,
    });
  }
  if (error instanceof HarnessSessionDeleteBlockedError) {
    throwHarnessHttpError(409, 'harness.session_delete_blocked', error.message, {
      sessionId: error.sessionId,
      blockers: error.blockers.map(id => ({ source: 'session', id })),
    });
  }
  if (error instanceof HarnessSessionLockedError) {
    throwHarnessHttpError(409, 'harness.session_locked', error.message, {
      sessionId: error.sessionId,
      currentOwnerId: error.currentOwnerId,
      expiresAt: error.expiresAt,
    });
  }
  if (error instanceof HarnessSubagentDepthExceededError) {
    throwHarnessHttpError(409, 'harness.subagent_depth_exceeded', error.message, {
      sessionId: error.sessionId,
      attemptedDepth: error.depth,
      maxDepth: error.maxDepth,
    });
  }
  if (error instanceof HarnessWorkspaceProviderMismatchError) {
    throwHarnessHttpError(409, 'harness.workspace_provider_mismatch', error.message, {
      sessionId: error.sessionId,
      storedProviderId: error.storedProviderId,
      configuredProviderId: error.expectedProviderId,
    });
  }
  if (error instanceof HarnessWorkspaceLostError) {
    throwHarnessHttpError(409, 'harness.workspace_lost', error.message, {
      sessionId: error.sessionId,
      providerId: error.providerId,
      reason: error.reason,
    });
  }
  if (error instanceof HarnessWorkspaceProvisioningError) {
    throwHarnessHttpError(503, 'harness.internal', error.message, {
      providerId: error.providerId,
      sessionId: error.sessionId,
      resourceId: error.resourceId,
    });
  }
  if (error instanceof HarnessStorageError) {
    throwHarnessHttpError(
      503,
      'harness.storage',
      error.message,
      { sessionId: error.sessionId, operation: error.operation },
      true,
    );
  }

  throwHarnessHttpError(500, 'harness.internal', error instanceof Error ? error.message : 'Harness route failed');
}

function lifecycleOf(record: Pick<SessionRecord, 'closingAt' | 'closedAt'>): SessionLifecycleStatus {
  if (record.closedAt !== undefined) return 'closed';
  if (record.closingAt !== undefined) return 'closing';
  return 'active';
}

function throwSessionClosingFromRecord(record: Pick<SessionRecord, 'id' | 'closingAt' | 'closeDeadlineAt'>): never {
  const closingAt = record.closingAt ?? Date.now();
  throwHarnessHttpError(409, 'harness.session_closing', `Session "${record.id}" is closing`, {
    sessionId: record.id,
    closingAt,
    closeDeadlineAt: record.closeDeadlineAt ?? closingAt,
  });
}

function pendingInboxOf(record: Pick<SessionRecord, 'pendingResume'>): HarnessSessionListItem['pendingInbox'] {
  if (!record.pendingResume) {
    return { count: 0, kinds: [], sessionOwnedOnly: true };
  }
  return { count: 1, kinds: [record.pendingResume.kind], sessionOwnedOnly: true };
}

function goalSummaryOf(record: Pick<SessionRecord, 'goal'>): HarnessSessionListItem['goal'] | undefined {
  if (!record.goal) return undefined;
  return {
    id: record.goal.id,
    status: record.goal.status,
    turnsUsed: record.goal.turnsUsed,
    maxTurns: record.goal.maxTurns,
    ...(record.goal.lastDecision
      ? {
          lastDecision: {
            decision: record.goal.lastDecision.decision,
            judgedAt: record.goal.lastDecision.judgedAt,
          },
        }
      : {}),
  };
}

function emptyDurableWorkSummary(): HarnessSessionListItem['durableWork'] {
  return {
    activeCount: 0,
    waitingCount: 0,
    retryingCount: 0,
    failedCount: 0,
    sessionOwnedOnly: true,
  };
}

function mapSessionRecordToListItem(record: SessionRecord, displayState?: SessionDisplayState): HarnessSessionListItem {
  const item: HarnessSessionListItem = {
    sessionId: record.id,
    harnessName: record.harnessName,
    resourceId: record.resourceId,
    threadId: record.threadId,
    lifecycle: lifecycleOf(record),
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    modeId: record.modeId,
    modelId: record.modelId,
    busy: displayState?.isRunning ?? (record.ownerId !== undefined && (record.leaseExpiresAt ?? 0) > Date.now()),
    queueDepth: record.pendingQueue.length,
    pendingInbox: pendingInboxOf(record),
    durableWork: emptyDurableWorkSummary(),
  };
  if (record.parentSessionId !== undefined) item.parentSessionId = record.parentSessionId;
  if (record.closingAt !== undefined) item.closingAt = record.closingAt;
  if (record.closeDeadlineAt !== undefined) item.closeDeadlineAt = record.closeDeadlineAt;
  if (record.closedAt !== undefined) item.closedAt = record.closedAt;
  const goal = goalSummaryOf(record);
  if (goal) item.goal = goal;
  return item;
}

function displayStateFromRecord(record: SessionRecord): SessionDisplayState {
  return {
    sessionId: record.id,
    threadId: record.threadId,
    resourceId: record.resourceId,
    ...(record.parentSessionId !== undefined ? { parentSessionId: record.parentSessionId } : {}),
    lifecycleState: record.closedAt !== undefined ? 'closed' : record.closingAt !== undefined ? 'closing' : 'live',
    modeId: record.modeId,
    modelId: record.modelId,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    isRunning: record.ownerId !== undefined && (record.leaseExpiresAt ?? 0) > Date.now(),
    activeTools: {},
    toolInputBuffers: {},
    activeSubagents: {},
    tokenUsage: { ...record.tokenUsage },
    pending: record.pendingResume ?? null,
    queueDepth: record.pendingQueue.length,
    ...(record.goal !== undefined ? { goal: record.goal } : {}),
  };
}

function snapshotFromRecord(
  record: SessionRecord,
  displayState: SessionDisplayState,
  state: unknown,
  messages?: { items: HarnessMessage[]; nextCursor?: string; truncated: boolean },
): HarnessSessionSnapshot {
  return {
    summary: mapSessionRecordToListItem(record, displayState),
    state,
    queue: {
      depth: record.pendingQueue.length,
      queuedItemIds: record.pendingQueue.map(item => item.id),
    },
    pendingInbox: record.pendingResume ? [record.pendingResume] : [],
    durableWork: {
      active: [],
      recentTerminal: [],
      truncated: false,
      sessionOwnedOnly: true,
    },
    displayState,
    goal: record.goal ?? null,
    channelBindings: [],
    tokenUsage: { ...record.tokenUsage },
    messages: {
      cursor: {
        threadId: record.threadId,
        route: 'thread-messages',
      },
      ...(messages
        ? {
            recent: {
              messages: messages.items,
              ...(messages.nextCursor !== undefined ? { nextCursor: messages.nextCursor } : {}),
              truncated: messages.truncated,
            },
          }
        : {}),
    },
  };
}

async function listRecentMessages(session: Awaited<ReturnType<HarnessLike['session']>>) {
  const messages = await session.listMessages({ limit: SNAPSHOT_MESSAGE_LIMIT + 1 });
  const truncated = messages.length > SNAPSHOT_MESSAGE_LIMIT;
  return {
    items: truncated ? messages.slice(-SNAPSHOT_MESSAGE_LIMIT) : messages,
    truncated,
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown };
    if (Number.isInteger(parsed.offset) && Number(parsed.offset) >= 0) {
      return Number(parsed.offset);
    }
  } catch {
    // Fall through to validation envelope below.
  }
  throw new HarnessValidationError('cursor', 'cursor is invalid or expired');
}

function harnessValidationErrorHook(error: ZodError, context: Parameters<ValidationErrorHook>[1]) {
  const first = error.issues[0];
  return {
    status: 400,
    body: toHarnessErrorBody('harness.validation', `Invalid ${context}`, {
      field: first?.path?.length ? first.path.map(String).join('.') : context,
      reason: first?.message ?? 'Invalid request',
    }),
  };
}

export const LIST_HARNESS_SESSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions',
  responseType: 'json',
  pathParamSchema: harnessNamePathParams,
  queryParamSchema: listHarnessSessionsQuerySchema,
  responseSchema: listHarnessSessionsResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'List Harness sessions',
  description: 'Returns resource-scoped Harness session summaries for the authenticated caller.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, cursor, limit, includeClosed }) => {
    try {
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, name);
      const summaries = await harness.listSessions({ resourceId, includeClosed });
      const ordered = summaries.slice().sort((a, b) => b.lastActivityAt - a.lastActivityAt || b.id.localeCompare(a.id));
      const offset = decodeCursor(cursor);
      const pageLimit = limit ?? DEFAULT_LIST_LIMIT;
      const page = ordered.slice(offset, offset + pageLimit);
      const loadedItems = await Promise.all(
        page.map(async summary => {
          const record = await harness.loadSession({ sessionId: summary.id, includeClosed: true });
          if (!record || record.resourceId !== resourceId) {
            return null;
          }
          if (!includeClosed && record.closedAt !== undefined) {
            return null;
          }
          return mapSessionRecordToListItem(record);
        }),
      );
      const items = loadedItems.filter(item => item !== null);
      const nextOffset = offset + page.length;
      return {
        items,
        ...(nextOffset < ordered.length ? { nextCursor: encodeCursor(nextOffset) } : {}),
        truncated: nextOffset < ordered.length,
      };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const CREATE_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions',
  responseType: 'json',
  pathParamSchema: harnessNamePathParams,
  bodySchema: createHarnessSessionBodySchema,
  responseSchema: createHarnessSessionResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Create or resolve a Harness session',
  description: 'Creates or resolves a resource-scoped Harness session for the authenticated caller.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, threadId, parentSessionId, origin, modeId, modelId }) => {
    try {
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, name);
      let existingById: SessionRecord | null = null;
      if (sessionId !== undefined) {
        existingById = await harness.loadSession({ sessionId, includeClosed: true });
        if (existingById && existingById.resourceId !== resourceId) {
          throw new HarnessSessionNotFoundError(sessionId);
        }
        if (existingById?.closedAt !== undefined) {
          throw new HarnessSessionClosedError(sessionId);
        }
        if (existingById?.closingAt !== undefined && existingById.closedAt === undefined) {
          throwSessionClosingFromRecord(existingById);
        }
        if (existingById) {
          assertRequestedThreadMatchesExistingSession({ requestedThreadId: threadId, existing: existingById });
          assertResolvedSessionMatchesRequestedParent({
            requestedParentSessionId: parentSessionId,
            resolved: existingById,
          });
          await assertExistingThreadAccess({ mastra, requestContext, threadId: existingById.threadId, resourceId });
        }
      }
      if (parentSessionId !== undefined) {
        const parent = await harness.loadSession({ sessionId: parentSessionId, includeClosed: true });
        if (!parent || parent.resourceId !== resourceId) {
          throw new HarnessSessionNotFoundError(parentSessionId);
        }
        if (parent.closedAt !== undefined) {
          throw new HarnessSessionClosedError(parentSessionId);
        }
        if (parent.closingAt !== undefined && parent.closedAt === undefined) {
          throwSessionClosingFromRecord(parent);
        }
      }
      const effectiveThreadId = threadId ?? (parentSessionId !== undefined ? { fresh: true as const } : undefined);
      const sessionThreadId = existingById !== null ? undefined : effectiveThreadId;
      if (typeof sessionThreadId === 'string') {
        await assertExistingThreadAccess({ mastra, requestContext, threadId: sessionThreadId, resourceId });
      }
      const sessionOptions = {
        ...(sessionId !== undefined ? { sessionId } : {}),
        ...(sessionThreadId !== undefined ? { threadId: sessionThreadId } : {}),
        ...(existingById === null && parentSessionId !== undefined ? { parentSessionId } : {}),
        ...(origin !== undefined ? { origin } : {}),
        ...(modeId !== undefined ? { modeId } : {}),
        ...(modelId !== undefined ? { modelId } : {}),
        resourceId,
      };
      const session = await harness.session(sessionOptions);
      const record = session.getRecord() as SessionRecord;
      assertRequestedThreadDidNotResolveDifferentSession({
        requestedSessionId: sessionId,
        requestedThreadId: threadId,
        resolved: record,
      });
      assertResolvedSessionMatchesRequestedParent({ requestedParentSessionId: parentSessionId, resolved: record });
      if (sessionId === undefined && typeof sessionThreadId !== 'string') {
        await assertExistingThreadAccess({ mastra, requestContext, threadId: record.threadId, resourceId });
      }
      const displayState = session.getDisplayState();
      const state = await session.getState();
      const messages = await listRecentMessages(session);
      return {
        session: snapshotFromRecord(record, displayState, state, messages),
      };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_SESSION_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  responseSchema: harnessSessionSnapshotSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Get Harness session snapshot',
  description: 'Returns a tenant-scoped stored snapshot for a Harness session.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId }) => {
    try {
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, name);
      const stored = await harness.loadSession({ sessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throw new HarnessSessionNotFoundError(sessionId);
      }

      const displayState = displayStateFromRecord(stored);
      const state: unknown = stored.state ?? {};
      const snapshot = snapshotFromRecord(stored, displayState, state);
      return jsonResponse(snapshot, {
        status: 200,
        headers: { etag: `"${stored.version}"` },
      });
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const CLOSE_HARNESS_SESSION_ROUTE = createRoute({
  method: 'DELETE',
  path: '/harness/:name/sessions/:sessionId',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Close a Harness session',
  description: 'Closes a tenant-owned Harness session idempotently.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId }) => {
    try {
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, name);
      const stored = await harness.loadSession({ sessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throw new HarnessSessionNotFoundError(sessionId);
      }
      if (stored.closedAt !== undefined) {
        return new Response(null, { status: 204 });
      }
      if (isClosingUnderActiveForeignLease(stored, harness)) {
        return new Response(null, { status: 204 });
      }
      await harness.closeSession({ sessionId, resourceId });
      return new Response(null, { status: 204 });
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});
