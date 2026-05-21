import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

import type {
  AttachmentRef,
  GoalOptions,
  GoalState,
  HarnessChannelDiagnostics,
  HarnessMessage,
  InboxResponseResult,
  PermissionRules,
  SessionDisplayState,
  SessionGrants,
  SessionRecord,
  HarnessEvent,
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
  harnessChannelDiagnosticsQuerySchema,
  harnessChannelDiagnosticsResponseSchema,
  harnessAttachmentPathParams,
  harnessAttachmentUploadBodySchema,
  harnessAttachmentUploadResponseSchema,
  harnessGoalBodySchema,
  harnessGoalResponseSchema,
  harnessInboxPathParams,
  harnessInboxResponseBodySchema,
  harnessInboxResponseResultSchema,
  harnessMessageAdmissionBodySchema,
  harnessMessageAdmissionResponseSchema,
  harnessMessageResultPathParams,
  harnessModePatchSchema,
  harnessModeResponseSchema,
  harnessModelPatchSchema,
  harnessModelResponseSchema,
  harnessNamePathParams,
  harnessPermissionPatchSchema,
  harnessPermissionsResponseSchema,
  harnessQueueAdmissionBodySchema,
  harnessQueueAdmissionResponseSchema,
  harnessQueueResultPathParams,
  harnessOperationResultResponseSchema,
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
type PublicPendingResume = Omit<NonNullable<SessionRecord['pendingResume']>, 'runtimeDependencies'>;
type UrlAttachmentInput = {
  kind: 'url';
  url: string;
  name: string;
  mimeType?: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
};
type RefAttachmentInput = Omit<AttachmentRef, 'kind'> & {
  kind: 'ref';
  attachmentKind?: AttachmentRef['kind'];
};
type WireAttachmentInput = AttachmentRef | RefAttachmentInput | UrlAttachmentInput;
type HarnessFilePolicy = {
  maxInlineBytes: number;
  maxUrlBytes: number;
  urlFetchTimeoutMs: number;
  maxUrlRedirects: number;
  allowPrivateNetworkUrls: boolean;
  allowedUrlMimeTypes?: readonly string[];
};
type UrlIngestionTarget = {
  hostname: string;
  hostHeader: string;
  servername?: string;
};

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
    subscribe(listener: (event: HarnessEvent) => void): () => void;
    getEventReplayState(): Promise<{ epoch: string; oldestSequence: number; newestSequence: number } | null>;
    listEventsAfter(opts: {
      epoch: string;
      afterSequence: number;
      limit: number;
    }): Promise<Array<{ event: HarnessEvent; sequence: number }>>;
  }>;
  attachments: {
    upload(opts: unknown): Promise<AttachmentRef>;
    delete(opts: { sessionId: string; resourceId?: string; attachmentId: string }): Promise<void>;
  };
  getFileConfig?(): {
    maxUrlBytes?: number;
    maxInlineBytes?: number;
    urlFetchTimeoutMs?: number;
    maxUrlRedirects?: number;
    allowPrivateNetworkUrls?: boolean;
    allowedUrlMimeTypes?: readonly string[];
  };
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
  lookupMessageResult(opts: { sessionId: string; resourceId: string; signalId: string }): Promise<unknown>;
  lookupQueueResult(opts: { sessionId: string; resourceId: string; queuedItemId: string }): Promise<unknown>;
  getChannelDiagnostics?(opts: {
    sessionId: string;
    resourceId: string;
    limit?: number;
  }): Promise<HarnessChannelDiagnostics | null>;
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
type MessageAdmissionBody = Omit<Parameters<HarnessSessionLike['admitMessage']>[0], 'attachments'> & {
  attachments?: WireAttachmentInput[];
  files?: WireAttachmentInput[];
};
type QueueAdmissionBody = Omit<Parameters<HarnessSessionLike['admitQueue']>[0], 'attachments'> & {
  attachments?: WireAttachmentInput[];
  files?: WireAttachmentInput[];
};
type OperationLookupResponse =
  | { status: 'pending'; source: 'message' | 'queue'; runId?: string }
  | { status: 'completed'; source: 'message' | 'queue'; runId?: string; result: unknown }
  | { status: 'failed'; source: 'message' | 'queue'; runId?: string; error: { code: string; message: string } }
  | { status: 'expired'; source: 'message' | 'queue'; runId?: string; expiredAt?: number }
  | { status: 'not_found'; source: 'message' | 'queue' };

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
const DEFAULT_INLINE_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_URL_INGESTION_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_URL_INGESTION_TIMEOUT_MS = 30_000;
const DEFAULT_URL_INGESTION_MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

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

function preconditionFailedResponse(details: Record<string, unknown>): Response {
  return jsonResponse(
    toHarnessErrorBody(
      'harness.event_replay_unavailable',
      'Harness event replay cursor cannot be served; recover through session snapshot and result lookup routes',
      {
        ...details,
        recovery: {
          snapshot: 'GET /harness/:name/sessions/:sessionId',
          messageResult: 'GET /harness/:name/sessions/:sessionId/message-results/:signalId',
          queueResult: 'GET /harness/:name/sessions/:sessionId/queue/:queuedItemId/result',
        },
      },
      true,
    ),
    { status: 412 },
  );
}

