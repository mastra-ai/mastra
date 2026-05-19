import type {
  GoalOptions,
  GoalState,
  HarnessMessage,
  InboxResponseResult,
  PermissionRules,
  SessionDisplayState,
  SessionGrants,
  SessionRecord,
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
  harnessGoalBodySchema,
  harnessGoalResponseSchema,
  harnessInboxPathParams,
  harnessInboxResponseBodySchema,
  harnessInboxResponseResultSchema,
  harnessMessageAdmissionBodySchema,
  harnessMessageAdmissionResponseSchema,
  harnessModePatchSchema,
  harnessModeResponseSchema,
  harnessModelPatchSchema,
  harnessModelResponseSchema,
  harnessNamePathParams,
  harnessPermissionPatchSchema,
  harnessPermissionsResponseSchema,
  harnessQueueAdmissionBodySchema,
  harnessQueueAdmissionResponseSchema,
  harnessSessionPathParams,
  harnessSessionSnapshotSchema,
  harnessStatePatchSchema,
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
    setState(updates: Record<string, unknown>, opts?: { ifVersion?: number }): Promise<void>;
    admitMessage(opts: {
      content: string;
      admissionId: string;
      mode?: string;
      model?: string;
      attachments?: unknown[];
    }): Promise<{ accepted: true; signalId: string; runId?: string; duplicate: boolean }>;
    admitQueue(opts: {
      content: string;
      admissionId: string;
      mode?: string;
      model?: string;
      yolo?: boolean;
      attachments?: unknown[];
    }): Promise<{ accepted: true; queuedItemId: string; duplicate: boolean }>;
    switchMode(opts: { mode: string }): Promise<void>;
    models: {
      switch(opts: { model: string }): Promise<void>;
    };
    permissions: {
      grantCategory(opts: { category: string }): Promise<void>;
      grantTool(opts: { toolName: string }): Promise<void>;
      revokeCategory(opts: { category: string }): Promise<void>;
      revokeTool(opts: { toolName: string }): Promise<void>;
      getGrants(): Readonly<SessionGrants>;
      getRules(): Readonly<PermissionRules>;
      setPolicy(
        opts:
          | { category: string; toolName?: never; policy: 'allow' | 'ask' | 'deny' }
          | { toolName: string; category?: never; policy: 'allow' | 'ask' | 'deny' },
      ): Promise<void>;
    };
    respondToToolApproval(opts: {
      itemId: string;
      responseId: string;
      approved: boolean;
      reason?: string;
    }): Promise<InboxResponseResult>;
    respondToToolSuspension(opts: {
      itemId: string;
      responseId: string;
      resumeData: unknown;
    }): Promise<InboxResponseResult>;
    respondToQuestion(opts: { itemId: string; responseId: string; answer: unknown }): Promise<InboxResponseResult>;
    respondToPlanApproval(opts: {
      itemId: string;
      responseId: string;
      approved: boolean;
      revision?: string;
      transitionToMode?: string;
    }): Promise<InboxResponseResult>;
    setGoal(opts: GoalOptions): Promise<GoalState>;
    getGoal(): GoalState | undefined;
    pauseGoal(): Promise<GoalState | undefined>;
    resumeGoal(): Promise<GoalState | undefined>;
    clearGoal(): Promise<void>;
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

type HarnessSessionLike = Awaited<ReturnType<HarnessLike['session']>>;
type CreateHarnessSessionBody = {
  sessionId?: string;
  threadId?: string | { fresh: true };
  parentSessionId?: string;
  origin?: 'top-level';
  modeId?: string;
  modelId?: string;
};
type MessageAdmissionBody = Parameters<HarnessSessionLike['admitMessage']>[0];
type QueueAdmissionBody = Parameters<HarnessSessionLike['admitQueue']>[0];

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

function parseStrongIfMatch(value: string | undefined): number {
  if (!value) {
    throwHarnessHttpError(400, 'harness.validation', 'If-Match header is required', {
      field: 'if-match',
      reason: 'missing',
    });
  }
  if (value.includes(',') || value === '*' || value.startsWith('W/')) {
    throwHarnessHttpError(400, 'harness.validation', 'If-Match must be a single strong session ETag', {
      field: 'if-match',
      reason: 'invalid',
    });
  }
  const match = /^"([0-9]+)"$/.exec(value);
  if (!match) {
    throwHarnessHttpError(400, 'harness.validation', 'If-Match must use the session ETag format', {
      field: 'if-match',
      reason: 'invalid',
    });
  }
  return Number(match[1]);
}

function assertSessionVersion(record: SessionRecord, expectedVersion: number): void {
  if (record.version !== expectedVersion) {
    throwHarnessHttpError(409, 'harness.state_conflict', 'Session state validator does not match current version', {
      sessionId: record.id,
      attemptedVersion: expectedVersion,
      currentVersion: record.version,
    });
  }
}

function permissionsSnapshot(session: {
  permissions: { getGrants(): Readonly<SessionGrants>; getRules(): Readonly<PermissionRules> };
}) {
  const grants = session.permissions.getGrants();
  const rules = session.permissions.getRules();
  return {
    grants: {
      categories: [...grants.categories],
      tools: [...grants.tools],
    },
    rules: {
      categories: { ...rules.categories },
      tools: { ...rules.tools },
    },
  };
}

function objectRequestBody(requestBody: unknown, label: string): Record<string, unknown> {
  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    throwHarnessHttpError(400, 'harness.validation', `${label} body must be a JSON object`);
  }
  return { ...(requestBody as Record<string, unknown>) };
}

