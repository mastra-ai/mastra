import { createHash, randomUUID } from 'node:crypto';

import type { JsonValue } from './types';

/** Versioned native chat terminal handoff contract. */
export const HARNESS_TERMINAL_HANDOFF_VERSION = 'harness.chat-terminal.v1';

export const DEFAULT_HARNESS_TERMINAL_MAX_SEED_BYTES = 8 * 1024;
export const DEFAULT_HARNESS_TERMINAL_MAX_PAYLOAD_BYTES = 256 * 1024;
export const DEFAULT_HARNESS_TERMINAL_MAX_ATTEMPTS = 8;
export const DEFAULT_HARNESS_TERMINAL_MAX_PENDING_INTENTS = 10_000;
export const DEFAULT_HARNESS_TERMINAL_MAX_PENDING_BYTES = 64 * 1024 * 1024;
export const DEFAULT_HARNESS_TERMINAL_CLAIM_LEASE_MS = 30_000;
export const MAX_HARNESS_TERMINAL_ID_CHARS = 1024;
export const MAX_HARNESS_TERMINAL_JSON_DEPTH = 64;

export type HarnessTerminalOutcomeStatus = 'completed' | 'aborted' | 'failed';
export type HarnessTerminalAdmissionStatus = 'pending' | 'committed' | 'cancelled' | 'fenced';
export type HarnessTerminalIntentStatus = 'pending' | 'claimed' | 'failed' | 'acked' | 'dead' | 'fenced';

/** The immutable authority identity minted by the product admission boundary. */
export interface HarnessTerminalExecutionGrant {
  /** Exact grant key. Storage does not trim, case-fold, or reinterpret it. */
  key: string;
  /** Monotonic generation/claim version for this exact grant key. */
  generation: number;
}

export interface HarnessTerminalIdentity {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  /** Storage-assigned session lifetime fence. */
  sessionIncarnation: string;
  admissionId: string;
  admissionHash: string;
  signalId: string;
  runId: string;
  executionGrant: HarnessTerminalExecutionGrant;
}

/** Canonical terminal state. Provider output is deliberately absent. */
export interface HarnessTerminalResult {
  status: HarnessTerminalOutcomeStatus;
  runId: string;
  finishReason?: string;
  completedAt: number;
  error?: {
    code: string;
    message: string;
  };
}

/** Result of the registered sanitizer/finalizer. */
export interface HarnessTerminalProjection {
  projectionKind: string;
  projectionId: string;
  /** JSON value retained as canonical bytes by the storage adapter. */
  payload: JsonValue;
}

export interface HarnessTerminalFinalizerInput {
  identity: HarnessTerminalIdentity;
  /** Exact bounded seed/version loaded from the durable admission row. */
  seed: JsonValue;
  finalizerId: string;
  finalizerVersion: string;
  result: HarnessTerminalResult;
  /** The live full output is available only to the registered finalizer. */
  fullOutput: unknown;
}

/** Opt-in finalizer registration. Storage only persists id/version and bytes. */
export interface HarnessTerminalFinalizer {
  id: string;
  version: string;
  finalize(input: HarnessTerminalFinalizerInput): Promise<HarnessTerminalProjection>;
}

export interface HarnessTerminalHandoffOption {
  /** Omitted/false leaves this protocol disabled for the Session. */
  enabled?: boolean;
  finalizer?: HarnessTerminalFinalizer;
  maxSeedBytes?: number;
  maxPayloadBytes?: number;
  maxAttempts?: number;
  maxPendingIntents?: number;
  maxPendingBytes?: number;
  claimLeaseMs?: number;
}

export interface NormalizedHarnessTerminalHandoffOption {
  enabled: boolean;
  maxSeedBytes: number;
  maxPayloadBytes: number;
  maxAttempts: number;
  maxPendingIntents: number;
  maxPendingBytes: number;
  claimLeaseMs: number;
}

