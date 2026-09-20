import { createHash } from 'node:crypto';

import { HarnessStorageDomainError } from './base';

const SHA256_PATTERN = /^[0-9a-f]{64}$/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const MAX_SCOPE_COMPONENT_LENGTH = 512;
const MAX_OPERATION_ID_LENGTH = 256;
const MAX_MIME_TYPE_LENGTH = 256;

/** Native Harness attachment read/write cap used by adapters without a tighter limit. */
export const DEFAULT_HARNESS_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;

type AttachmentByteOwnerIntegrityReason = 'payload' | 'stored_bytes' | 'expected_metadata';

/**
 * The native identity that fences an external byte object. An incarnation is
 * part of the identity so a late delete from an older session generation
 * cannot target a recreated attachment.
 */
export type HarnessAttachmentOwnerScope = Readonly<{
  harnessName: string;
  sessionId: string;
  attachmentId: string;
  incarnation: string;
}>;

export type HarnessAttachmentByteOwnerSaveInput = Readonly<{
  owner: HarnessAttachmentOwnerScope;
  operationId: string;
  data: Uint8Array;
  expectedBytes: number;
  expectedSha256: string;
  mimeType: string;
}>;

export type HarnessAttachmentByteOwnerLoadInput = Readonly<{
  blobRef: string;
  owner: HarnessAttachmentOwnerScope;
  expectedBytes: number;
  expectedSha256: string;
  maxBytes: number;
}>;

export type HarnessAttachmentByteOwnerDeleteInput = Readonly<{
  blobRef: string;
  owner: HarnessAttachmentOwnerScope;
  expectedBytes: number;
  expectedSha256: string;
}>;

export type HarnessAttachmentByteOwnerSaveResult =
  | Readonly<{
      outcome: 'stored' | 'already_stored';
      blobRef: string;
    }>
  | Readonly<{
      outcome: 'unknown';
      blobRef?: string;
    }>;

export type HarnessAttachmentByteOwnerDeleteResult =
  | Readonly<{
      outcome: 'deleted' | 'already_absent';
    }>
  | Readonly<{
      outcome: 'unknown';
    }>;

export type HarnessAttachmentByteOwnerCancelInput = Readonly<{
  owner: HarnessAttachmentOwnerScope;
  operationId: string;
  expectedBytes: number;
  expectedSha256: string;
}>;

export type HarnessAttachmentByteOwnerCancelResult = HarnessAttachmentByteOwnerDeleteResult;

/**
 * External attachment bytes are deliberately separate from native metadata,
 * references, and cleanup intent. A native Harness storage adapter owns the
 * durable fence and passes the resulting identity to this boundary.
 */
export interface HarnessAttachmentByteOwner {
  save(input: HarnessAttachmentByteOwnerSaveInput): Promise<HarnessAttachmentByteOwnerSaveResult>;
  load(input: HarnessAttachmentByteOwnerLoadInput): Promise<Uint8Array | null>;
  delete(input: HarnessAttachmentByteOwnerDeleteInput): Promise<HarnessAttachmentByteOwnerDeleteResult>;
  /**
   * Fences an upload operation before removing its deterministic object. A
   * native reconciler uses this when a PUT has no committed metadata row; the
   * owner must reject a later save for the same scope and operation id before
   * it can publish bytes.
   */
  cancel(input: HarnessAttachmentByteOwnerCancelInput): Promise<HarnessAttachmentByteOwnerCancelResult>;
}

export class HarnessAttachmentByteOwnerInvalidInputError extends HarnessStorageDomainError {
  readonly name = 'HarnessAttachmentByteOwnerInvalidInputError';
  readonly code = 'harness.storage.attachment_byte_owner_invalid' as const;

  constructor(field: string) {
    super('Attachment byte-owner input is invalid: ' + field);
  }
}

export class HarnessAttachmentByteOwnerConflictError extends HarnessStorageDomainError {
  readonly name = 'HarnessAttachmentByteOwnerConflictError';
  readonly code = 'harness.storage.attachment_byte_owner_conflict' as const;

  constructor() {
    super('Attachment byte-owner identity conflicts with the stored object');
  }
}

export class HarnessAttachmentByteOwnerIntegrityError extends HarnessStorageDomainError {
  readonly name = 'HarnessAttachmentByteOwnerIntegrityError';
  readonly code = 'harness.storage.attachment_byte_owner_integrity' as const;

  constructor(reason: AttachmentByteOwnerIntegrityReason) {
    super('Attachment byte-owner integrity check failed: ' + reason);
  }
}

