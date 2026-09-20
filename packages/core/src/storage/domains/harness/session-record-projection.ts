import { createHash } from 'node:crypto';

import type {
  HarnessSessionRecordPostImage,
  HarnessSessionRecordProjectionConfig,
  HarnessSessionRecordProjectionFence,
  HarnessSessionRecordProjectionIntent,
  HarnessSessionRecordProjectionOption,
  HarnessSessionRecordProjectionPendingResume,
  HarnessSessionRecordProjectionRun,
  SessionRecord,
} from './types';
import { HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA, HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA_VERSION } from './types';

export const DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PAYLOAD_BYTES = 256 * 1024;
export const DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_ATTEMPTS = 8;
export const DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PENDING_INTENTS = 10_000;
export const DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PENDING_BYTES = 64 * 1024 * 1024;
export const MAX_HARNESS_SESSION_RECORD_PROJECTION_ID_CHARS = 1024;

export interface NormalizedHarnessSessionRecordProjectionConfig {
  enabled: boolean;
  maxPayloadBytes: number;
  maxAttempts: number;
  maxPendingIntents: number;
  maxPendingBytes: number;
}

export function normalizeHarnessSessionRecordProjectionConfig(
  option?: HarnessSessionRecordProjectionOption,
): NormalizedHarnessSessionRecordProjectionConfig {
  const input: HarnessSessionRecordProjectionConfig =
    typeof option === 'boolean' ? { enabled: option } : (option ?? {});
  const normalized = {
    enabled: input.enabled === true,
    maxPayloadBytes: input.maxPayloadBytes ?? DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PAYLOAD_BYTES,
    maxAttempts: input.maxAttempts ?? DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_ATTEMPTS,
    maxPendingIntents: input.maxPendingIntents ?? DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PENDING_INTENTS,
    maxPendingBytes: input.maxPendingBytes ?? DEFAULT_HARNESS_SESSION_RECORD_PROJECTION_MAX_PENDING_BYTES,
  };
  if (
    !Number.isSafeInteger(normalized.maxPayloadBytes) ||
    normalized.maxPayloadBytes <= 0 ||
    !Number.isSafeInteger(normalized.maxAttempts) ||
    normalized.maxAttempts <= 0 ||
    !Number.isSafeInteger(normalized.maxPendingIntents) ||
    normalized.maxPendingIntents <= 0 ||
    !Number.isSafeInteger(normalized.maxPendingBytes) ||
    normalized.maxPendingBytes <= 0
  ) {
    throw new RangeError('Harness session record projection bounds must be positive safe integers');
  }
  return normalized;
}

/**
 * Build the bounded record-only payload. This helper deliberately has no
 * access to a live Session, so it cannot accidentally capture active tools,
 * input buffers, subagents, callbacks, or other process-local state.
 */