function encodeHarnessSseEvent(event: HarnessEvent): Uint8Array {
  const data = JSON.stringify(event, harnessSseJsonReplacer);
  return new TextEncoder().encode(`id: ${event.id}\nevent: ${event.type}\ndata: ${data}\n\n`);
}

function harnessSseJsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      code: (value as { code?: string }).code ?? value.name ?? 'harness.message_failed',
      message: value.message,
    };
  }
  return value;
}

function projectOperationLookup(source: 'message' | 'queue', evidence: unknown): OperationLookupResponse {
  if (!evidence || typeof evidence !== 'object') return { status: 'not_found', source };
  const record = evidence as Record<string, unknown>;
  if (typeof record.expiresAt === 'number') {
    return {
      status: 'expired',
      source,
      ...(typeof record.runId === 'string' ? { runId: record.runId } : {}),
      expiredAt: record.expiresAt,
    };
  }
  if (source === 'message') {
    if (record.status === 'pending') {
      return { status: 'pending', source, ...(typeof record.runId === 'string' ? { runId: record.runId } : {}) };
    }
    if (record.status === 'completed') {
      return {
        status: 'completed',
        source,
        ...(typeof record.runId === 'string' ? { runId: record.runId } : {}),
        result: record.result,
      };
    }
    if (record.status === 'failed') {
      const error = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : {};
      return {
        status: 'failed',
        source,
        ...(typeof record.runId === 'string' ? { runId: record.runId } : {}),
        error: {
          code: typeof error.code === 'string' ? error.code : 'harness.operation_failed',
          message: typeof error.message === 'string' ? error.message : 'Harness operation failed',
        },
      };
    }
    return { status: 'not_found', source };
  }
  if (record.status === 'queued' || record.status === 'admitting' || record.status === 'accepted') {
    return { status: 'pending', source, ...(typeof record.runId === 'string' ? { runId: record.runId } : {}) };
  }
  if (record.status === 'completed') {
    return {
      status: 'completed',
      source,
      ...(typeof record.runId === 'string' ? { runId: record.runId } : {}),
      result: record.result,
    };
  }
  if (record.status === 'failed' || record.status === 'admission_failed' || record.status === 'dead') {
    const error = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>) : {};
    return {
      status: 'failed',
      source,
      ...(typeof record.runId === 'string' ? { runId: record.runId } : {}),
      error: {
        code: typeof error.code === 'string' ? error.code : 'harness.operation_failed',
        message: typeof error.message === 'string' ? error.message : 'Harness operation failed',
      },
    };
  }
  return { status: 'not_found', source };
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

function optionalRecordField(
  body: Record<string, unknown>,
  field: string,
  label: string,
): Record<string, unknown> | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwHarnessHttpError(400, 'harness.validation', `${label} "${field}" must be an object`, {
      field,
      reason: 'invalid',
    });
  }
  return { ...(value as Record<string, unknown>) };
}

function optionalStringField(body: Record<string, unknown>, field: string, label: string): string | undefined {
  const value = body[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    throwHarnessHttpError(400, 'harness.validation', `${label} "${field}" is invalid`, {
      field,
      reason: 'invalid',
    });
  }
  return value;
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

function isUint8ArrayLike(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array;
}

function binaryUploadField(value: unknown): Uint8Array | undefined {
  if (value === undefined) return undefined;
  if (isUint8ArrayLike(value)) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return undefined;
}

function jsonUploadFieldBytes(value: unknown, field: string, label: string): number {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('not JSON-serializable');
    return Buffer.byteLength(encoded);
  } catch {
    throwHarnessHttpError(400, 'harness.validation', `${label} "${field}" must be JSON-serializable`, {
      field,
      reason: 'invalid',
    });
  }
}

function assertInlineUploadBytes(bytes: number, policy: HarnessFilePolicy): void {
  if (bytes <= policy.maxInlineBytes) return;
  throwHarnessHttpError(400, 'harness.attachment_unavailable', 'Attachment exceeds the configured byte limit', {
    reason: 'too_large',
    maxBytes: policy.maxInlineBytes,
  });
}