export function normalizeHarnessTerminalHandoffOption(
  option?: HarnessTerminalHandoffOption,
): NormalizedHarnessTerminalHandoffOption {
  const value = option ?? {};
  const normalized = {
    enabled: value.enabled === true,
    maxSeedBytes: value.maxSeedBytes ?? DEFAULT_HARNESS_TERMINAL_MAX_SEED_BYTES,
    maxPayloadBytes: value.maxPayloadBytes ?? DEFAULT_HARNESS_TERMINAL_MAX_PAYLOAD_BYTES,
    maxAttempts: value.maxAttempts ?? DEFAULT_HARNESS_TERMINAL_MAX_ATTEMPTS,
    maxPendingIntents: value.maxPendingIntents ?? DEFAULT_HARNESS_TERMINAL_MAX_PENDING_INTENTS,
    maxPendingBytes: value.maxPendingBytes ?? DEFAULT_HARNESS_TERMINAL_MAX_PENDING_BYTES,
    claimLeaseMs: value.claimLeaseMs ?? DEFAULT_HARNESS_TERMINAL_CLAIM_LEASE_MS,
  };
  for (const [name, bound] of Object.entries(normalized)) {
    if (typeof bound !== 'number') continue;
    if (!Number.isSafeInteger(bound) || bound <= 0) {
      throw new RangeError(`Harness terminal ${name} must be a positive safe integer`);
    }
  }
  return normalized;
}

export interface HarnessTerminalAdmissionInput extends HarnessTerminalIdentity {
  finalizerId: string;
  finalizerVersion: string;
  /** Opaque bounded seed. It is never interpreted by storage. */
  seed: JsonValue;
  createdAt?: number;
}