export class HarnessAttachmentByteOwnerLimitError extends HarnessStorageDomainError {
  readonly name = 'HarnessAttachmentByteOwnerLimitError';
  readonly code = 'harness.storage.attachment_byte_owner_limit' as const;

  constructor() {
    super('Attachment byte-owner read exceeds the configured byte limit');
  }
}

/**
 * The in-memory adapter is a deterministic native contract fixture. It keeps
 * only external byte objects and intentionally has no reference or cleanup
 * policy; those decisions belong to the native Harness transaction ledger.
 */
export type InMemoryHarnessAttachmentObject = {
  owner: HarnessAttachmentOwnerScope;
  operationId: string;
  mimeType: string;
  bytes: number;
  sha256: string;
  data: Uint8Array;
};

export type InMemoryHarnessAttachmentByteOwnerOptions = Readonly<{
  providerId?: string;
  /** A deterministic store injection used by corruption contract tests. */
  objects?: Map<string, InMemoryHarnessAttachmentObject>;
}>;

type NormalizedSaveInput = {
  owner: HarnessAttachmentOwnerScope;
  operationId: string;
  data: Uint8Array;
  expectedBytes: number;
  expectedSha256: string;
  mimeType: string;
};

type NormalizedLoadInput = {
  blobRef: string;
  owner: HarnessAttachmentOwnerScope;
  expectedBytes: number;
  expectedSha256: string;
  maxBytes: number;
};

/**
 * A provider-neutral byte-owner implementation for native Harness tests.
 * `blobRef` is stable for the exact owner incarnation and never includes an
 * operation id, which lets a retry of the same durable operation be idempotent
 * while a new incarnation receives a different object identity. A successful
 * delete retires that reference for this adapter lifetime, preventing an
 * attachment from reusing an old object key after hard-delete.
 */
export class InMemoryHarnessAttachmentByteOwner implements HarnessAttachmentByteOwner {
  readonly #providerId: string;
  readonly #objects: Map<string, InMemoryHarnessAttachmentObject>;
  readonly #retiredBlobRefs = new Set<string>();
  readonly #cancelledOperations = new Set<string>();

  constructor(options: InMemoryHarnessAttachmentByteOwnerOptions = {}) {
    const providerId = options.providerId ?? 'memory';
    assertSafeText(providerId, 'providerId', MAX_SCOPE_COMPONENT_LENGTH);
    this.#providerId = providerId;
    this.#objects = options.objects ?? new Map();
  }