function uploadOptionsFromBody(
  body: Record<string, unknown>,
  sessionId: string,
  resourceId: string,
  policy: HarnessFilePolicy,
): unknown {
  const label = 'Attachment upload';
  const kind = body.kind ?? 'file';
  const metadata = optionalRecordField(body, 'metadata', label);
  if (kind === 'primitive') {
    if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
      throwHarnessHttpError(400, 'harness.validation', `${label} requires "value"`, {
        field: 'value',
        reason: 'required',
      });
    }
    assertInlineUploadBytes(jsonUploadFieldBytes(body.value, 'value', label), policy);
    return {
      sessionId,
      resourceId,
      kind,
      name: requiredStringField(body, 'name', label),
      primitiveType: requiredStringField(body, 'primitiveType', label),
      value: body.value,
      ...(optionalStringField(body, 'mimeType', label)
        ? { mimeType: optionalStringField(body, 'mimeType', label) }
        : {}),
      ...(metadata ? { metadata } : {}),
    };
  }
  if (kind === 'element') {
    if (!Object.prototype.hasOwnProperty.call(body, 'payload')) {
      throwHarnessHttpError(400, 'harness.validation', `${label} requires "payload"`, {
        field: 'payload',
        reason: 'required',
      });
    }
    assertInlineUploadBytes(jsonUploadFieldBytes(body.payload, 'payload', label), policy);
    return {
      sessionId,
      resourceId,
      kind,
      name: requiredStringField(body, 'name', label),
      elementType: requiredStringField(body, 'elementType', label),
      payload: body.payload,
      ...(optionalRecordField(body, 'renderer', label)
        ? { renderer: optionalRecordField(body, 'renderer', label) }
        : {}),
      ...(optionalStringField(body, 'schemaId', label)
        ? { schemaId: optionalStringField(body, 'schemaId', label) }
        : {}),
      ...(optionalStringField(body, 'mimeType', label)
        ? { mimeType: optionalStringField(body, 'mimeType', label) }
        : {}),
      ...(metadata ? { metadata } : {}),
    };
  }
  if (kind !== 'file') {
    throwHarnessHttpError(400, 'harness.validation', `${label} kind is invalid`, {
      field: 'kind',
      reason: 'invalid',
    });
  }

  const data =
    binaryUploadField(body.file) ??
    binaryUploadField(body.data) ??
    binaryUploadField(body.payload) ??
    (typeof body.dataBase64 === 'string' ? Buffer.from(body.dataBase64, 'base64') : undefined);
  if (!data) {
    throwHarnessHttpError(400, 'harness.validation', `${label} requires binary "file", "data", or "payload"`, {
      field: 'file',
      reason: 'required',
    });
  }
  assertInlineUploadBytes(data.byteLength, policy);
  return {
    sessionId,
    resourceId,
    kind: 'file',
    data,
    filename: optionalStringField(body, 'filename', label) ?? optionalStringField(body, 'name', label) ?? 'attachment',
    contentType:
      optionalStringField(body, 'contentType', label) ??
      optionalStringField(body, 'mimeType', label) ??
      'application/octet-stream',
    ...(metadata ? { metadata } : {}),
  };
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

function isUrlAttachmentInput(attachment: WireAttachmentInput): attachment is UrlAttachmentInput {
  return (
    !!attachment &&
    typeof attachment === 'object' &&
    (attachment as { kind?: unknown }).kind === 'url' &&
    typeof (attachment as { url?: unknown }).url === 'string'
  );
}

function isRefAttachmentInput(attachment: WireAttachmentInput): attachment is RefAttachmentInput {
  return !!attachment && typeof attachment === 'object' && (attachment as { kind?: unknown }).kind === 'ref';
}

function filePolicyForHarness(harness: HarnessLike): HarnessFilePolicy {
  const config = harness.getFileConfig?.() ?? {};
  return {
    maxInlineBytes: config.maxInlineBytes ?? DEFAULT_INLINE_ATTACHMENT_MAX_BYTES,
    maxUrlBytes: config.maxUrlBytes ?? DEFAULT_URL_INGESTION_MAX_BYTES,
    urlFetchTimeoutMs: config.urlFetchTimeoutMs ?? DEFAULT_URL_INGESTION_TIMEOUT_MS,
    maxUrlRedirects: config.maxUrlRedirects ?? DEFAULT_URL_INGESTION_MAX_REDIRECTS,
    allowPrivateNetworkUrls: config.allowPrivateNetworkUrls ?? false,
    ...(config.allowedUrlMimeTypes ? { allowedUrlMimeTypes: config.allowedUrlMimeTypes } : {}),
  };
}

function isPrivateIpv4Address(address: string): boolean {
  const parts = address.split('.').map(part => Number.parseInt(part, 10));
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
  if (a !== undefined && a >= 224) return true;
  return false;
}

function normalizeUrlHostname(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
}

function ipv4FromMappedIpv6(address: string): string | undefined {
  if (!address.startsWith('::ffff:')) return undefined;
  const tail = address.slice('::ffff:'.length);
  if (isIP(tail) === 4) return tail;
  const hextets = tail.split(':');
  if (hextets.length !== 2) return undefined;
  const words = hextets.map(part => Number.parseInt(part, 16));
  if (words.some(word => !Number.isInteger(word) || word < 0 || word > 0xffff)) return undefined;
  return `${words[0]! >> 8}.${words[0]! & 0xff}.${words[1]! >> 8}.${words[1]! & 0xff}`;
}

function isIpv6LinkLocalAddress(address: string): boolean {
  const firstHextet = Number.parseInt(address.split(':', 1)[0] ?? '', 16);
  return Number.isInteger(firstHextet) && firstHextet >= 0xfe80 && firstHextet <= 0xfebf;
}

function isPrivateIpAddress(address: string): boolean {
  const normalized = normalizeUrlHostname(address);
  if (isIP(normalized) === 4) {
    return isPrivateIpv4Address(normalized);
  }
  if (isIP(normalized) === 6) {
    const lower = normalized.toLowerCase();
    const mappedIpv4 = ipv4FromMappedIpv6(lower);
    if (mappedIpv4) return isPrivateIpv4Address(mappedIpv4);
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      isIpv6LinkLocalAddress(lower) ||
      lower.startsWith('ff')
    );
  }
  return false;
}