export function buildHarnessSessionRecordPostImage(
  record: SessionRecord,
  options: { maxPayloadBytes: number },
): { payload: HarnessSessionRecordPostImage; payloadDigest: string; payloadBytes: number } {
  assertPositiveSafeInteger(options.maxPayloadBytes, 'maxPayloadBytes');
  if (record.sessionIncarnation !== undefined) boundedId(record.sessionIncarnation);
  boundedId(record.harnessName);
  assertNonNegativeSafeInteger(record.createdAt, 'createdAt');
  assertNonNegativeSafeInteger(record.lastActivityAt, 'lastActivityAt');
  if (record.closingAt !== undefined) assertNonNegativeSafeInteger(record.closingAt, 'closingAt');
  if (record.closeDeadlineAt !== undefined) assertNonNegativeSafeInteger(record.closeDeadlineAt, 'closeDeadlineAt');
  if (record.closedAt !== undefined) assertNonNegativeSafeInteger(record.closedAt, 'closedAt');
  assertNonNegativeSafeInteger(record.tokenUsage.promptTokens, 'tokenUsage.promptTokens');
  assertNonNegativeSafeInteger(record.tokenUsage.completionTokens, 'tokenUsage.completionTokens');
  assertNonNegativeSafeInteger(record.tokenUsage.totalTokens, 'tokenUsage.totalTokens');
  if (!Array.isArray(record.pendingQueue)) {
    throw new TypeError('Session projection pendingQueue must be an array');
  }

  const payload: HarnessSessionRecordPostImage = {
    schema: HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA,
    schemaVersion: HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA_VERSION,
    sessionId: boundedId(record.id),
    threadId: boundedId(record.threadId),
    resourceId: boundedId(record.resourceId),
    ...(record.parentSessionId !== undefined ? { parentSessionId: boundedId(record.parentSessionId) } : {}),
    modeId: boundedId(record.modeId),
    // A session may be created before a model override is selected; preserve
    // the existing empty model configuration instead of manufacturing an ID.
    modelId: boundedText(record.modelId, MAX_HARNESS_SESSION_RECORD_PROJECTION_ID_CHARS),
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    lifecycle: sessionLifecycle(record),
    tokenUsage: {
      promptTokens: record.tokenUsage.promptTokens,
      completionTokens: record.tokenUsage.completionTokens,
      totalTokens: record.tokenUsage.totalTokens,
    },
    queueDepth: record.pendingQueue.length,
    ...(record.pendingResume !== undefined ? { pendingResume: projectPendingResume(record.pendingResume) } : {}),
    ...(record.currentRun !== undefined ? { currentRun: projectCurrentRun(record.currentRun) } : {}),
  };

  let serialized = stableJsonString(payload);
  const payloadBytes = utf8Bytes(serialized);
  if (payloadBytes > options.maxPayloadBytes) {
    throw new RangeError(
      `Session record projection payload for "${record.id}" exceeds ${options.maxPayloadBytes} UTF-8 bytes`,
    );
  }
  return {
    payload,
    payloadDigest: sha256(serialized),
    payloadBytes,
  };
}

export function buildHarnessSessionRecordProjectionIntent(
  record: SessionRecord,
  options: {
    sessionIncarnation: string;
    revision: number;
    createdAt: number;
    maxPayloadBytes: number;
  },
): HarnessSessionRecordProjectionIntent {
  boundedId(options.sessionIncarnation);
  assertPositiveSafeInteger(options.revision, 'revision', `Session "${record.id}" projection`);
  assertNonNegativeSafeInteger(options.createdAt, 'createdAt');
  const { payload, payloadDigest, payloadBytes } = buildHarnessSessionRecordPostImage(record, options);
  const operationId = sha256(
    stableJsonString({
      schema: HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA,
      schemaVersion: HARNESS_SESSION_RECORD_POST_IMAGE_SCHEMA_VERSION,
      harnessName: record.harnessName,
      sessionId: record.id,
      sessionIncarnation: options.sessionIncarnation,
      revision: options.revision,
      payloadDigest,
    }),
  );
  return {
    id: operationId,
    operationId,
    harnessName: record.harnessName,
    sessionId: record.id,
    sessionIncarnation: options.sessionIncarnation,
    resourceId: record.resourceId,
    threadId: record.threadId,
    revision: options.revision,
    payloadDigest,
    payloadBytes,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  };
}

export function projectHarnessSessionRecordProjectionFence(
  record: SessionRecord,
  options: { sessionIncarnation: string; state: 'active' | 'deleted'; revision: number; updatedAt: number },
): HarnessSessionRecordProjectionFence {
  boundedId(options.sessionIncarnation);
  assertPositiveSafeInteger(options.revision, 'revision', `Session "${record.id}" projection`);
  assertNonNegativeSafeInteger(options.updatedAt, 'updatedAt');
  return {
    harnessName: record.harnessName,
    sessionId: record.id,
    sessionIncarnation: options.sessionIncarnation,
    resourceId: record.resourceId,
    threadId: record.threadId,
    revision: options.revision,
    state: options.state,
    updatedAt: options.updatedAt,
  };
}