function requiredStringField(body: Record<string, unknown>, field: string, label: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.length === 0) {
    throwHarnessHttpError(400, 'harness.validation', `${label} requires "${field}"`, {
      field,
      reason: 'required',
    });
  }
  return value;
}

function requiredPermissionPolicy(body: Record<string, unknown>, label: string): 'allow' | 'ask' | 'deny' {
  const value = body.policy;
  if (value === undefined) {
    throwHarnessHttpError(400, 'harness.validation', `${label} requires "policy"`, {
      field: 'policy',
      reason: 'required',
    });
  }
  if (value !== 'allow' && value !== 'ask' && value !== 'deny') {
    throwHarnessHttpError(400, 'harness.validation', `${label} policy is invalid`, {
      field: 'policy',
      reason: 'invalid',
    });
  }
  return value;
}

function requiredPermissionTarget(
  body: Record<string, unknown>,
  label: string,
): { category: string } | { toolName: string } {
  const hasCategory = body.category !== undefined;
  const hasToolName = body.toolName !== undefined;
  if (hasCategory === hasToolName) {
    throwHarnessHttpError(400, 'harness.validation', `${label} requires exactly one permission target`, {
      field: 'category',
      reason: 'exclusive',
    });
  }
  return hasCategory
    ? { category: requiredStringField(body, 'category', label) }
    : { toolName: requiredStringField(body, 'toolName', label) };
}

function statePatchFromRequestBody(requestBody: unknown): Record<string, unknown> {
  return objectRequestBody(requestBody, 'State patch');
}

function stringPathParam(
  requestPathParams: Record<string, unknown> | undefined,
  fallback: unknown,
  key: string,
): string {
  const value = requestPathParams?.[key] ?? fallback;
  if (typeof value !== 'string' || value.length === 0) {
    throwHarnessHttpError(400, 'harness.validation', `Missing required path parameter "${key}"`, {
      field: key,
      reason: 'missing',
    });
  }
  return value;
}