function throwUrlIngestionAborted(url: URL): never {
  throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment fetch timed out', {
    reason: 'fetch_timeout',
    url: url.toString(),
  });
}

async function abortableLookup(hostname: string, url: URL, signal: AbortSignal) {
  if (signal.aborted) throwUrlIngestionAborted(url);
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => {
      try {
        throwUrlIngestionAborted(url);
      } catch (error) {
        reject(error);
      }
    };
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([lookup(hostname, { all: true }), aborted]);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}

async function resolveUrlIngestionTargets(
  url: URL,
  policy: HarnessFilePolicy,
  signal: AbortSignal,
): Promise<UrlIngestionTarget[]> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachments must use http or https', {
      reason: 'unsupported_url',
      url: url.toString(),
    });
  }
  const hostname = normalizeUrlHostname(url.hostname);
  if (policy.allowPrivateNetworkUrls) {
    return [{ hostname, hostHeader: url.host, ...(url.protocol === 'https:' ? { servername: hostname } : {}) }];
  }
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal'
  ) {
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment target is not allowed', {
      reason: 'network_target_blocked',
      host: hostname,
    });
  }
  if (isPrivateIpAddress(hostname)) {
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment target is not allowed', {
      reason: 'network_target_blocked',
      host: hostname,
    });
  }
  if (isIP(hostname)) {
    return [{ hostname, hostHeader: url.host, ...(url.protocol === 'https:' ? { servername: hostname } : {}) }];
  }
  try {
    const addresses = await abortableLookup(hostname, url, signal);
    if (addresses.some(entry => isPrivateIpAddress(entry.address))) {
      throwHarnessHttpError(
        400,
        'harness.attachment_unavailable',
        'URL attachment target resolves to a private address',
        {
          reason: 'network_target_blocked',
          host: hostname,
        },
      );
    }
    const targets = addresses.map(entry => ({
      hostname: entry.address,
      hostHeader: url.host,
      ...(url.protocol === 'https:' ? { servername: hostname } : {}),
    }));
    if (targets.length > 0) {
      return targets;
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment target could not be resolved', {
      reason: 'not_found',
      host: hostname,
    });
  }
  throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment target could not be resolved', {
    reason: 'not_found',
    host: hostname,
  });
}

function makeUrlIngestionSignal(
  policy: HarnessFilePolicy,
  parentSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), policy.urlFetchTimeoutMs);
  const abort = () => controller.abort();
  parentSignal?.addEventListener('abort', abort, { once: true });
  if (parentSignal?.aborted) controller.abort();
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abort);
    },
  };
}

function compatibleMimeType(declared: string | undefined, received: string | null): boolean {
  if (!declared || !received) return true;
  const declaredBase = declared.split(';', 1)[0]?.trim().toLowerCase();
  const receivedBase = received.split(';', 1)[0]?.trim().toLowerCase();
  return !!declaredBase && !!receivedBase && declaredBase === receivedBase;
}

function matchesAllowedMimeType(mimeType: string, allowed: string): boolean {
  const mime = mimeType.split(';', 1)[0]?.trim().toLowerCase();
  const pattern = allowed.trim().toLowerCase();
  if (!mime || !pattern) return false;
  if (pattern.endsWith('/*')) return mime.startsWith(`${pattern.slice(0, -1)}`);
  return mime === pattern;
}

function assertAllowedUrlMimeType(mimeType: string, policy: HarnessFilePolicy, url: string): void {
  if (!policy.allowedUrlMimeTypes || policy.allowedUrlMimeTypes.length === 0) return;
  if (policy.allowedUrlMimeTypes.some(pattern => matchesAllowedMimeType(mimeType, pattern))) return;
  throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment MIME type is blocked by policy', {
    reason: 'blocked_by_policy',
    url,
    mimeType,
    allowedUrlMimeTypes: policy.allowedUrlMimeTypes,
  });
}

function headerValue(headers: IncomingHttpHeaders, name: string): string | null {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function readIncomingBytes(
  response: IncomingMessage,
  url: string,
  policy: HarnessFilePolicy,
): Promise<Uint8Array> {
  const contentLength = headerValue(response.headers, 'content-length');
  if (contentLength !== null && Number(contentLength) > policy.maxUrlBytes) {
    response.destroy();
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment exceeds the configured byte limit', {
      reason: 'too_large',
      url,
      maxBytes: policy.maxUrlBytes,
    });
  }

  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of response) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : new Uint8Array(chunk);
    bytes += value.byteLength;
    if (bytes > policy.maxUrlBytes) {
      response.destroy();
      throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment exceeds the configured byte limit', {
        reason: 'too_large',
        url,
        maxBytes: policy.maxUrlBytes,
      });
    }
    chunks.push(value);
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