export interface HarnessTerminalAdmissionRecord extends HarnessTerminalIdentity {
  id: string;
  protocolVersion: typeof HARNESS_TERMINAL_HANDOFF_VERSION;
  finalizerId: string;
  finalizerVersion: string;
  seed: JsonValue;
  seedBytes: number;
  seedHash: string;
  status: HarnessTerminalAdmissionStatus;
  terminalResult?: HarnessTerminalResult;
  projection?: StoredHarnessTerminalProjection;
  revision?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StoredHarnessTerminalProjection extends HarnessTerminalProjection {
  payloadBytes: number;
  payloadHash: string;
  /** Canonical bytes are retained so replay does not rerun the provider. */
  payloadJson: string;
}

export interface HarnessTerminalIntent extends HarnessTerminalIdentity {
  id: string;
  admissionId: string;
  revision: number;
  protocolVersion: typeof HARNESS_TERMINAL_HANDOFF_VERSION;
  finalizerId: string;
  finalizerVersion: string;
  terminalResult: HarnessTerminalResult;
  projection: StoredHarnessTerminalProjection;
  status: HarnessTerminalIntentStatus;
  attempts: number;
  claimId?: string;
  claimExpiresAt?: number;
  nextAttemptAt?: number;
  lastError?: HarnessTerminalError;
  createdAt: number;
  updatedAt: number;
  ackedAt?: number;
  deadAt?: number;
}

export interface HarnessTerminalError {
  code: string;
  message: string;
}

export interface HarnessTerminalAdmissionReceipt {
  status: 'created' | 'duplicate' | 'cancelled' | 'conflict' | 'fenced';
  admission: HarnessTerminalAdmissionRecord;
}

export interface HarnessTerminalCommitReceipt {
  status: 'committed' | 'duplicate' | 'cancelled' | 'fenced' | 'conflict';
  admission: HarnessTerminalAdmissionRecord;
  intent?: HarnessTerminalIntent;
}

export interface HarnessTerminalCancelInput extends Pick<
  HarnessTerminalIdentity,
  'harnessName' | 'sessionId' | 'sessionIncarnation' | 'admissionId' | 'admissionHash'
> {
  executionGrant: HarnessTerminalExecutionGrant;
  reason: HarnessTerminalError;
  cancelledAt?: number;
}

export interface HarnessTerminalCancelReceipt {
  status: 'cancelled' | 'duplicate' | 'committed' | 'fenced';
  grant: HarnessTerminalExecutionGrant;
  tombstoneId: string;
  cancelledAt?: number;
  admission?: HarnessTerminalAdmissionRecord;
}

export interface HarnessTerminalAdmissionLoadInput {
  harnessName: string;
  sessionId: string;
  admissionId: string;
  executionGrant: HarnessTerminalExecutionGrant;
}

/**
 * Recovery probe for a suspended-then-resumed run: the durable admission
 * identity is keyed by the deterministic run id the admission was minted with,
 * so a terminal resume can find the still-pending admission it must settle.
 * `sessionIncarnation` is required because a run id is only deterministic
 * within an incarnation — a deleted-then-recreated session id could otherwise
 * resolve a previous incarnation's admission.
 */
export interface HarnessPendingTerminalAdmissionLoadInput {
  harnessName?: string;
  sessionId: string;
  runId: string;
  sessionIncarnation: string;
}

export interface HarnessTerminalIntentLoadInput {
  harnessName: string;
  intentId: string;
}

export interface HarnessTerminalClaimInput {
  harnessName?: string;
  consumerId: string;
  limit: number;
  now?: number;
  leaseMs?: number;
}

export interface HarnessTerminalClaimReceipt {
  intents: HarnessTerminalIntent[];
  claimedAt: number;
}

export interface HarnessTerminalClaimIdentity {
  harnessName: string;
  intentId: string;
  sessionId: string;
  sessionIncarnation: string;
  revision: number;
  payloadHash: string;
  claimId: string;
  consumerId: string;
  now?: number;
}

export interface HarnessTerminalRenewReceipt {
  status: 'renewed';
  intent: HarnessTerminalIntent;
}

export interface HarnessTerminalAckReceipt {
  status: 'acked' | 'duplicate' | 'fenced';
  intent: HarnessTerminalIntent;
}

export interface HarnessTerminalFailReceipt {
  status: 'failed' | 'dead' | 'fenced';
  intent: HarnessTerminalIntent;
}

export interface HarnessTerminalQueuePressure {
  pendingIntents: number;
  pendingBytes: number;
}

export interface HarnessTerminalTombstone {
  id: string;
  harnessName: string;
  grant: HarnessTerminalExecutionGrant;
  sessionId: string;
  sessionIncarnation: string;
  admissionId: string;
  admissionHash: string;
  reason: HarnessTerminalError;
  createdAt: number;
}

export class HarnessTerminalHandoffError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    // Harness public-boundary redaction preserves errors whose concrete name
    // is explicitly owned by the Harness runtime. The wire code remains the
    // lowercase stable discriminator above.
    this.name = `HarnessTerminalHandoffError:${code}`;
  }
}

export class HarnessTerminalHandoffUnsupportedError extends HarnessTerminalHandoffError {
  constructor() {
    super('Harness storage does not implement native terminal handoff', 'harness.terminal_unsupported');
  }
}

export class HarnessTerminalHandoffValidationError extends HarnessTerminalHandoffError {
  constructor(path: string, message: string) {
    super(`${path}: ${message}`, 'harness.terminal_invalid');
  }
}

export class HarnessTerminalHandoffIdentityConflictError extends HarnessTerminalHandoffError {
  constructor(public readonly grantKey: string) {
    super(`Native terminal grant "${grantKey}" conflicts with an existing admission`, 'harness.terminal_conflict');
  }
}

export class HarnessTerminalHandoffCancelledError extends HarnessTerminalHandoffError {
  constructor(public readonly grantKey: string) {
    super(`Native terminal grant "${grantKey}" has a durable cancellation tombstone`, 'harness.terminal_cancelled');
  }
}

export class HarnessTerminalHandoffFencedError extends HarnessTerminalHandoffError {
  constructor(public readonly sessionId: string) {
    super(`Native terminal handoff for session "${sessionId}" is fenced`, 'harness.terminal_fenced');
  }
}