function harnessSessionPathIdentity(
  requestPathParams: Record<string, unknown> | undefined,
  fallbackName: unknown,
  fallbackSessionId: unknown,
): { pathName: string; pathSessionId: string } {
  return {
    pathName: stringPathParam(requestPathParams, fallbackName, 'name'),
    pathSessionId: stringPathParam(requestPathParams, fallbackSessionId, 'sessionId'),
  };
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

function harnessErrorName(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name : undefined;
}

function harnessErrorProp(error: unknown, key: string): unknown {
  if (!error || typeof error !== 'object') return undefined;
  return (error as Record<string, unknown>)[key];
}

function harnessErrorString(error: unknown, key: string): string | undefined {
  const value = harnessErrorProp(error, key);
  return typeof value === 'string' ? value : undefined;
}

function harnessErrorNumber(error: unknown, key: string): number | undefined {
  const value = harnessErrorProp(error, key);
  return typeof value === 'number' ? value : undefined;
}

function harnessErrorStringArray(error: unknown, key: string): string[] {
  const value = harnessErrorProp(error, key);
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function mapHarnessError(error: unknown): never {
  if (error instanceof HTTPException) {
    throw error;
  }
  const name = harnessErrorName(error);
  const message = error instanceof Error ? error.message : 'Harness route failed';
  if (name === 'HarnessValidationError') {
    throwHarnessHttpError(400, 'harness.validation', message, {
      field: harnessErrorString(error, 'field'),
      reason: harnessErrorString(error, 'reason'),
    });
  }
  if (name === 'HarnessConfigError') {
    throwHarnessHttpError(400, 'harness.validation', message, {
      field: harnessErrorString(error, 'field'),
      reason: harnessErrorString(error, 'reason'),
    });
  }
  if (name === 'HarnessQueueFullError') {
    throwHarnessHttpError(429, 'harness.queue_full', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      maxQueueDepth: harnessErrorNumber(error, 'maxQueueDepth'),
    });
  }
  if (name === 'HarnessAdmissionConflictError') {
    throwHarnessHttpError(409, 'harness.admission_conflict', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      admissionId: harnessErrorString(error, 'admissionId'),
      storedAdmissionHash: harnessErrorString(error, 'storedAdmissionHash'),
      attemptedAdmissionHash: harnessErrorString(error, 'attemptedAdmissionHash'),
    });
  }
  if (name === 'HarnessAttachmentUnavailableError') {
    const attachmentId = harnessErrorString(error, 'attachmentId');
    throwHarnessHttpError(400, 'harness.attachment_unavailable', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      reason: harnessErrorString(error, 'reason'),
      ...(attachmentId !== undefined ? { attachmentId } : {}),
    });
  }
  if (name === 'HarnessInboxItemNotFoundError') {
    throwHarnessHttpError(404, 'harness.inbox_item_not_found', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      itemId: harnessErrorString(error, 'itemId'),
    });
  }
  if (name === 'HarnessInboxResponseConflictError') {
    throwHarnessHttpError(409, 'harness.inbox_response_conflict', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      itemId: harnessErrorString(error, 'itemId'),
      responseId: harnessErrorString(error, 'responseId'),
    });
  }
  if (name === 'HarnessSessionNotFoundError') {
    throwHarnessHttpError(404, 'harness.session_not_found', message, { sessionId: harnessErrorString(error, 'sessionId') });
  }
  if (name === 'HarnessSessionClosedError') {
    throwHarnessHttpError(404, 'harness.session_closed', message, { sessionId: harnessErrorString(error, 'sessionId') });
  }
  if (name === 'HarnessSessionDeletedError') {
    throwHarnessHttpError(404, 'harness.session_deleted', message, { sessionId: harnessErrorString(error, 'sessionId') });
  }
  if (name === 'HarnessSessionClosingError') {
    throwHarnessHttpError(409, 'harness.session_closing', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
    });
  }
  if (name === 'HarnessSessionDeleteBlockedError') {
    throwHarnessHttpError(409, 'harness.session_delete_blocked', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      blockers: harnessErrorStringArray(error, 'blockers').map(id => ({ source: 'session', id })),
    });
  }
  if (name === 'HarnessSessionLockedError') {
    throwHarnessHttpError(409, 'harness.session_locked', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      currentOwnerId: harnessErrorString(error, 'currentOwnerId'),
      expiresAt: harnessErrorNumber(error, 'expiresAt'),
    });
  }
  if (name === 'HarnessStateConflictError') {
    throwHarnessHttpError(409, 'harness.state_conflict', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      attemptedVersion: harnessErrorNumber(error, 'attemptedVersion'),
      currentVersion: harnessErrorNumber(error, 'currentVersion'),
    });
  }
  if (name === 'HarnessSubagentDepthExceededError') {
    throwHarnessHttpError(409, 'harness.subagent_depth_exceeded', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      attemptedDepth: harnessErrorNumber(error, 'depth'),
      maxDepth: harnessErrorNumber(error, 'maxDepth'),
    });
  }
  if (name === 'HarnessWorkspaceProviderMismatchError') {
    throwHarnessHttpError(409, 'harness.workspace_provider_mismatch', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      storedProviderId: harnessErrorString(error, 'storedProviderId'),
      configuredProviderId: harnessErrorString(error, 'expectedProviderId'),
    });
  }
  if (name === 'HarnessWorkspaceLostError') {
    throwHarnessHttpError(409, 'harness.workspace_lost', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      providerId: harnessErrorString(error, 'providerId'),
      reason: harnessErrorString(error, 'reason'),
    });
  }
  if (name === 'HarnessWorkspaceProvisioningError') {
    throwHarnessHttpError(503, 'harness.internal', message, {
      providerId: harnessErrorString(error, 'providerId'),
      sessionId: harnessErrorString(error, 'sessionId'),
      resourceId: harnessErrorString(error, 'resourceId'),
    });
  }
  if (name === 'HarnessStorageError') {
    throwHarnessHttpError(
      503,
      'harness.storage',
      message,
      { sessionId: harnessErrorString(error, 'sessionId'), operation: harnessErrorString(error, 'operation') },
      true,
    );
  }

  throwHarnessHttpError(500, 'harness.internal', message);
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