async function requestUrlAttachmentBytes(
  url: URL,
  target: UrlIngestionTarget,
  input: UrlAttachmentInput,
  policy: HarnessFilePolicy,
  signal: AbortSignal,
): Promise<{ status: number; headers: IncomingHttpHeaders; data: Uint8Array }> {
  if (signal.aborted) throwUrlIngestionAborted(url);
  const client = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const options: RequestOptions = {
    protocol: url.protocol,
    hostname: target.hostname,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    headers: {
      host: target.hostHeader,
      ...(input.mimeType ? { accept: input.mimeType } : {}),
    },
    ...(target.servername ? { servername: target.servername } : {}),
  };
  return await new Promise((resolve, reject) => {
    const req = client(options, response => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        const headers = response.headers;
        response.destroy();
        resolve({ status, headers, data: new Uint8Array() });
        return;
      }
      readIncomingBytes(response, url.toString(), policy)
        .then(data => resolve({ status, headers: response.headers, data }))
        .catch(reject);
    });
    const abort = () => req.destroy(new Error('aborted'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    req.on('error', reject);
    req.on('close', () => signal.removeEventListener('abort', abort));
    req.end();
  });
}

async function fetchUrlAttachmentBytes(
  input: UrlAttachmentInput,
  policy: HarnessFilePolicy,
  abortSignal?: AbortSignal,
): Promise<{ data: Uint8Array; mimeType: string; sha256: string }> {
  let current = new URL(input.url);
  const { signal, cleanup } = makeUrlIngestionSignal(policy, abortSignal);
  try {
    for (let redirect = 0; redirect <= policy.maxUrlRedirects; redirect += 1) {
      const targets = await resolveUrlIngestionTargets(current, policy, signal);
      let response: Awaited<ReturnType<typeof requestUrlAttachmentBytes>> | undefined;
      let fetchError: unknown;
      for (const target of targets) {
        try {
          response = await requestUrlAttachmentBytes(current, target, input, policy, signal);
          break;
        } catch (error) {
          if (error instanceof HTTPException) throw error;
          if (signal.aborted) throwUrlIngestionAborted(current);
          fetchError = error;
        }
      }
      if (!response) {
        if (fetchError) throw fetchError;
        throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment target could not be resolved', {
          reason: 'not_found',
          url: current.toString(),
        });
      }
      if (REDIRECT_STATUSES.has(response.status)) {
        const location = headerValue(response.headers, 'location');
        if (!location || redirect === policy.maxUrlRedirects) {
          throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment exceeded redirect policy', {
            reason: 'redirect_limit_exceeded',
            url: current.toString(),
            maxRedirects: policy.maxUrlRedirects,
          });
        }
        current = new URL(location, current);
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment could not be fetched', {
          reason: 'not_found',
          url: current.toString(),
          status: response.status,
        });
      }
      const responseMimeType = headerValue(response.headers, 'content-type');
      if (!compatibleMimeType(input.mimeType, responseMimeType)) {
        throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment MIME type does not match', {
          reason: 'mime_mismatch',
          url: current.toString(),
          declaredMimeType: input.mimeType,
          responseMimeType,
        });
      }
      const mimeType = input.mimeType ?? responseMimeType?.split(';', 1)[0]?.trim() ?? 'application/octet-stream';
      assertAllowedUrlMimeType(mimeType, policy, current.toString());
      const data = response.data;
      const sha256 = createHash('sha256').update(data).digest('hex');
      if (input.sha256 && input.sha256 !== sha256) {
        throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment digest does not match', {
          reason: 'digest_mismatch',
          url: current.toString(),
          expectedSha256: input.sha256,
          actualSha256: sha256,
        });
      }
      return {
        data,
        mimeType,
        sha256,
      };
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment could not be fetched', {
      reason: signal.aborted ? 'fetch_timeout' : 'not_found',
      url: current.toString(),
    });
  } finally {
    cleanup();
  }
  throwHarnessHttpError(400, 'harness.attachment_unavailable', 'URL attachment exceeded redirect policy', {
    reason: 'redirect_limit_exceeded',
    url: current.toString(),
  });
}

function deterministicUrlAttachmentId(
  operationKind: 'message' | 'queue',
  sessionId: string,
  admissionId: string,
  index: number,
): string {
  const digest = createHash('sha256')
    .update(`harness-url-attachment\0${operationKind}\0${sessionId}\0${admissionId}\0${index}`)
    .digest('hex');
  return `attachment-url-${digest.slice(0, 40)}`;
}

async function normalizeAdmissionAttachments(
  harness: HarnessLike,
  operationKind: 'message' | 'queue',
  sessionId: string,
  resourceId: string,
  body: MessageAdmissionBody | QueueAdmissionBody,
  abortSignal?: AbortSignal,
): Promise<AttachmentRef[] | undefined> {
  if (body.files !== undefined && body.attachments !== undefined) {
    throwHarnessHttpError(400, 'harness.validation', 'Use either "attachments" or "files", not both', {
      field: 'attachments',
      reason: 'exclusive',
    });
  }
  const attachments = body.files ?? body.attachments;
  if (!attachments) return undefined;
  const policy = filePolicyForHarness(harness);
  const normalized: AttachmentRef[] = [];
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index]!;
    if (isRefAttachmentInput(attachment)) {
      const { kind: _kind, attachmentKind, ...ref } = attachment;
      normalized.push({ ...ref, ...(attachmentKind ? { kind: attachmentKind } : {}) });
      continue;
    }
    if (!isUrlAttachmentInput(attachment)) {
      normalized.push(attachment as AttachmentRef);
      continue;
    }
    const fetched = await fetchUrlAttachmentBytes(attachment, policy, abortSignal);
    const ref = await harness.attachments.upload({
      sessionId,
      resourceId,
      kind: 'file',
      data: fetched.data,
      filename: attachment.name,
      contentType: fetched.mimeType,
      attachmentId: deterministicUrlAttachmentId(operationKind, sessionId, body.admissionId, index),
      source: 'url',
      ...(attachment.metadata ? { metadata: attachment.metadata } : {}),
    });
    normalized.push(ref);
  }
  return normalized;
}