  async save(input: HarnessAttachmentByteOwnerSaveInput): Promise<HarnessAttachmentByteOwnerSaveResult> {
    const normalized = normalizeSaveInput(input);
    const blobRef = this.#blobRef(normalized.owner);
    const operationKey = this.#operationKey(normalized.owner, normalized.operationId);
    if (this.#cancelledOperations.has(operationKey)) {
      throw new HarnessAttachmentByteOwnerConflictError();
    }
    const existing = this.#objects.get(blobRef);

    if (existing !== undefined) {
      assertStoredRecordOwner(existing, normalized.owner);
      if (
        existing.operationId !== normalized.operationId ||
        existing.mimeType !== normalized.mimeType ||
        existing.bytes !== normalized.expectedBytes ||
        existing.sha256 !== normalized.expectedSha256
      ) {
        throw new HarnessAttachmentByteOwnerConflictError();
      }
      assertStoredRecordIntegrity(existing);
      return { outcome: 'already_stored', blobRef };
    }
    if (this.#retiredBlobRefs.has(blobRef)) {
      throw new HarnessAttachmentByteOwnerConflictError();
    }

    this.#objects.set(blobRef, {
      owner: { ...normalized.owner },
      operationId: normalized.operationId,
      mimeType: normalized.mimeType,
      bytes: normalized.expectedBytes,
      sha256: normalized.expectedSha256,
      data: new Uint8Array(normalized.data),
    });

    return { outcome: 'stored', blobRef };
  }

  async load(input: HarnessAttachmentByteOwnerLoadInput): Promise<Uint8Array | null> {
    const normalized = normalizeLoadInput(input);
    if (normalized.maxBytes < normalized.expectedBytes) {
      throw new HarnessAttachmentByteOwnerLimitError();
    }

    const expectedBlobRef = this.#blobRef(normalized.owner);
    if (normalized.blobRef !== expectedBlobRef) {
      throw new HarnessAttachmentByteOwnerConflictError();
    }

    const stored = this.#objects.get(normalized.blobRef);
    if (stored === undefined) {
      return null;
    }

    assertStoredRecordOwner(stored, normalized.owner);
    assertExpectedStoredMetadata(stored, normalized.expectedBytes, normalized.expectedSha256);
    assertStoredRecordIntegrity(stored);
    if (stored.data.byteLength > normalized.maxBytes) {
      throw new HarnessAttachmentByteOwnerLimitError();
    }

    return new Uint8Array(stored.data);
  }

  async delete(input: HarnessAttachmentByteOwnerDeleteInput): Promise<HarnessAttachmentByteOwnerDeleteResult> {
    const normalized = normalizeDeleteInput(input);
    const expectedBlobRef = this.#blobRef(normalized.owner);
    if (normalized.blobRef !== expectedBlobRef) {
      throw new HarnessAttachmentByteOwnerConflictError();
    }

    const stored = this.#objects.get(normalized.blobRef);
    if (stored === undefined) {
      return { outcome: 'already_absent' };
    }

    assertStoredRecordOwner(stored, normalized.owner);
    assertExpectedStoredMetadata(stored, normalized.expectedBytes, normalized.expectedSha256);
    assertStoredRecordIntegrity(stored);
    this.#objects.delete(normalized.blobRef);
    this.#retiredBlobRefs.add(normalized.blobRef);
    return { outcome: 'deleted' };
  }

  async cancel(input: HarnessAttachmentByteOwnerCancelInput): Promise<HarnessAttachmentByteOwnerCancelResult> {
    const normalized = normalizeCancelInput(input);
    const blobRef = this.#blobRef(normalized.owner);
    const operationKey = this.#operationKey(normalized.owner, normalized.operationId);
    if (this.#cancelledOperations.has(operationKey)) {
      return { outcome: 'already_absent' };
    }
    const stored = this.#objects.get(blobRef);
    if (stored !== undefined) {
      assertStoredRecordOwner(stored, normalized.owner);
      if (
        stored.operationId !== normalized.operationId ||
        stored.bytes !== normalized.expectedBytes ||
        stored.sha256 !== normalized.expectedSha256
      ) {
        throw new HarnessAttachmentByteOwnerConflictError();
      }
      assertStoredRecordIntegrity(stored);
      this.#objects.delete(blobRef);
      this.#retiredBlobRefs.add(blobRef);
      this.#cancelledOperations.add(operationKey);
      return { outcome: 'deleted' };
    }
    this.#cancelledOperations.add(operationKey);
    return { outcome: 'already_absent' };
  }

  #blobRef(owner: HarnessAttachmentOwnerScope): string {
    return [
      'memory://',
      encodeSegment(this.#providerId),
      '/harness-attachments/',
      encodeSegment(owner.harnessName),
      '/',
      encodeSegment(owner.sessionId),
      '/',
      encodeSegment(owner.attachmentId),
      '/',
      encodeSegment(owner.incarnation),
    ].join('');
  }

  #operationKey(owner: HarnessAttachmentOwnerScope, operationId: string): string {
    return `${this.#blobRef(owner)}\u0000${operationId}`;
  }
}

function normalizeSaveInput(input: HarnessAttachmentByteOwnerSaveInput): NormalizedSaveInput {
  assertObject(input, 'input');
  const owner = normalizeOwner(input.owner);
  assertSafeText(input.operationId, 'operationId', MAX_OPERATION_ID_LENGTH);
  assertSafeText(input.mimeType, 'mimeType', MAX_MIME_TYPE_LENGTH);
  assertByteCount(input.expectedBytes, 'expectedBytes');
  if (!(input.data instanceof Uint8Array)) {
    throw new HarnessAttachmentByteOwnerInvalidInputError('data');
  }
  const expectedSha256 = normalizeSha256(input.expectedSha256);
  if (input.data.byteLength !== input.expectedBytes) {
    throw new HarnessAttachmentByteOwnerInvalidInputError('expectedBytes');
  }
  if (sha256Hex(input.data) !== expectedSha256) {
    throw new HarnessAttachmentByteOwnerIntegrityError('payload');
  }
  return {
    owner,
    operationId: input.operationId,
    data: input.data,
    expectedBytes: input.expectedBytes,
    expectedSha256,
    mimeType: input.mimeType,
  };
}

function normalizeLoadInput(input: HarnessAttachmentByteOwnerLoadInput): NormalizedLoadInput {
  assertObject(input, 'input');
  assertSafeText(input.blobRef, 'blobRef', MAX_SCOPE_COMPONENT_LENGTH * 8);
  const owner = normalizeOwner(input.owner);
  assertByteCount(input.expectedBytes, 'expectedBytes');
  assertByteCount(input.maxBytes, 'maxBytes');
  return {
    blobRef: input.blobRef,
    owner,
    expectedBytes: input.expectedBytes,
    expectedSha256: normalizeSha256(input.expectedSha256),
    maxBytes: input.maxBytes,
  };
}