export class HarnessTerminalHandoffNotFoundError extends HarnessTerminalHandoffError {
  constructor(public readonly intentId: string) {
    super(`Native terminal handoff "${intentId}" was not found`, 'harness.terminal_not_found');
  }
}

export class HarnessTerminalHandoffClaimConflictError extends HarnessTerminalHandoffError {
  constructor(
    public readonly intentId: string,
    claimId?: string,
  ) {
    super(
      `Native terminal intent "${intentId}" is not held by claim "${claimId ?? '<none>'}"`,
      'harness.terminal_claim_conflict',
    );
  }
}

/** A process failure before the atomic commit is intentionally retryable and not a provider failure. */
export class HarnessTerminalFinalizationPendingError extends HarnessTerminalHandoffError {
  constructor(
    public readonly retryAt: number,
    public readonly cause: unknown,
  ) {
    super('Native terminal finalization is indeterminate and requires reconciliation', 'harness.terminal_pending');
  }
}

export function validateHarnessTerminalExecutionGrant(grant: HarnessTerminalExecutionGrant, path = 'grant'): void {
  boundedId(grant.key, `${path}.key`);
  if (!Number.isSafeInteger(grant.generation) || grant.generation <= 0) {
    throw new HarnessTerminalHandoffValidationError(`${path}.generation`, 'must be a positive safe integer');
  }
}

export function validateHarnessTerminalIdentity(identity: HarnessTerminalIdentity): void {
  boundedId(identity.harnessName, 'harnessName');
  boundedId(identity.sessionId, 'sessionId');
  boundedId(identity.resourceId, 'resourceId');
  boundedId(identity.threadId, 'threadId');
  boundedId(identity.sessionIncarnation, 'sessionIncarnation');
  boundedId(identity.admissionId, 'admissionId');
  boundedId(identity.admissionHash, 'admissionHash');
  boundedId(identity.signalId, 'signalId');
  boundedId(identity.runId, 'runId');
  validateHarnessTerminalExecutionGrant(identity.executionGrant, 'executionGrant');
}