async function normalizeMessageAdmissionBody(
  harness: HarnessLike,
  sessionId: string,
  resourceId: string,
  body: MessageAdmissionBody,
  abortSignal?: AbortSignal,
): Promise<Parameters<HarnessSessionLike['admitMessage']>[0]> {
  const { files: _files, attachments: _attachments, ...rest } = body;
  const attachments = await normalizeAdmissionAttachments(harness, 'message', sessionId, resourceId, body, abortSignal);
  return { ...rest, ...(attachments ? { attachments } : {}) };
}

async function normalizeQueueAdmissionBody(
  harness: HarnessLike,
  sessionId: string,
  resourceId: string,
  body: QueueAdmissionBody,
  abortSignal?: AbortSignal,
): Promise<Parameters<HarnessSessionLike['admitQueue']>[0]> {
  const { files: _files, attachments: _attachments, ...rest } = body;
  const attachments = await normalizeAdmissionAttachments(harness, 'queue', sessionId, resourceId, body, abortSignal);
  return { ...rest, ...(attachments ? { attachments } : {}) };
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

const HARNESS_EVENT_ID_PREFIX = 'harness-v1';

interface ParsedHarnessEventId {
  epoch: string;
  sequence: number;
}

class HarnessRouteValidationError extends Error {
  readonly name = 'HarnessValidationError';

  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`HarnessValidationError at ${field}: ${reason}`);
  }
}