function throwSessionNotFound(sessionId: string): never {
  throwHarnessHttpError(404, 'harness.session_not_found', `Session "${sessionId}" was not found`, { sessionId });
}

function throwSessionClosed(sessionId: string): never {
  throwHarnessHttpError(404, 'harness.session_closed', `Session "${sessionId}" is closed`, { sessionId });
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
  throwHarnessHttpError(400, 'harness.validation', 'cursor is invalid or expired', {
    field: 'cursor',
    reason: 'cursor is invalid or expired',
  });
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
  handler: async ({
    mastra,
    requestContext,
    name,
    requestBody,
    requestPathParams,
  }) => {
    try {
      const pathName = stringPathParam(requestPathParams, name, 'name');
      const body =
        requestBody === undefined
          ? ({} as CreateHarnessSessionBody)
          : (objectRequestBody(requestBody, 'Create session') as CreateHarnessSessionBody);
      const { sessionId, threadId, parentSessionId, origin, modeId, modelId } = body;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      let existingById: SessionRecord | null = null;
      if (sessionId !== undefined) {
        existingById = await harness.loadSession({ sessionId, includeClosed: true });
        if (existingById && existingById.resourceId !== resourceId) {
          throwSessionNotFound(sessionId);
        }
        if (existingById?.closedAt !== undefined) {
          throwSessionClosed(sessionId);
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
          throwSessionNotFound(parentSessionId);
        }
        if (parent.closedAt !== undefined) {
          throwSessionClosed(parentSessionId);
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
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
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

export const POST_HARNESS_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/messages',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessMessageAdmissionBodySchema,
  responseSchema: harnessMessageAdmissionResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Admit a Harness session message',
  description: 'Admits a retry-safe message turn and returns the durable signal identity.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Message admission') as MessageAdmissionBody;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return await session.admitMessage(body);
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const POST_HARNESS_QUEUE_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/queue',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessQueueAdmissionBodySchema,
  responseSchema: harnessQueueAdmissionResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Admit a Harness queued turn',
  description: 'Appends a retry-safe queued turn and returns the durable queued item identity.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Queue admission') as QueueAdmissionBody;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return await session.admitQueue(body);
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_STATE_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/state',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Get Harness session state',
  description: 'Returns the tenant-scoped Harness session state with the session ETag.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
      }
      return jsonResponse(stored.state ?? {}, { status: 200, headers: { etag: `"${stored.version}"` } });
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PATCH_HARNESS_STATE_ROUTE = createRoute({
  method: 'PATCH',
  path: '/harness/:name/sessions/:sessionId/state',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessStatePatchSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Patch Harness session state',
  description: 'Applies the object-form Harness state merge under a session ETag validator.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, getHeader, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const expectedVersion = parseStrongIfMatch(getHeader?.('if-match'));
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
      }
      assertSessionVersion(stored, expectedVersion);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      assertSessionVersion(session.getRecord() as SessionRecord, expectedVersion);
      await session.setState(statePatchFromRequestBody(requestBody), { ifVersion: expectedVersion });
      const record = session.getRecord() as SessionRecord;
      return jsonResponse((record.state ?? {}) as unknown, { status: 200, headers: { etag: `"${record.version}"` } });
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PATCH_HARNESS_MODE_ROUTE = createRoute({
  method: 'PATCH',
  path: '/harness/:name/sessions/:sessionId/mode',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessModePatchSchema,
  responseSchema: harnessModeResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Switch Harness session mode',
  description: 'Switches the active mode for future Harness turns.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Mode patch') as { mode: string };
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      await session.switchMode({ mode: body.mode });
      return { modeId: (session.getRecord() as SessionRecord).modeId };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PATCH_HARNESS_MODEL_ROUTE = createRoute({
  method: 'PATCH',
  path: '/harness/:name/sessions/:sessionId/model',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessModelPatchSchema,
  responseSchema: harnessModelResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Switch Harness session model',
  description: 'Switches the default model for future Harness turns.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Model patch') as { model: string };
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      await session.models.switch({ model: body.model });
      return { modelId: (session.getRecord() as SessionRecord).modelId };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PATCH_HARNESS_PERMISSIONS_ROUTE = createRoute({
  method: 'PATCH',
  path: '/harness/:name/sessions/:sessionId/permissions',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessPermissionPatchSchema,
  responseSchema: harnessPermissionsResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Mutate Harness session permissions',
  description: 'Applies a single session permission grant, revoke, or policy mutation.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Permissions patch') as {
        action: 'grantCategory' | 'grantTool' | 'revokeCategory' | 'revokeTool' | 'setPolicy';
        category?: string;
        toolName?: string;
        policy?: 'allow' | 'ask' | 'deny';
      };
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      switch (body.action) {
        case 'grantCategory':
          await session.permissions.grantCategory({ category: requiredStringField(body, 'category', 'Permissions patch') });
          break;
        case 'grantTool':
          await session.permissions.grantTool({ toolName: requiredStringField(body, 'toolName', 'Permissions patch') });
          break;
        case 'revokeCategory':
          await session.permissions.revokeCategory({ category: requiredStringField(body, 'category', 'Permissions patch') });
          break;
        case 'revokeTool':
          await session.permissions.revokeTool({ toolName: requiredStringField(body, 'toolName', 'Permissions patch') });
          break;
        case 'setPolicy': {
          const policy = requiredPermissionPolicy(body, 'Permissions patch');
          await session.permissions.setPolicy({ ...requiredPermissionTarget(body, 'Permissions patch'), policy });
          break;
        }
      }
      return permissionsSnapshot(session);
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const RESPOND_HARNESS_INBOX_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/inbox/:itemId',
  responseType: 'json',
  pathParamSchema: harnessInboxPathParams,
  bodySchema: harnessInboxResponseBodySchema,
  responseSchema: harnessInboxResponseResultSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Respond to a Harness inbox item',
  description: 'Applies a typed, idempotent response to a pending Harness approval, suspension, question, or plan.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, itemId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const pathItemId = stringPathParam(requestPathParams, itemId, 'itemId');
      const body = objectRequestBody(requestBody, 'Inbox response') as {
        kind: 'tool-approval' | 'tool-suspension' | 'question' | 'plan-approval';
        responseId: string;
        approved?: boolean;
        reason?: string;
        resumeData?: unknown;
        answer?: unknown;
        revision?: string;
        transitionToMode?: string;
      };
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      switch (body.kind) {
        case 'tool-approval':
          return await session.respondToToolApproval({
            itemId: pathItemId,
            responseId: body.responseId,
            approved: body.approved!,
            ...(body.reason !== undefined ? { reason: body.reason } : {}),
          });
        case 'tool-suspension':
          return await session.respondToToolSuspension({
            itemId: pathItemId,
            responseId: body.responseId,
            resumeData: body.resumeData,
          });
        case 'question':
          return await session.respondToQuestion({
            itemId: pathItemId,
            responseId: body.responseId,
            answer: body.answer,
          });
        case 'plan-approval':
          return await session.respondToPlanApproval({
            itemId: pathItemId,
            responseId: body.responseId,
            approved: body.approved!,
            ...(body.revision !== undefined ? { revision: body.revision } : {}),
            ...(body.transitionToMode !== undefined ? { transitionToMode: body.transitionToMode } : {}),
          });
        default: {
          const unsupportedKind: never = body.kind;
          throwHarnessHttpError(400, 'harness.validation', `Unsupported inbox response kind for "${pathItemId}"`, {
            field: 'kind',
            reason: 'unsupported',
            kind: unsupportedKind,
            itemId: pathItemId,
          });
        }
      }
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PUT_HARNESS_GOAL_ROUTE = createRoute({
  method: 'PUT',
  path: '/harness/:name/sessions/:sessionId/goal',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessGoalBodySchema,
  responseSchema: harnessGoalResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Set Harness session goal',
  description: 'Sets or replaces the active session goal.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Goal') as unknown as GoalOptions;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      const goal = await session.setGoal(body);
      return { goal };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_GOAL_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/goal',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  responseSchema: harnessGoalResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Get Harness session goal',
  description: 'Reads the current session goal.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
      }
      return { goal: stored.goal ?? null };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const PAUSE_HARNESS_GOAL_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/goal/pause',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  responseSchema: harnessGoalResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Pause Harness session goal',
  description: 'Pauses the current session goal if present.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return { goal: (await session.pauseGoal()) ?? null };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const RESUME_HARNESS_GOAL_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/goal/resume',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  responseSchema: harnessGoalResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Resume Harness session goal',
  description: 'Resumes the current session goal if present.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return { goal: (await session.resumeGoal()) ?? null };
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const DELETE_HARNESS_GOAL_ROUTE = createRoute({
  method: 'DELETE',
  path: '/harness/:name/sessions/:sessionId/goal',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Clear Harness session goal',
  description: 'Clears the current session goal if present.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      await session.clearGoal();
      return new Response(null, { status: 204 });
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
  handler: async ({ mastra, requestContext, name, sessionId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
      }
      if (stored.closedAt !== undefined) {
        return new Response(null, { status: 204 });
      }
      if (isClosingUnderActiveForeignLease(stored, harness)) {
        return new Response(null, { status: 204 });
      }
      await harness.closeSession({ sessionId: pathSessionId, resourceId });
      return new Response(null, { status: 204 });
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});