export function prepareHarnessTerminalAdmission(
  input: HarnessTerminalAdmissionInput,
  options: Pick<NormalizedHarnessTerminalHandoffOption, 'maxSeedBytes'>,
  now = input.createdAt ?? Date.now(),
): HarnessTerminalAdmissionRecord {
  validateHarnessTerminalIdentity(input);
  boundedId(input.finalizerId, 'finalizerId');
  boundedId(input.finalizerVersion, 'finalizerVersion');
  assertTime(now, 'createdAt');
  const seedJson = canonicalJson(input.seed);
  const seedBytes = utf8Bytes(seedJson);
  if (seedBytes > options.maxSeedBytes) {
    throw new HarnessTerminalHandoffValidationError('seed', `exceeds ${options.maxSeedBytes} UTF-8 bytes`);
  }
  return {
    ...copyIdentity(input),
    id: harnessTerminalAdmissionId(input),
    protocolVersion: HARNESS_TERMINAL_HANDOFF_VERSION,
    finalizerId: input.finalizerId,
    finalizerVersion: input.finalizerVersion,
    seed: cloneJson(input.seed),
    seedBytes,
    seedHash: sha256(seedJson),
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}

export function prepareHarnessTerminalProjection(
  projection: HarnessTerminalProjection,
  maxPayloadBytes: number,
): StoredHarnessTerminalProjection {
  boundedId(projection.projectionKind, 'projectionKind');
  boundedId(projection.projectionId, 'projectionId');
  if (!Number.isSafeInteger(maxPayloadBytes) || maxPayloadBytes <= 0) {
    throw new HarnessTerminalHandoffValidationError('maxPayloadBytes', 'must be a positive safe integer');
  }
  const payloadJson = canonicalJson(projection.payload);
  const payloadBytes = utf8Bytes(payloadJson);
  if (payloadBytes > maxPayloadBytes) {
    throw new HarnessTerminalHandoffValidationError('projection.payload', `exceeds ${maxPayloadBytes} UTF-8 bytes`);
  }
  return {
    projectionKind: projection.projectionKind,
    projectionId: projection.projectionId,
    payload: cloneJson(projection.payload),
    payloadJson,
    payloadBytes,
    payloadHash: sha256(payloadJson),
  };
}

export function harnessTerminalAdmissionId(
  input: Pick<HarnessTerminalIdentity, 'harnessName' | 'sessionId' | 'executionGrant'>,
): string {
  return sha256(
    canonicalJson({
      protocolVersion: HARNESS_TERMINAL_HANDOFF_VERSION,
      harnessName: input.harnessName,
      sessionId: input.sessionId,
      grantKey: input.executionGrant.key,
      grantGeneration: input.executionGrant.generation,
    }),
  );
}

export function harnessTerminalGrantTombstoneId(
  input: Pick<HarnessTerminalIdentity, 'harnessName' | 'executionGrant'>,
): string {
  return sha256(
    canonicalJson({
      protocolVersion: HARNESS_TERMINAL_HANDOFF_VERSION,
      harnessName: input.harnessName,
      grantKey: input.executionGrant.key,
      grantGeneration: input.executionGrant.generation,
    }),
  );
}

export function harnessTerminalIntentId(admissionRecordId: string): string {
  boundedId(admissionRecordId, 'admissionRecordId');
  return sha256(canonicalJson({ protocolVersion: HARNESS_TERMINAL_HANDOFF_VERSION, admissionId: admissionRecordId }));
}

export function cloneHarnessTerminal<T>(value: T): T {
  return structuredClone(value);
}

export function terminalClaimId(): string {
  return randomUUID();
}

export function canonicalHarnessTerminalResult(result: HarnessTerminalResult): HarnessTerminalResult {
  boundedId(result.runId, 'terminalResult.runId');
  if (result.finishReason !== undefined) boundedId(result.finishReason, 'terminalResult.finishReason');
  assertTime(result.completedAt, 'terminalResult.completedAt');
  if (result.error !== undefined) {
    boundedId(result.error.code, 'terminalResult.error.code');
    boundedId(result.error.message, 'terminalResult.error.message');
  }
  return cloneHarnessTerminal(result);
}

export function canonicalJson(value: JsonValue): string {
  assertJsonValue(value, 'value');
  return JSON.stringify(sortJson(value));
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, sortJson(value[key]!)]),
    );
  }
  return value;
}

function assertJsonValue(value: unknown, path: string, depth = 0): asserts value is JsonValue {
  if (depth > MAX_HARNESS_TERMINAL_JSON_DEPTH) {
    throw new HarnessTerminalHandoffValidationError(path, `exceeds ${MAX_HARNESS_TERMINAL_JSON_DEPTH} nesting levels`);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new HarnessTerminalHandoffValidationError(path, 'must contain only finite numbers');
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key.length > MAX_HARNESS_TERMINAL_ID_CHARS) {
        throw new HarnessTerminalHandoffValidationError(
          `${path}.${key}`,
          `key must be at most ${MAX_HARNESS_TERMINAL_ID_CHARS} characters`,
        );
      }
      assertJsonValue(entry, `${path}.${key}`, depth + 1);
    }
    return;
  }
  throw new HarnessTerminalHandoffValidationError(path, 'must be JSON serializable');
}

function copyIdentity(identity: HarnessTerminalIdentity): HarnessTerminalIdentity {
  return { ...identity, executionGrant: { ...identity.executionGrant } };
}

function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function boundedId(value: string, path = 'id'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_HARNESS_TERMINAL_ID_CHARS) {
    throw new HarnessTerminalHandoffValidationError(
      path,
      `must be a non-empty string of at most ${MAX_HARNESS_TERMINAL_ID_CHARS} characters`,
    );
  }
  return value;
}

function assertTime(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new HarnessTerminalHandoffValidationError(path, 'must be a non-negative safe integer');
  }
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