function parseHarnessEventId(eventId: string): ParsedHarnessEventId {
  const parts = eventId.split(':');
  if (parts.length !== 3 || parts[0] !== HARNESS_EVENT_ID_PREFIX || parts[1] === '' || parts[2] === '') {
    throw new HarnessRouteValidationError('lastEventId', 'expected event id grammar harness-v1:<epoch>:<seq>');
  }
  const sequenceText = parts[2]!;
  if (!/^(0|[1-9][0-9]*)$/.test(sequenceText)) {
    throw new HarnessRouteValidationError('lastEventId', 'event id sequence must be an unsigned decimal integer');
  }
  const sequence = Number(sequenceText);
  if (!Number.isSafeInteger(sequence)) {
    throw new HarnessRouteValidationError(
      'lastEventId',
      'event id sequence must be within JavaScript safe integer range',
    );
  }
  return { epoch: parts[1]!, sequence };
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
  if (name === 'HarnessStorageSessionEventReplayUnsupportedError') {
    throwHarnessHttpError(501, 'harness.event_replay_unsupported', message, undefined, false);
  }
  if (name === 'HarnessStorageChannelDiagnosticsUnsupportedError') {
    throwHarnessHttpError(501, 'harness.channel_diagnostics_unsupported', message, undefined, false);
  }
  if (
    name === 'HarnessRuntimeDependencyDriftError' ||
    name === 'harness.runtime_dependency_drifted' ||
    harnessErrorString(error, 'code') === 'harness.runtime_dependency_drifted'
  ) {
    const context = harnessErrorProp(error, 'context');
    throwHarnessHttpError(409, 'harness.runtime_dependency_drifted', message, {
      dependencyKind: harnessErrorString(error, 'dependencyKind') ?? harnessErrorString(error, 'kind'),
      dependencyId: harnessErrorString(error, 'dependencyId') ?? harnessErrorString(error, 'id'),
      reason: harnessErrorString(error, 'reason'),
      ...(context !== undefined ? { context } : {}),
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
  if (name === 'HarnessAttachmentInUseError') {
    throwHarnessHttpError(409, 'harness.attachment_in_use', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
      attachmentId: harnessErrorString(error, 'attachmentId'),
      references: harnessErrorProp(error, 'references'),
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
    throwHarnessHttpError(404, 'harness.session_not_found', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
    });
  }
  if (name === 'HarnessSessionClosedError') {
    throwHarnessHttpError(404, 'harness.session_closed', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
    });
  }
  if (name === 'HarnessSessionDeletedError') {
    throwHarnessHttpError(404, 'harness.session_deleted', message, {
      sessionId: harnessErrorString(error, 'sessionId'),
    });
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
    pending: pendingResumeForDisplay(record.pendingResume),
    queueDepth: record.pendingQueue.length,
    ...(record.goal !== undefined ? { goal: record.goal } : {}),
  };
}

function pendingResumeForDisplay(pending: SessionRecord['pendingResume']): PublicPendingResume | null {
  if (!pending) return null;
  const { runtimeDependencies: _runtimeDependencies, ...displayPending } = pending;
  return displayPending;
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
    pendingInbox: record.pendingResume ? [pendingResumeForDisplay(record.pendingResume)] : [],
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
  handler: async ({ mastra, requestContext, name, requestBody, requestPathParams }) => {
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

export const GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/channel-diagnostics',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  queryParamSchema: harnessChannelDiagnosticsQuerySchema,
  responseSchema: harnessChannelDiagnosticsResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Get Harness channel diagnostics',
  description: 'Returns redacted, read-only channel ledger diagnostics for a resource-scoped Harness session.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, limit, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      if (!harness.getChannelDiagnostics) {
        throwHarnessHttpError(
          501,
          'harness.channel_diagnostics_unsupported',
          'Harness channel diagnostics are unavailable',
        );
      }
      const diagnostics = await harness.getChannelDiagnostics({ sessionId: pathSessionId, resourceId, limit });
      if (!diagnostics) {
        throwSessionNotFound(pathSessionId);
      }
      return diagnostics;
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const POST_HARNESS_ATTACHMENT_ROUTE = createRoute({
  method: 'POST',
  path: '/harness/:name/sessions/:sessionId/attachments',
  responseType: 'json',
  pathParamSchema: harnessSessionPathParams,
  bodySchema: harnessAttachmentUploadBodySchema,
  responseSchema: harnessAttachmentUploadResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Upload a Harness session attachment',
  description: 'Stores a session-scoped attachment and returns its durable Harness attachment reference.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Attachment upload');
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      return await harness.attachments.upload(
        uploadOptionsFromBody(body, pathSessionId, resourceId, filePolicyForHarness(harness)),
      );
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const DELETE_HARNESS_ATTACHMENT_ROUTE = createRoute({
  method: 'DELETE',
  path: '/harness/:name/sessions/:sessionId/attachments/:attachmentId',
  responseType: 'datastream-response',
  pathParamSchema: harnessAttachmentPathParams,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Delete an unused Harness session attachment',
  description: 'Deletes an unused pre-uploaded attachment, preserving guarded-delete reference checks.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, attachmentId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const pathAttachmentId = stringPathParam(requestPathParams, attachmentId, 'attachmentId');
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      await harness.attachments.delete({ sessionId: pathSessionId, resourceId, attachmentId: pathAttachmentId });
      return new Response(null, { status: 204 });
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
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams, abortSignal }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Message admission') as MessageAdmissionBody;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return await session.admitMessage(
        await normalizeMessageAdmissionBody(harness, pathSessionId, resourceId, body, abortSignal),
      );
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
  handler: async ({ mastra, requestContext, name, sessionId, requestBody, requestPathParams, abortSignal }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const body = objectRequestBody(requestBody, 'Queue admission') as QueueAdmissionBody;
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      return await session.admitQueue(
        await normalizeQueueAdmissionBody(harness, pathSessionId, resourceId, body, abortSignal),
      );
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_MESSAGE_RESULT_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/message-results/:signalId',
  responseType: 'json',
  pathParamSchema: harnessMessageResultPathParams,
  responseSchema: harnessOperationResultResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Lookup Harness message result',
  description: 'Reads non-admitting message operation result evidence for reconnect recovery.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, signalId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const pathSignalId = stringPathParam(requestPathParams, signalId, 'signalId');
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      return projectOperationLookup(
        'message',
        await harness.lookupMessageResult({ sessionId: pathSessionId, resourceId, signalId: pathSignalId }),
      );
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_QUEUE_RESULT_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/queue/:queuedItemId/result',
  responseType: 'json',
  pathParamSchema: harnessQueueResultPathParams,
  responseSchema: harnessOperationResultResponseSchema,
  requiresAuth: true,
  harnessAuth: { clientRoute: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Lookup Harness queue result',
  description: 'Reads non-admitting queue operation result evidence for reconnect recovery.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, queuedItemId, requestPathParams }) => {
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const pathQueuedItemId = stringPathParam(requestPathParams, queuedItemId, 'queuedItemId');
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      return projectOperationLookup(
        'queue',
        await harness.lookupQueueResult({ sessionId: pathSessionId, resourceId, queuedItemId: pathQueuedItemId }),
      );
    } catch (error) {
      return mapHarnessError(error);
    }
  },
});

export const GET_HARNESS_SESSION_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/harness/:name/sessions/:sessionId/events',
  responseType: 'datastream-response',
  pathParamSchema: harnessSessionPathParams,
  requiresAuth: true,
  harnessAuth: { clientRoute: true, allowSseSubscriptionToken: true },
  onValidationError: harnessValidationErrorHook,
  summary: 'Stream Harness session events',
  description: 'Streams typed Harness session events with Last-Event-ID replay and 412 recovery.',
  tags: ['Harness'],
  handler: async ({ mastra, requestContext, name, sessionId, getHeader, abortSignal, requestPathParams }) => {
    let unsubscribe: (() => void) | undefined;
    try {
      const { pathName, pathSessionId } = harnessSessionPathIdentity(requestPathParams, name, sessionId);
      const resourceId = getAuthResourceId(requestContext);
      const harness = resolveHarness(mastra as unknown as { getHarness(name: string): HarnessLike }, pathName);
      const stored = await harness.loadSession({ sessionId: pathSessionId, includeClosed: true });
      if (!stored || stored.resourceId !== resourceId) {
        throwSessionNotFound(pathSessionId);
      }
      if (stored.closedAt !== undefined) throwSessionClosed(pathSessionId);
      if (stored.closingAt !== undefined) throwSessionClosingFromRecord(stored);

      const lastEventId = getHeader?.('last-event-id');
      const parsed = lastEventId ? parseHarnessEventId(lastEventId) : undefined;
      const session = await harness.session({ sessionId: pathSessionId, resourceId });
      const liveQueue: HarnessEvent[] = [];
      const replayedEventIds = new Set<string>();
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      let replaying = parsed !== undefined;
      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        unsubscribe = undefined;
      };
      unsubscribe = session.subscribe(event => {
        if (closed) return;
        if (!controller || replaying) {
          liveQueue.push(event);
          return;
        }
        if (replayedEventIds.has(event.id)) return;
        try {
          controller.enqueue(encodeHarnessSseEvent(event));
        } catch {
          cleanup();
        }
      });

      let replayState:
        | {
            epoch: string;
            oldestSequence: number;
            newestSequence: number;
          }
        | null
        | undefined;
      if (parsed) {
        replayState = await session.getEventReplayState();
        if (
          !replayState ||
          replayState.epoch !== parsed.epoch ||
          parsed.sequence < replayState.oldestSequence - 1 ||
          parsed.sequence > replayState.newestSequence
        ) {
          cleanup();
          return preconditionFailedResponse({
            reason: !replayState || replayState.epoch !== parsed.epoch ? 'stale_epoch' : 'unreplayable_gap',
            lastEventId,
            sessionId: pathSessionId,
          });
        }

        let afterSequence = parsed.sequence;
        let expectedSequence = parsed.sequence + 1;
        while (expectedSequence <= replayState.newestSequence) {
          if (abortSignal?.aborted) {
            cleanup();
            return new Response(null, { status: 204 });
          }
          const page = (
            await session.listEventsAfter({
              epoch: parsed.epoch,
              afterSequence,
              limit: 1000,
            })
          ).filter(row => row.sequence <= replayState!.newestSequence);
          if (page.length === 0) {
            cleanup();
            return preconditionFailedResponse({ reason: 'unreplayable_gap', lastEventId, sessionId: pathSessionId });
          }
          for (const row of page) {
            if (row.sequence !== expectedSequence) {
              cleanup();
              return preconditionFailedResponse({ reason: 'unreplayable_gap', lastEventId, sessionId: pathSessionId });
            }
            afterSequence = row.sequence;
            expectedSequence += 1;
          }
        }
      }

      const stream = new ReadableStream<Uint8Array>({
        async start(streamController) {
          controller = streamController;
          const abortCleanup = () => {
            cleanup();
            try {
              streamController.close();
            } catch {}
          };
          abortSignal?.addEventListener('abort', abortCleanup, { once: true });
          if (abortSignal?.aborted) {
            abortCleanup();
            return;
          }

          try {
            if (parsed && replayState) {
              let afterSequence = parsed.sequence;
              let expectedSequence = parsed.sequence + 1;
              while (expectedSequence <= replayState.newestSequence) {
                if (abortSignal?.aborted || closed) return;
                const page = (
                  await session.listEventsAfter({
                    epoch: parsed.epoch,
                    afterSequence,
                    limit: 1000,
                  })
                ).filter(row => row.sequence <= replayState!.newestSequence);
                if (page.length === 0) {
                  cleanup();
                  streamController.error(new Error('Harness event replay gap appeared after preflight'));
                  return;
                }
                for (const row of page) {
                  if (row.sequence !== expectedSequence) {
                    cleanup();
                    streamController.error(new Error('Harness event replay gap appeared after preflight'));
                    return;
                  }
                  replayedEventIds.add(row.event.id);
                  streamController.enqueue(encodeHarnessSseEvent(row.event));
                  afterSequence = row.sequence;
                  expectedSequence += 1;
                }
              }
            }
            replaying = false;
            for (const event of liveQueue.splice(0)) {
              if (replayedEventIds.has(event.id)) continue;
              streamController.enqueue(encodeHarnessSseEvent(event));
            }
          } catch (error) {
            cleanup();
            streamController.error(error);
          }
        },
        cancel() {
          cleanup();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        },
      });
    } catch (error) {
      unsubscribe?.();
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
          await session.permissions.grantCategory({
            category: requiredStringField(body, 'category', 'Permissions patch'),
          });
          break;
        case 'grantTool':
          await session.permissions.grantTool({ toolName: requiredStringField(body, 'toolName', 'Permissions patch') });
          break;
        case 'revokeCategory':
          await session.permissions.revokeCategory({
            category: requiredStringField(body, 'category', 'Permissions patch'),
          });
          break;
        case 'revokeTool':
          await session.permissions.revokeTool({
            toolName: requiredStringField(body, 'toolName', 'Permissions patch'),
          });
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