function normalizeDeleteInput(input: HarnessAttachmentByteOwnerDeleteInput): NormalizedLoadInput {
  assertObject(input, 'input');
  assertSafeText(input.blobRef, 'blobRef', MAX_SCOPE_COMPONENT_LENGTH * 8);
  const owner = normalizeOwner(input.owner);
  assertByteCount(input.expectedBytes, 'expectedBytes');
  return {
    blobRef: input.blobRef,
    owner,
    expectedBytes: input.expectedBytes,
    expectedSha256: normalizeSha256(input.expectedSha256),
    maxBytes: Number.MAX_SAFE_INTEGER,
  };
}

function normalizeCancelInput(input: HarnessAttachmentByteOwnerCancelInput): {
  owner: HarnessAttachmentOwnerScope;
  operationId: string;
  expectedBytes: number;
  expectedSha256: string;
} {
  assertObject(input, 'input');
  const owner = normalizeOwner(input.owner);
  assertSafeText(input.operationId, 'operationId', MAX_OPERATION_ID_LENGTH);
  assertByteCount(input.expectedBytes, 'expectedBytes');
  return {
    owner,
    operationId: input.operationId,
    expectedBytes: input.expectedBytes,
    expectedSha256: normalizeSha256(input.expectedSha256),
  };
}

/**
 * Validates the owner-scope fields a byte owner will be asked to address.
 * Native storage adapters call this before persisting a durable upload or
 * cleanup operation so an identity the owner contract can never address fails
 * fast instead of wedging a ledger row that reconciliation cannot resolve.
 */
export function assertHarnessAttachmentOwnerScope(owner: HarnessAttachmentOwnerScope): void {
  normalizeOwner(owner);
}

function normalizeOwner(owner: HarnessAttachmentOwnerScope): HarnessAttachmentOwnerScope {
  assertObject(owner, 'owner');
  assertSafeText(owner.harnessName, 'owner.harnessName', MAX_SCOPE_COMPONENT_LENGTH);
  assertSafeText(owner.sessionId, 'owner.sessionId', MAX_SCOPE_COMPONENT_LENGTH);
  assertSafeText(owner.attachmentId, 'owner.attachmentId', MAX_SCOPE_COMPONENT_LENGTH);
  assertSafeText(owner.incarnation, 'owner.incarnation', MAX_SCOPE_COMPONENT_LENGTH);
  return {
    harnessName: owner.harnessName,
    sessionId: owner.sessionId,
    attachmentId: owner.attachmentId,
    incarnation: owner.incarnation,
  };
}

function normalizeSha256(value: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new HarnessAttachmentByteOwnerInvalidInputError('expectedSha256');
  }
  return value.toLowerCase();
}

function assertObject(value: unknown, field: string): asserts value is object {
  if (typeof value !== 'object' || value === null) {
    throw new HarnessAttachmentByteOwnerInvalidInputError(field);
  }
}

function assertSafeText(value: unknown, field: string, maxLength: number): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new HarnessAttachmentByteOwnerInvalidInputError(field);
  }
}

function assertByteCount(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HarnessAttachmentByteOwnerInvalidInputError(field);
  }
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
}

function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function assertStoredRecordOwner(stored: InMemoryHarnessAttachmentObject, owner: HarnessAttachmentOwnerScope): void {
  if (!sameOwner(stored.owner, owner)) {
    throw new HarnessAttachmentByteOwnerConflictError();
  }
}

function assertExpectedStoredMetadata(
  stored: InMemoryHarnessAttachmentObject,
  expectedBytes: number,
  expectedSha256: string,
): void {
  if (stored.bytes !== expectedBytes || stored.sha256 !== expectedSha256) {
    throw new HarnessAttachmentByteOwnerIntegrityError('expected_metadata');
  }
}

function assertStoredRecordIntegrity(stored: InMemoryHarnessAttachmentObject): void {
  if (stored.data.byteLength !== stored.bytes || sha256Hex(stored.data) !== stored.sha256) {
    throw new HarnessAttachmentByteOwnerIntegrityError('stored_bytes');
  }
}

function sameOwner(left: HarnessAttachmentOwnerScope, right: HarnessAttachmentOwnerScope): boolean {
  return (
    left.harnessName === right.harnessName &&
    left.sessionId === right.sessionId &&
    left.attachmentId === right.attachmentId &&
    left.incarnation === right.incarnation
  );
}