function projectPendingResume(
  pending: NonNullable<SessionRecord['pendingResume']>,
): HarnessSessionRecordProjectionPendingResume {
  assertNonNegativeSafeInteger(pending.requestedAt, 'pendingResume.requestedAt');
  assertNonNegativeSafeInteger(pending.expiresAt, 'pendingResume.expiresAt');
  if (pending.resumedAt !== undefined) assertNonNegativeSafeInteger(pending.resumedAt, 'pendingResume.resumedAt');
  if (pending.resumeRecoveryAt !== undefined) {
    assertNonNegativeSafeInteger(pending.resumeRecoveryAt, 'pendingResume.resumeRecoveryAt');
  }
  return {
    kind: pending.kind,
    ...(pending.itemId !== undefined ? { itemId: boundedId(pending.itemId) } : {}),
    runId: boundedId(pending.runId),
    toolCallId: boundedId(pending.toolCallId),
    ...(pending.toolName !== undefined ? { toolName: boundedId(pending.toolName) } : {}),
    source: pending.source,
    ...(pending.subagentToolCallId !== undefined ? { subagentToolCallId: boundedId(pending.subagentToolCallId) } : {}),
    requestedAt: pending.requestedAt,
    expiresAt: pending.expiresAt,
    ...(pending.queuedItemId !== undefined ? { queuedItemId: boundedId(pending.queuedItemId) } : {}),
    ...(pending.originSignalId !== undefined ? { originSignalId: boundedId(pending.originSignalId) } : {}),
    ...(pending.modeId !== undefined ? { modeId: boundedId(pending.modeId) } : {}),
    ...(pending.resumedAt !== undefined ? { resumedAt: pending.resumedAt } : {}),
    ...(pending.resumeRecoveryAt !== undefined ? { resumeRecoveryAt: pending.resumeRecoveryAt } : {}),
  };
}

function projectCurrentRun(run: NonNullable<SessionRecord['currentRun']>): HarnessSessionRecordProjectionRun {
  assertNonNegativeSafeInteger(run.startedAt, 'currentRun.startedAt');
  assertNonNegativeSafeInteger(run.updatedAt, 'currentRun.updatedAt');
  if (run.terminalAt !== undefined) assertNonNegativeSafeInteger(run.terminalAt, 'currentRun.terminalAt');
  return {
    runId: boundedId(run.runId),
    status: run.status,
    modeId: boundedId(run.modeId),
    modelId: boundedText(run.modelId, MAX_HARNESS_SESSION_RECORD_PROJECTION_ID_CHARS),
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    ...(run.terminalAt !== undefined ? { terminalAt: run.terminalAt } : {}),
    ...(run.finishReason !== undefined ? { finishReason: boundedText(run.finishReason, 256) } : {}),
  };
}

function sessionLifecycle(record: SessionRecord): HarnessSessionRecordPostImage['lifecycle'] {
  if (record.closedAt !== undefined) return 'closed';
  if (record.closingAt !== undefined) return 'closing';
  return 'active';
}

function boundedId(value: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Session projection identity must be a non-empty string');
  }
  if (value.length > MAX_HARNESS_SESSION_RECORD_PROJECTION_ID_CHARS) {
    throw new RangeError(
      `Session projection identity exceeds ${MAX_HARNESS_SESSION_RECORD_PROJECTION_ID_CHARS} characters`,
    );
  }
  return value;
}

function boundedText(value: string, maxChars: number): string {
  if (typeof value !== 'string') throw new TypeError('Session projection text must be a string');
  if (value.length > maxChars) {
    throw new RangeError(`Session projection text exceeds ${maxChars} characters`);
  }
  return value;
}

function assertNonNegativeSafeInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Session projection ${field} must be a non-negative safe integer`);
  }
}

function assertPositiveSafeInteger(value: number, field: string, prefix = 'Session projection'): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${prefix} ${field} must be a positive safe integer`);
  }
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

/** Stable JSON encoding for the digest and operation identity. */
export function stableJsonString(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(item => stableJsonString(item)).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter(key => object[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableJsonString(object[key])}`)
    .join(',')}}`;
}
