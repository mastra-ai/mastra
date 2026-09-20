import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
  HarnessAttachmentByteOwnerInvalidInputError,
  HarnessStorageAttachmentConflictError,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentPendingError,
  InMemoryHarnessAttachmentByteOwner,
} from '@mastra/core/storage';
import type {
  HarnessAttachmentByteOwner,
  HarnessAttachmentByteOwnerCancelInput,
  HarnessAttachmentByteOwnerCancelResult,
  HarnessAttachmentByteOwnerDeleteInput,
  HarnessAttachmentByteOwnerDeleteResult,
  HarnessAttachmentByteOwnerLoadInput,
  HarnessAttachmentByteOwnerSaveInput,
  HarnessAttachmentByteOwnerSaveResult,
  JsonValue,
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

interface OwnerGate {
  markStarted: () => void;
  started: Promise<void>;
  released: Promise<void>;
  markReleased: () => void;
  startedFired: boolean;
  releasedFired: boolean;
}

function createOwnerGate(): OwnerGate {
  let start!: () => void;
  let release!: () => void;
  const gate = {
    started: new Promise<void>(resolve => (start = resolve)),
    released: new Promise<void>(resolve => (release = resolve)),
    startedFired: false,
    releasedFired: false,
    markStarted() {
      gate.startedFired = true;
      start();
    },
    markReleased() {
      gate.releasedFired = true;
      release();
    },
  };
  return gate;
}

class UnknownDeleteOnceOwner implements HarnessAttachmentByteOwner {
  readonly #delegate = new InMemoryHarnessAttachmentByteOwner({ providerId: 'native-integration-test' });
  #saveGates: OwnerGate[] = [];
  #deleteGates: OwnerGate[] = [];
  #cancelStarted: (() => void) | undefined;
  #cancelRelease: (() => void) | undefined;
  #cancelStartedPromise: Promise<void> | undefined;
  #blobRefOverride: string | undefined;
  #deferredCancels: HarnessAttachmentByteOwnerCancelInput[] = [];
  unknownSaveOnce = false;
  failSaveOnce = false;
  unknownDeleteOnce = false;
  unknownCancelOnce = false;

  reset(): void {
    for (const gate of [...this.#saveGates, ...this.#deleteGates]) gate.markReleased();
    this.#saveGates = [];
    this.#deleteGates = [];
    this.#cancelStarted = undefined;
    this.#cancelRelease?.();
    this.#cancelRelease = undefined;
    this.#cancelStartedPromise = undefined;
    this.#blobRefOverride = undefined;
    this.#deferredCancels = [];
    this.unknownSaveOnce = false;
    this.failSaveOnce = false;
    this.unknownDeleteOnce = false;
    this.unknownCancelOnce = false;
  }

  async applyDeferredCancels(): Promise<void> {
    for (const input of this.#deferredCancels.splice(0)) {
      await this.#delegate.cancel(input);
    }
  }

  overrideNextBlobRef(blobRef: string): void {
    this.#blobRefOverride = blobRef;
  }

  pauseNextSave(): void {
    this.#saveGates.push(createOwnerGate());
  }

  async waitForSaveStarted(): Promise<void> {
    const gate = this.#saveGates.find(g => !g.startedFired);
    if (!gate) throw new Error('no paused save is armed');
    await gate.started;
  }

  releaseSave(): void {
    this.#saveGates.find(g => g.startedFired && !g.releasedFired)?.markReleased();
  }

  pauseNextDelete(): void {
    this.#deleteGates.push(createOwnerGate());
  }

  async waitForDeleteStarted(): Promise<void> {
    const gate = this.#deleteGates.find(g => !g.startedFired);
    if (!gate) throw new Error('no paused delete is armed');
    await gate.started;
  }

  releaseDelete(): void {
    this.#deleteGates.find(g => g.startedFired && !g.releasedFired)?.markReleased();
  }

  pauseNextCancel(): void {
    this.#cancelStartedPromise = new Promise(resolve => {
      this.#cancelStarted = resolve;
    });
    this.#cancelRelease = undefined;
  }

  async waitForCancelStarted(): Promise<void> {
    await this.#cancelStartedPromise;
  }

  releaseCancel(): void {
    this.#cancelRelease?.();
    this.#cancelRelease = undefined;
  }

  async save(input: HarnessAttachmentByteOwnerSaveInput): Promise<HarnessAttachmentByteOwnerSaveResult> {
    if (this.failSaveOnce) {
      this.failSaveOnce = false;
      throw new Error('simulated upload failure');
    }
    const result = await this.#delegate.save(input);
    const gate = this.#saveGates.find(g => !g.startedFired);
    if (gate) {
      gate.markStarted();
      await gate.released;
    }
    if (this.unknownSaveOnce) {
      this.unknownSaveOnce = false;
      if (result.outcome === 'unknown') return result;
      return { outcome: 'unknown', blobRef: result.blobRef };
    }
    if (this.#blobRefOverride !== undefined) {
      const blobRef = this.#blobRefOverride;
      this.#blobRefOverride = undefined;
      return { ...result, blobRef };
    }
    return result;
  }

  load(input: HarnessAttachmentByteOwnerLoadInput): Promise<Uint8Array | null> {
    return this.#delegate.load(input);
  }

  async delete(input: HarnessAttachmentByteOwnerDeleteInput): Promise<HarnessAttachmentByteOwnerDeleteResult> {
    const gate = this.#deleteGates.find(g => !g.startedFired);
    if (gate) {
      gate.markStarted();
      await gate.released;
    }
    if (this.unknownDeleteOnce) {
      this.unknownDeleteOnce = false;
      return { outcome: 'unknown' };
    }
    return this.#delegate.delete(input);
  }

  async cancel(input: HarnessAttachmentByteOwnerCancelInput): Promise<HarnessAttachmentByteOwnerCancelResult> {
    if (this.#cancelStarted !== undefined) {
      this.#cancelStarted();
      this.#cancelStarted = undefined;
      await new Promise<void>(resolve => {
        this.#cancelRelease = resolve;
      });
    }
    if (this.unknownCancelOnce) {
      this.unknownCancelOnce = false;
      this.#deferredCancels.push(input);
      return { outcome: 'unknown' };
    }
    return this.#delegate.cancel(input);
  }
}

describe('HarnessPG native external attachment ownership', () => {
  const schemaName = `pf4267_native_attachment_${randomUUID().replaceAll('-', '_')}`;
  const owner = new UnknownDeleteOnceOwner();
  const store = new PostgresStore({
    ...TEST_CONFIG,
    id: 'pg-harness-native-attachment-test-store',
    schemaName,
    enabledDomains: ['harness'],
    sessionRecordProjection: { enabled: true, maxAttempts: 1, maxPendingIntents: 20 },
    attachmentByteOwner: owner,
  });

  beforeAll(async () => {
    await store.init();
  });

  beforeEach(async () => {
    owner.reset();
    await store.stores.harness!.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`).catch(() => {});
    await store.close();
  });

  it('roundtrips external bytes, rejects same-id conflicts, and fences cleanup across recreation', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-aba',
      resourceId: 'native-resource',
      threadId: 'native-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'owner-a', ttlMs: 60_000 },
    });
    const firstBytes = new Uint8Array([1, 2, 3, 4]);
    owner.unknownSaveOnce = true;
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'same-id',
        name: 'same.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: firstBytes,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    const pendingPut = await store.db.one<{ status: string; blob_ref: string | null }>(
      `SELECT status, blob_ref FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'same-id'],
    );
    expect(pendingPut).toMatchObject({ status: 'unknown' });
    expect(pendingPut.blob_ref).toContain('/same-id/');
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'same-id',
        name: 'same.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: firstBytes,
      }),
    ).resolves.toMatchObject({ attachmentId: 'same-id', bytes: 4 });
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'same-id',
        name: 'same.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: firstBytes,
      }),
    ).resolves.toMatchObject({ attachmentId: 'same-id', bytes: 4 });
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'same-id',
        name: 'same.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: new Uint8Array([9]),
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentConflictError);
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'same-id' })).resolves.toMatchObject({
      data: firstBytes,
      bytes: 4,
    });

    const attachmentRow = await store.db.one<{ data_b64: string | null; blob_ref: string | null }>(
      `SELECT data_b64, blob_ref FROM "${schemaName}"."mastra_harness_attachments" WHERE session_id = $1 AND attachment_id = $2`,
      [session.id, 'same-id'],
    );
    expect(attachmentRow.data_b64).toBeNull();
    expect(attachmentRow.blob_ref).toContain('/same-id/');

    owner.unknownDeleteOnce = true;
    await expect(harness.deleteSession({ sessionId: session.id })).rejects.toBeInstanceOf(
      HarnessStorageAttachmentPendingError,
    );
    const oldSession = await store.db.one<{ session_incarnation: string }>(
      `SELECT session_incarnation FROM "${schemaName}"."mastra_harness_attachment_operations" WHERE kind = 'delete' AND attachment_id = $1`,
      ['same-id'],
    );

    const recreated = createSampleSessionRecord({
      id: session.id,
      resourceId: 'native-resource-recreated',
      threadId: 'native-thread-recreated',
    });
    await harness.saveSession(recreated, { ownerId: 'owner-b', ifVersion: 0 });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'same-id',
      name: 'same.bin',
      mimeType: 'application/octet-stream',
      source: 'inline',
      data: new Uint8Array([8, 7]),
    });
    await expect(harness.reconcileAttachmentOperations({ now: Date.now() + 2_000 })).resolves.toMatchObject({
      processed: 1,
      pending: 0,
    });
    const newAttachment = await harness.loadAttachment({ sessionId: session.id, attachmentId: 'same-id' });
    expect(newAttachment?.data).toEqual(new Uint8Array([8, 7]));
    const newSession = await store.db.one<{ session_incarnation: string }>(
      `SELECT session_incarnation FROM "${schemaName}"."mastra_harness_attachments" WHERE session_id = $1 AND attachment_id = $2`,
      [session.id, 'same-id'],
    );
    expect(newSession.session_incarnation).not.toBe(oldSession.session_incarnation);
  });

  it('linearizes real PG reference admission against guarded external delete', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-race',
      resourceId: 'race-resource',
      threadId: 'race-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'race-owner', ttlMs: 60_000 },
    });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'race-attachment',
      name: 'race.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('race'),
    });

    const outcomes = await Promise.allSettled([
      harness.recordAttachmentReferences([
        { sessionId: session.id, attachmentId: 'race-attachment', source: 'queued_item', sourceId: 'race-ref' },
      ]),
      harness.deleteAttachment({ sessionId: session.id, attachmentId: 'race-attachment' }),
    ]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
    const rejected = outcomes.find(outcome => outcome.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toSatisfy(
      reason =>
        reason instanceof HarnessStorageAttachmentInUseError ||
        reason?.code === 'harness.storage.attachment_unavailable',
    );

    const references = await harness.listAttachmentReferences({
      sessionId: session.id,
      attachmentId: 'race-attachment',
    });
    if (references.length > 0) {
      await harness.deleteAttachmentReferences([
        { sessionId: session.id, attachmentId: 'race-attachment', source: 'queued_item', sourceId: 'race-ref' },
      ]);
      await harness.deleteAttachment({ sessionId: session.id, attachmentId: 'race-attachment' });
    }
    await expect(
      harness.loadAttachment({ sessionId: session.id, attachmentId: 'race-attachment' }),
    ).resolves.toBeNull();
  });

  it('fences first uploads and reports a live delete claim as pending', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-fence',
      resourceId: 'fence-resource',
      threadId: 'fence-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'fence-owner', ttlMs: 60_000 },
    });

    owner.pauseNextSave();
    const savePromise = harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'first-upload',
      name: 'first.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('first upload'),
    });
    await owner.waitForSaveStarted();
    await expect(harness.reconcileAttachmentOperations()).resolves.toMatchObject({ processed: 0, pending: 1 });
    await expect(harness.deleteSession({ sessionId: session.id })).rejects.toBeInstanceOf(
      HarnessStorageAttachmentPendingError,
    );
    owner.releaseSave();
    await expect(savePromise).resolves.toMatchObject({ attachmentId: 'first-upload' });
    await expect(harness.deleteSession({ sessionId: session.id })).resolves.toBeUndefined();

    const recreated = createSampleSessionRecord({
      id: session.id,
      resourceId: 'fence-resource-recreated',
      threadId: 'fence-thread-recreated',
    });
    await harness.saveSession(recreated, { ownerId: 'fence-owner', ifVersion: 0 });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'claimed-delete',
      name: 'claimed.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('claimed delete'),
    });
    owner.pauseNextDelete();
    const firstDelete = harness.deleteAttachment({ sessionId: session.id, attachmentId: 'claimed-delete' });
    await owner.waitForDeleteStarted();
    await expect(
      harness.deleteAttachment({ sessionId: session.id, attachmentId: 'claimed-delete' }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    owner.releaseDelete();
    await expect(firstDelete).resolves.toBeUndefined();
  });

  it('cleans an ambiguous PUT after the owning session is absent', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-orphan',
      resourceId: 'orphan-resource',
      threadId: 'orphan-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'orphan-owner', ttlMs: 60_000 },
    });
    const data = new TextEncoder().encode('ambiguous orphan');
    owner.unknownSaveOnce = true;
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'orphaned',
        name: 'orphaned.txt',
        mimeType: 'text/plain',
        source: 'inline',
        data,
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    const operation = await store.db.one<{
      id: string;
      status: string;
      blob_ref: string;
      session_incarnation: string;
      size_bytes: string | number;
      sha256: string;
    }>(
      `SELECT id, status, blob_ref, session_incarnation, size_bytes, sha256
       FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'orphaned'],
    );
    await store.db.none(`DELETE FROM "${schemaName}"."mastra_harness_sessions" WHERE id = $1`, [session.id]);

    await expect(harness.reconcileAttachmentOperations({ limit: 1, now: Date.now() + 2_000 })).resolves.toMatchObject({
      processed: 1,
    });
    const cleaned = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'orphaned'],
    );
    expect(cleaned.status).toBe('cleaned');
    await expect(
      owner.load({
        blobRef: operation.blob_ref,
        owner: {
          harnessName: 'default',
          sessionId: session.id,
          attachmentId: 'orphaned',
          incarnation: operation.session_incarnation,
        },
        expectedBytes: Number(operation.size_bytes),
        expectedSha256: operation.sha256,
        maxBytes: 100 * 1024 * 1024,
      }),
    ).resolves.toBeNull();
  });

  it('keeps a cancellation claim while a late upload response arrives', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-cancel-claim',
      resourceId: 'cancel-claim-resource',
      threadId: 'cancel-claim-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'cancel-claim-owner', ttlMs: 60_000 },
    });

    owner.pauseNextSave();
    owner.pauseNextCancel();
    const savePromise = harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'late-upload',
      name: 'late.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('late upload'),
    });
    await owner.waitForSaveStarted();
    const reconciliation = harness.reconcileAttachmentOperations({ now: Date.now() + 61_000 });
    await owner.waitForCancelStarted();
    owner.releaseSave();
    await expect(savePromise).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    const claimed = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'late-upload'],
    );
    expect(claimed.status).toBe('claimed');
    owner.releaseCancel();
    await expect(reconciliation).resolves.toMatchObject({ processed: 1, pending: 0 });
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'late-upload' })).resolves.toBeNull();
  });

  it('reconciles an abandoned PUT through the typed owner fence before session deletion', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-abandoned',
      resourceId: 'abandoned-resource',
      threadId: 'abandoned-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'abandoned-owner', ttlMs: 60_000 },
    });
    owner.failSaveOnce = true;
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'abandoned',
        name: 'abandoned.txt',
        mimeType: 'text/plain',
        source: 'inline',
        data: new TextEncoder().encode('abandoned'),
      }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);

    await expect(harness.reconcileAttachmentOperations({ limit: 1, now: Date.now() + 2_000 })).resolves.toMatchObject({
      processed: 1,
      pending: 0,
    });
    await expect(harness.deleteSession({ sessionId: session.id })).resolves.toBeUndefined();
  });

  it('rejects owner-unaddressable attachment identities without persisting an operation', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-unsafe',
      resourceId: 'unsafe-resource',
      threadId: 'unsafe-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'unsafe-owner', ttlMs: 60_000 },
    });
    const data = new TextEncoder().encode('unsafe identity');
    // A lone surrogate breaks URI-encoding of the derived reference, and a
    // multibyte id near the component bound expands past the encoded bound —
    // either would persist an operation the owner can never address.
    for (const attachmentId of ['bad\nid', 'x'.repeat(600), 'a\ud800', '汉'.repeat(500)]) {
      await expect(
        harness.saveAttachment({
          sessionId: session.id,
          attachmentId,
          name: 'unsafe.txt',
          mimeType: 'text/plain',
          source: 'inline',
          data,
        }),
      ).rejects.toBeInstanceOf(HarnessAttachmentByteOwnerInvalidInputError);
    }
    const operations = await store.db.any(
      `SELECT id FROM "${schemaName}"."mastra_harness_attachment_operations" WHERE session_id = $1`,
      [session.id],
    );
    expect(operations).toHaveLength(0);
    // No durable operation exists, so teardown is not fenced by it.
    await expect(harness.deleteSession({ sessionId: session.id })).resolves.toBeUndefined();
  });

  it('keeps a fresher delete claim when a stale claimant reports unknown', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-claim',
      resourceId: 'claim-resource',
      threadId: 'claim-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'claim-owner', ttlMs: 60_000 },
    });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'stale-claim',
      name: 'stale.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('stale claim'),
    });

    owner.pauseNextDelete();
    const firstDelete = harness.deleteAttachment({ sessionId: session.id, attachmentId: 'stale-claim' });
    await owner.waitForDeleteStarted();
    // Age the first claim out so a second reconciler legitimately reclaims it.
    await store.db.none(
      `UPDATE "${schemaName}"."mastra_harness_attachment_operations"
       SET claim_expires_at = 0 WHERE kind = 'delete' AND attachment_id = $1`,
      ['stale-claim'],
    );
    owner.pauseNextDelete();
    const secondSweep = harness.reconcileAttachmentOperations({ now: Date.now() + 61_000 });
    await owner.waitForDeleteStarted();
    const liveClaim = await store.db.one<{ status: string; claim_id: string | null }>(
      `SELECT status, claim_id FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'delete' AND attachment_id = $1`,
      ['stale-claim'],
    );
    expect(liveClaim.status).toBe('claimed');
    expect(liveClaim.claim_id).not.toBeNull();

    // The expired claimant now resolves as unknown; it must not clear the
    // fresher claim or reset the operation underneath it.
    owner.unknownDeleteOnce = true;
    owner.releaseDelete();
    await expect(firstDelete).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    const afterStale = await store.db.one<{ status: string; claim_id: string | null }>(
      `SELECT status, claim_id FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'delete' AND attachment_id = $1`,
      ['stale-claim'],
    );
    expect(afterStale.status).toBe('claimed');
    expect(afterStale.claim_id).toBe(liveClaim.claim_id);

    owner.releaseDelete();
    await expect(secondSweep).resolves.toMatchObject({ processed: 1, pending: 0 });
    const finished = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'delete' AND attachment_id = $1`,
      ['stale-claim'],
    );
    expect(finished.status).toBe('completed');
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'stale-claim' })).resolves.toBeNull();
  });

  it('resumes an outstanding external delete when the session is deleted', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-orphan-delete',
      resourceId: 'orphan-resource',
      threadId: 'orphan-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'orphan-owner', ttlMs: 60_000 },
    });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'orphan',
      name: 'orphan.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('orphan delete'),
    });
    // The first external delete resolves ambiguously: the metadata row is
    // committed gone while the operation stays recoverable.
    owner.unknownDeleteOnce = true;
    await expect(harness.deleteAttachment({ sessionId: session.id, attachmentId: 'orphan' })).rejects.toBeInstanceOf(
      HarnessStorageAttachmentPendingError,
    );
    // Session deletion must resume that intent instead of reporting success
    // while external bytes remain.
    await expect(harness.deleteSession({ sessionId: session.id })).resolves.toBeUndefined();
    const operation = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'delete' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'orphan'],
    );
    expect(operation.status).toBe('completed');
  });

  it('keeps identical saves idempotent when semantic defaults are persisted', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-semantic-retry',
      resourceId: 'semantic-resource',
      threadId: 'semantic-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'semantic-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'semantic-retry',
      name: 'semantic.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('semantic retry'),
      semantic: { metadata: { label: 'a' } },
    };
    await expect(harness.saveAttachment(input)).resolves.toMatchObject({ attachmentId: 'semantic-retry' });
    // The stored row carries kind: 'file'; the same logical request must not
    // conflict just because the caller omitted the default.
    await expect(harness.saveAttachment(input)).resolves.toMatchObject({ attachmentId: 'semantic-retry' });
  });

  it('resolves concurrent identical first saves without false failures', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-concurrent-save',
      resourceId: 'concurrent-resource',
      threadId: 'concurrent-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'concurrent-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'concurrent',
      name: 'concurrent.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('concurrent save'),
    };
    // The losers of the insert race observe the shared operation completed
    // and must adopt the committed row rather than fail on the unique key.
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => harness.saveAttachment(input)));
    for (const result of results) {
      expect(result.status).toBe('fulfilled');
    }
    const loaded = await harness.loadAttachment({ sessionId: session.id, attachmentId: 'concurrent' });
    expect(loaded?.name).toBe('concurrent.txt');
  });

  it('keeps identical saves idempotent when optional semantic keys are unset', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-semantic-undefined',
      resourceId: 'semantic-undefined-resource',
      threadId: 'semantic-undefined-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'semantic-undefined-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'semantic-undefined',
      name: 'semantic-undefined.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('semantic undefined'),
      // Persistence drops undefined properties via JSON.stringify; the
      // retry comparison must apply the same canonicalization.
      semantic: { metadata: { label: 'a', dropped: undefined } as Record<string, JsonValue> },
    };
    await expect(harness.saveAttachment(input)).resolves.toMatchObject({ attachmentId: 'semantic-undefined' });
    await expect(harness.saveAttachment(input)).resolves.toMatchObject({ attachmentId: 'semantic-undefined' });
  });

  it('defers to an upload retry that renewed its reservation mid-sweep', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-claim-renewal',
      resourceId: 'renewal-resource',
      threadId: 'renewal-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'renewal-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'renewed',
      name: 'renewed.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('renewed upload'),
    };
    owner.unknownSaveOnce = true;
    await expect(harness.saveAttachment(input)).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    // Make the failed upload immediately eligible for reconciliation.
    await store.db.none(
      `UPDATE "${schemaName}"."mastra_harness_attachment_operations"
       SET next_attempt_at = 0 WHERE kind = 'put' AND attachment_id = $1`,
      ['renewed'],
    );

    // Pause the sweep just after it selects the candidate; meanwhile a retry
    // reserves the operation and starts a fresh upload, renewing the
    // deferral. The claim must observe the renewal under the row lock and
    // leave the operation alone rather than cancelling the active upload.
    const db = store.db as unknown as { query: (query: unknown, values?: unknown) => Promise<unknown> };
    const originalQuery = db.query.bind(store.db);
    let intercept = true;
    let candidateSelected!: () => void;
    let resumeClaim!: () => void;
    const selected = new Promise<void>(resolve => (candidateSelected = resolve));
    const resume = new Promise<void>(resolve => (resumeClaim = resolve));
    db.query = async (query: unknown, values?: unknown) => {
      const result = await originalQuery(query, values);
      if (intercept && typeof query === 'string' && query.includes('SELECT id, kind')) {
        intercept = false;
        candidateSelected();
        await resume;
      }
      return result;
    };
    try {
      const sweep = harness.reconcileAttachmentOperations({ now: Date.now() });
      await selected;
      owner.pauseNextSave();
      const retry = harness.saveAttachment(input);
      await owner.waitForSaveStarted();
      resumeClaim();
      await expect(sweep).resolves.toMatchObject({ processed: 1 });
      owner.releaseSave();
      await expect(retry).resolves.toMatchObject({ attachmentId: 'renewed' });
    } finally {
      db.query = originalQuery;
    }
    const operation = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND attachment_id = $1`,
      ['renewed'],
    );
    expect(operation.status).toBe('completed');
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'renewed' })).resolves.toMatchObject({
      name: 'renewed.txt',
    });
  });

  it('saves attachments when optional default indexes are skipped', async () => {
    const altSchema = `pf4267_noidx_${randomUUID().replaceAll('-', '_')}`;
    const altStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-harness-native-attachment-noidx',
      schemaName: altSchema,
      enabledDomains: ['harness'],
      sessionRecordProjection: { enabled: true, maxAttempts: 1, maxPendingIntents: 20 },
      attachmentByteOwner: new UnknownDeleteOnceOwner(),
      skipDefaultIndexes: true,
    });
    try {
      await altStore.init();
      const altHarness = altStore.stores.harness!;
      const session = createSampleSessionRecord({
        id: 'noidx-session',
        resourceId: 'noidx-resource',
        threadId: 'noidx-thread',
      });
      await altHarness.createOrLoadActiveSession(session, {
        initialLease: { ownerId: 'noidx-owner', ttlMs: 60_000 },
      });
      // The ON CONFLICT scope uniqueness is correctness-critical, not an
      // optional index: saving must work even without default indexes.
      await expect(
        altHarness.saveAttachment({
          sessionId: session.id,
          attachmentId: 'noidx-attachment',
          name: 'noidx.txt',
          mimeType: 'text/plain',
          source: 'inline',
          data: new TextEncoder().encode('no default indexes'),
        }),
      ).resolves.toMatchObject({ attachmentId: 'noidx-attachment' });
    } finally {
      await altStore.db.none(`DROP SCHEMA IF EXISTS "${altSchema}" CASCADE`).catch(() => {});
      await altStore.close();
    }
  });

  it('keeps a renewed reservation when an overlapping upload fails late', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-late-failure',
      resourceId: 'late-failure-resource',
      threadId: 'late-failure-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'late-failure-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'overlapping',
      name: 'overlapping.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('overlapping upload'),
    };

    // Park both uploads against the shared operation; the second reservation
    // renews its deferral while the first upload is still in flight.
    owner.pauseNextSave();
    owner.pauseNextSave();
    owner.unknownSaveOnce = true;
    const first = harness.saveAttachment(input);
    await owner.waitForSaveStarted();
    const second = harness.saveAttachment(input);
    await owner.waitForSaveStarted();

    // The first attempt reports an ambiguous failure only after the second
    // renewed the reservation. Its failure transition must not pull the
    // deadline back underneath the still-running upload — otherwise a sweep
    // could claim and cancel the operation mid-upload.
    owner.releaseSave();
    await expect(first).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);
    const deferred = await store.db.one<{ next_attempt_at: string }>(
      `SELECT next_attempt_at FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND attachment_id = $1`,
      ['overlapping'],
    );
    expect(Number(deferred.next_attempt_at)).toBeGreaterThan(Date.now() + 30_000);
    await expect(harness.reconcileAttachmentOperations({ now: Date.now() + 2_000 })).resolves.toMatchObject({
      processed: 0,
    });

    owner.releaseSave();
    await expect(second).resolves.toMatchObject({ attachmentId: 'overlapping' });
    const operation = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND attachment_id = $1`,
      ['overlapping'],
    );
    expect(operation.status).toBe('completed');
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'overlapping' })).resolves.toMatchObject(
      { name: 'overlapping.txt' },
    );
  });

  it('adopts the committed row when a third identical save races a lost-insert reload', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-deadlock',
      resourceId: 'deadlock-resource',
      threadId: 'deadlock-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'deadlock-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'raced',
      name: 'raced.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('raced upload'),
    };

    // Intercept pooled connections so transaction internals stay observable:
    // the operation-row FOR UPDATE the commit phase takes, and the attachment
    // row reads that establish who saw what. This reproduces the three-way
    // interleave where the loser of a first-save insert race holds the
    // operation lock while a third saver's reservation holds the attachment
    // lock — the reload between them must not acquire the attachment lock
    // again or PostgreSQL reports 40P01.
    let commitOpReads = 0;
    let phase: 'start' | 'b-empty' | 'c-holds-row' = 'start';
    let firstOpHeld!: () => void;
    let releaseFirstOp!: () => void;
    let secondOpHeld!: () => void;
    let releaseSecondOp!: () => void;
    let bSawEmpty!: () => void;
    let cHasRow!: () => void;
    const firstHeld = new Promise<void>(resolve => (firstOpHeld = resolve));
    const firstRelease = new Promise<void>(resolve => (releaseFirstOp = resolve));
    const secondHeld = new Promise<void>(resolve => (secondOpHeld = resolve));
    const secondRelease = new Promise<void>(resolve => (releaseSecondOp = resolve));
    const bEmpty = new Promise<void>(resolve => (bSawEmpty = resolve));
    const cRow = new Promise<void>(resolve => (cHasRow = resolve));

    const db = store.db as unknown as {
      connect: () => Promise<{
        query: (query: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
        release: () => void;
      }>;
    };
    const originalConnect = db.connect.bind(store.db);
    db.connect = async () => {
      const connection = await originalConnect();
      return {
        release: connection.release.bind(connection),
        async query(query: string, values?: unknown[]) {
          const result = await connection.query(query, values);
          if (
            query.startsWith('SELECT *') &&
            query.includes('mastra_harness_attachment_operations') &&
            query.includes('WHERE id = $1 FOR UPDATE')
          ) {
            commitOpReads += 1;
            if (commitOpReads === 1) {
              firstOpHeld();
              await firstRelease;
            }
            if (commitOpReads === 2) {
              secondOpHeld();
              await secondRelease;
            }
          }
          if (
            query.startsWith('SELECT *') &&
            query.includes('mastra_harness_attachments') &&
            query.includes('FOR UPDATE')
          ) {
            if (phase === 'b-empty' && result.rows.length === 0) bSawEmpty();
            if (phase === 'c-holds-row' && result.rows.length === 1) cHasRow();
          }
          return result;
        },
      };
    };

    try {
      owner.pauseNextSave();
      owner.pauseNextSave();
      const firstSave = harness.saveAttachment(input).catch((error: unknown) => error);
      await owner.waitForSaveStarted();
      const secondSave = harness.saveAttachment(input).catch((error: unknown) => error);
      await owner.waitForSaveStarted();

      // First saver commits the row while holding the operation lock.
      owner.releaseSave();
      await firstHeld;
      // Second saver reads the attachment row as absent, then parks on the
      // operation lock the first saver still holds.
      phase = 'b-empty';
      owner.releaseSave();
      await bEmpty;
      releaseFirstOp();
      await expect(firstSave).resolves.toMatchObject({ attachmentId: 'raced' });
      await secondHeld;
      // Third saver's reservation takes the attachment row lock — the row now
      // exists — then waits on the operation lock the second saver holds.
      phase = 'c-holds-row';
      const thirdSave = harness.saveAttachment(input).catch((error: unknown) => error);
      await cRow;
      releaseSecondOp();

      await expect(secondSave).resolves.toMatchObject({ attachmentId: 'raced' });
      await expect(thirdSave).resolves.toMatchObject({ attachmentId: 'raced' });
    } finally {
      db.connect = originalConnect;
      releaseFirstOp();
      releaseSecondOp();
      owner.releaseSave();
      owner.releaseSave();
    }
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'raced' })).resolves.toMatchObject({
      name: 'raced.txt',
    });
  });

  it('keeps attachment-before-operation lock order when bulk deletion races a save', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-bulk-deadlock',
      resourceId: 'bulk-deadlock-resource',
      threadId: 'bulk-deadlock-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'bulk-deadlock-owner', ttlMs: 60_000 },
    });
    const input = {
      sessionId: session.id,
      attachmentId: 'bulk-race',
      name: 'bulk-race.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data: new TextEncoder().encode('bulk race'),
    };

    // deleteAttachmentsForSession used to check pending PUT operations before
    // locking attachment rows. When that check waits on a committing save,
    // PostgreSQL retains the operation-row lock even though the rechecked row
    // no longer qualifies — so the bulk transaction holds an operation lock
    // while waiting for attachment rows, the inverse of every save path, and
    // a racing retry deadlocks it (40P01). Drive exactly that interleave.
    let commitOpReads = 0;
    let retryStarted = false;
    let retryRowFired = false;
    let firstOpHeld!: () => void;
    let releaseFirstOp!: () => void;
    let bulkAssertIssued!: () => void;
    let bulkAssertDone!: () => void;
    let releaseBulk!: () => void;
    let retryHasRow!: () => void;
    const firstHeld = new Promise<void>(resolve => (firstOpHeld = resolve));
    const firstRelease = new Promise<void>(resolve => (releaseFirstOp = resolve));
    const assertIssued = new Promise<void>(resolve => (bulkAssertIssued = resolve));
    const assertDone = new Promise<void>(resolve => (bulkAssertDone = resolve));
    const bulkGate = new Promise<void>(resolve => (releaseBulk = resolve));
    const retryRow = new Promise<void>(resolve => (retryHasRow = resolve));

    const db = store.db as unknown as {
      connect: () => Promise<{
        query: (query: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
        release: () => void;
      }>;
    };
    const originalConnect = db.connect.bind(store.db);
    db.connect = async () => {
      const connection = await originalConnect();
      return {
        release: connection.release.bind(connection),
        async query(query: string, values?: unknown[]) {
          const bulkAssert =
            query.includes('mastra_harness_attachment_operations') &&
            query.includes('status NOT IN') &&
            query.includes('FOR UPDATE');
          if (bulkAssert) bulkAssertIssued();
          const result = await connection.query(query, values);
          if (
            query.startsWith('SELECT *') &&
            query.includes('mastra_harness_attachment_operations') &&
            query.includes('WHERE id = $1 FOR UPDATE')
          ) {
            commitOpReads += 1;
            if (commitOpReads === 1) {
              firstOpHeld();
              await firstRelease;
            }
          }
          if (bulkAssert) {
            bulkAssertDone();
            await bulkGate;
          }
          if (
            retryStarted &&
            !retryRowFired &&
            query.includes('mastra_harness_attachments') &&
            query.includes('attachment_id') &&
            query.includes('FOR UPDATE') &&
            result.rows.length === 1
          ) {
            retryRowFired = true;
            retryHasRow();
          }
          return result;
        },
      };
    };

    try {
      owner.pauseNextSave();
      const firstSave = harness.saveAttachment(input).catch((error: unknown) => error);
      await owner.waitForSaveStarted();
      owner.releaseSave();
      // The first saver parks inside its commit transaction holding the PUT
      // operation lock, before the attachment row is inserted.
      await firstHeld;
      const bulk = harness.deleteAttachmentsForSession({ sessionId: session.id }).catch((error: unknown) => error);
      await assertIssued;
      // First save commits the row and completes the operation; the bulk
      // check rechecks the now-terminal row but keeps its lock and parks.
      releaseFirstOp();
      await expect(firstSave).resolves.toMatchObject({ attachmentId: 'bulk-race' });
      await assertDone;
      // The retry's reservation takes the attachment row lock, then needs the
      // operation row the bulk transaction still holds.
      retryStarted = true;
      const retry = harness.saveAttachment(input).catch((error: unknown) => error);
      await retryRow;
      releaseBulk();

      await expect(retry).resolves.toMatchObject({ attachmentId: 'bulk-race' });
      await expect(bulk).resolves.toBeUndefined();
    } finally {
      db.connect = originalConnect;
      releaseFirstOp();
      releaseBulk();
      owner.releaseSave();
    }
    await expect(harness.loadAttachment({ sessionId: session.id, attachmentId: 'bulk-race' })).resolves.toMatchObject({
      name: 'bulk-race.txt',
    });
  });

  it('keeps attachment-before-operation order when session and bulk deletes race', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-delete-race',
      resourceId: 'delete-race-resource',
      threadId: 'delete-race-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'delete-race-owner', ttlMs: 60_000 },
    });
    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'survivor-a',
      name: 'survivor-a.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('delete race'),
    });

    // Stage a pending PUT directly, then hold its row lock from a third
    // transaction mid-transition to 'cleaned' — the reconcile path's exact
    // shape while a claim is in flight. A FOR UPDATE check that unblocks on
    // the now-terminal row keeps its lock after the recheck excludes it, so
    // whichever deletion acquired the operation lock first still holds it
    // while waiting on the attachment rows the other holds — a deadlock
    // (40P01) unless every path locks attachments before operations.
    const opA = await store.db.one<{ harness_name: string; session_incarnation: string }>(
      `SELECT harness_name, session_incarnation FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE attachment_id = $1`,
      ['survivor-a'],
    );
    const opB = randomUUID();
    const stagedAt = Date.now();
    await store.db.none(
      `INSERT INTO "${schemaName}"."mastra_harness_attachment_operations"
       (id, harness_name, session_id, attachment_id, session_incarnation, kind, status,
        name, mime_type, source, size_bytes, sha256, semantic_json, attempts, created_at, updated_at, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, 'put', 'pending', 'b.bin', 'application/octet-stream', 'inline', 1,
               $6, '{"kind":"file"}', 0, $7, $7, $8)`,
      [
        opB,
        opA.harness_name,
        session.id,
        'pending-b',
        opA.session_incarnation,
        '0'.repeat(64),
        stagedAt,
        stagedAt + 60_000,
      ],
    );

    const db = store.db as unknown as {
      connect: () => Promise<{
        query: (query: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
        release: () => void;
      }>;
    };
    const originalConnect = db.connect.bind(store.db);
    const transitioner = await originalConnect();
    await transitioner.query('BEGIN');
    await transitioner.query(
      `UPDATE "${schemaName}"."mastra_harness_attachment_operations" SET status = 'cleaned', updated_at = $1 WHERE id = $2`,
      [Date.now(), opB],
    );

    let d1AssertIssued!: () => void;
    let d2AttachmentsIssued!: () => void;
    const d1Assert = new Promise<void>(resolve => (d1AssertIssued = resolve));
    const d2Attachments = new Promise<void>(resolve => (d2AttachmentsIssued = resolve));
    db.connect = async () => {
      const connection = await originalConnect();
      let kind: 'd1' | 'd2' | undefined;
      return {
        release: connection.release.bind(connection),
        async query(query: string, values?: unknown[]) {
          if (kind === undefined && query.includes('mastra_harness_sessions') && query.includes('FOR UPDATE')) {
            kind = 'd1';
          } else if (
            kind === undefined &&
            query.includes('mastra_harness_attachments') &&
            query.includes('FOR UPDATE') &&
            !query.includes('attachment_id')
          ) {
            kind = 'd2';
            d2AttachmentsIssued();
          }
          if (kind === 'd1' && query.includes('status NOT IN') && query.includes('FOR UPDATE')) {
            d1AssertIssued();
          }
          return connection.query(query, values);
        },
      };
    };

    let transitionerOpen = true;
    try {
      const sessionDelete = harness.deleteSession({ sessionId: session.id }).catch((error: unknown) => error);
      await d1Assert;
      const bulkDelete = harness
        .deleteAttachmentsForSession({ sessionId: session.id })
        .catch((error: unknown) => error);
      await d2Attachments;
      // Wait until the bulk delete's pending-PUT check is actually queued on
      // the transitioner's operation lock before committing it — an issued
      // query may not have reached the lock manager yet. The first waiter
      // blocks on the transitioner's xid while holding the arbitration tuple
      // lock, and the second blocks on that tuple lock, so count backends
      // lock-waiting inside the pending-PUT check itself. Under the fixed
      // order the bulk delete instead stays blocked on the attachment rows
      // the session delete already holds, so only one waiter ever queues.
      const waitersSql = `SELECT COUNT(*)::text AS n FROM pg_stat_activity
                          WHERE wait_event_type = 'Lock'
                            AND query LIKE '%mastra_harness_attachment_operations%'
                            AND query LIKE '%status NOT IN%'`;
      for (let i = 0; i < 40; i++) {
        const { n } = await store.db.one<{ n: string }>(waitersSql);
        if (Number(n) >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      // Committing the transition lets both pending-PUT checks recheck and
      // skip the now-cleaned row; whichever acquired it first keeps the lock.
      await transitioner.query('COMMIT');
      transitioner.release();
      transitionerOpen = false;

      // Both metadata deletions commit, but each then reconciles the same
      // staged cleanup operation — the claim loser legitimately reports the
      // delete as still pending. Only the inverted-order outcome (40P01) is
      // the defect under test.
      for (const outcome of [await sessionDelete, await bulkDelete]) {
        if (outcome === undefined) continue;
        expect(outcome).toBeInstanceOf(HarnessStorageAttachmentPendingError);
        expect((outcome as { code?: string }).code).not.toBe('40P01');
      }
    } finally {
      db.connect = originalConnect;
      if (transitionerOpen) {
        await transitioner.query('ROLLBACK').catch(() => {});
        transitioner.release();
      }
    }
    const remaining = await store.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${schemaName}"."mastra_harness_attachments" WHERE session_id = $1`,
      [session.id],
    );
    expect(remaining.count).toBe('0');
    const sessions = await store.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${schemaName}"."mastra_harness_sessions" WHERE id = $1`,
      [session.id],
    );
    expect(sessions.count).toBe('0');
  });

  it('persists blob references longer than the B-tree index entry bound', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-long-ref',
      resourceId: 'long-ref-resource',
      threadId: 'long-ref-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'long-ref-owner', ttlMs: 60_000 },
    });
    // The 4,096-character reference bound exceeds PostgreSQL's ~2,704-byte
    // B-tree entry limit; the blob_ref index is a hash index so fixed-size
    // digests are stored instead. The payload must be incompressible —
    // PostgreSQL compresses index entries, so a repeated character would fit.
    const incompressible = Array.from({ length: 95 }, () => randomUUID().replaceAll('-', '')).join('');
    const longRef = `memory://native-integration-test/harness-attachments/${incompressible}`;
    owner.overrideNextBlobRef(longRef);
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'long-ref',
        name: 'long-ref.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data: new Uint8Array([7, 7]),
      }),
    ).resolves.toMatchObject({ attachmentId: 'long-ref', bytes: 2 });
    const row = await store.db.one<{ blob_ref: string }>(
      `SELECT blob_ref FROM "${schemaName}"."mastra_harness_attachments" WHERE session_id = $1 AND attachment_id = $2`,
      [session.id, 'long-ref'],
    );
    expect(row.blob_ref).toBe(longRef);
  });

  it('matches an operation retry that spells out the default semantic kind', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-semantic-default',
      resourceId: 'semantic-default-resource',
      threadId: 'semantic-default-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'semantic-default-owner', ttlMs: 60_000 },
    });
    const data = new Uint8Array([3, 1, 4]);
    const first = await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'semantic-default',
      name: 'semantic.bin',
      mimeType: 'application/octet-stream',
      source: 'inline',
      data,
      semantic: { metadata: { label: 'x' } },
    });
    // Replaying the persisted representation adds the stored kind default;
    // the operation comparison must normalize it the same way the row
    // comparison does or the identical retry reads as a conflict.
    await expect(
      harness.saveAttachment({
        sessionId: session.id,
        attachmentId: 'semantic-default',
        name: 'semantic.bin',
        mimeType: 'application/octet-stream',
        source: 'inline',
        data,
        semantic: { kind: 'file', metadata: { label: 'x' } },
      }),
    ).resolves.toMatchObject({ attachmentId: 'semantic-default', sha256: first.sha256 });
  });

  it('fences a retry while an ambiguous cancellation may still land', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'native-attachment-cancel-fence',
      resourceId: 'cancel-fence-resource',
      threadId: 'cancel-fence-thread',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'cancel-fence-owner', ttlMs: 60_000 },
    });
    const data = new TextEncoder().encode('cancel fenced bytes');
    const input = {
      sessionId: session.id,
      attachmentId: 'cancel-fenced',
      name: 'cancel-fenced.txt',
      mimeType: 'text/plain',
      source: 'inline' as const,
      data,
    };

    // The first upload's outcome is lost: bytes may exist at the derived
    // reference, but the attachment row never committed.
    owner.unknownSaveOnce = true;
    await expect(harness.saveAttachment(input)).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);

    // The sweep decides the abandoned PUT must be cancelled, but the owner
    // cannot say whether the cancellation took effect. The operation must
    // stay claimed — marking it adoptable would let a retry complete metadata
    // while the delayed cancellation still deletes the bytes.
    owner.unknownCancelOnce = true;
    await harness.reconcileAttachmentOperations({ now: Date.now() + 2_000 });
    await expect(harness.saveAttachment(input)).rejects.toBeInstanceOf(HarnessStorageAttachmentPendingError);

    // The delayed cancellation lands. Once the deferred claim expires in
    // real time — claim re-acquisition uses the wall clock — a later sweep
    // resolves the idempotent cancel to 'cleaned'; the retry reports a
    // conflict rather than resurrecting the attachment over missing bytes.
    await owner.applyDeferredCancels();
    await new Promise(resolve => setTimeout(resolve, 1_100));
    await harness.reconcileAttachmentOperations({ now: Date.now() + 5_000 });
    await expect(harness.saveAttachment(input)).rejects.toBeInstanceOf(HarnessStorageAttachmentConflictError);

    const remaining = await store.db.one<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM "${schemaName}"."mastra_harness_attachments"
       WHERE session_id = $1 AND attachment_id = $2`,
      [session.id, 'cancel-fenced'],
    );
    expect(Number(remaining.count)).toBe(0);
    const operation = await store.db.one<{ status: string }>(
      `SELECT status FROM "${schemaName}"."mastra_harness_attachment_operations"
       WHERE kind = 'put' AND session_id = $1 AND attachment_id = $2`,
      [session.id, 'cancel-fenced'],
    );
    expect(operation.status).toBe('cleaned');
  });

  it('does not spend projection quota when only the attachment byte owner is configured', async () => {
    const offSchema = `pf4267_proj_off_${randomUUID().replaceAll('-', '_')}`;
    const offStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-harness-native-attachment-projection-off-store',
      schemaName: offSchema,
      enabledDomains: ['harness'],
      sessionRecordProjection: { enabled: false, maxAttempts: 1, maxPendingIntents: 1 },
      attachmentByteOwner: new InMemoryHarnessAttachmentByteOwner({ providerId: 'native-integration-test' }),
    });
    try {
      await offStore.init();
      const harness = offStore.stores.harness!;
      // Quota 1: two sessions would deadlock creation if attachment-owner
      // incarnations still wrote undrainable projection intents.
      for (const id of ['off-one', 'off-two']) {
        await harness.createOrLoadActiveSession(
          createSampleSessionRecord({ id, resourceId: `${id}-resource`, threadId: `${id}-thread` }),
          { initialLease: { ownerId: 'off-owner', ttlMs: 60_000 } },
        );
      }
      const intents = await offStore.db.one<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM "${offSchema}"."mastra_harness_session_projection_intents"`,
      );
      expect(intents.count).toBe('0');
      // The incarnation still scopes the external bytes, so attachments work.
      await expect(
        harness.saveAttachment({
          sessionId: 'off-one',
          attachmentId: 'off-attachment',
          name: 'off.txt',
          mimeType: 'text/plain',
          source: 'inline',
          data: new TextEncoder().encode('projection off'),
        }),
      ).resolves.toMatchObject({ attachmentId: 'off-attachment' });
    } finally {
      await offStore.db.none(`DROP SCHEMA IF EXISTS "${offSchema}" CASCADE`).catch(() => {});
      await offStore.close();
    }
  });
});
