import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
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
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

class UnknownDeleteOnceOwner implements HarnessAttachmentByteOwner {
  readonly #delegate = new InMemoryHarnessAttachmentByteOwner({ providerId: 'native-integration-test' });
  #saveStarted: (() => void) | undefined;
  #saveRelease: (() => void) | undefined;
  #saveStartedPromise: Promise<void> | undefined;
  #deleteStarted: (() => void) | undefined;
  #deleteRelease: (() => void) | undefined;
  #deleteStartedPromise: Promise<void> | undefined;
  #cancelStarted: (() => void) | undefined;
  #cancelRelease: (() => void) | undefined;
  #cancelStartedPromise: Promise<void> | undefined;
  unknownSaveOnce = false;
  failSaveOnce = false;
  unknownDeleteOnce = false;

  pauseNextSave(): void {
    this.#saveStartedPromise = new Promise(resolve => {
      this.#saveStarted = resolve;
    });
    this.#saveRelease = undefined;
  }

  async waitForSaveStarted(): Promise<void> {
    await this.#saveStartedPromise;
  }

  releaseSave(): void {
    this.#saveRelease?.();
    this.#saveRelease = undefined;
  }

  pauseNextDelete(): void {
    this.#deleteStartedPromise = new Promise(resolve => {
      this.#deleteStarted = resolve;
    });
    this.#deleteRelease = undefined;
  }

  async waitForDeleteStarted(): Promise<void> {
    await this.#deleteStartedPromise;
  }

  releaseDelete(): void {
    this.#deleteRelease?.();
    this.#deleteRelease = undefined;
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
    if (this.#saveStarted !== undefined) {
      this.#saveStarted();
      this.#saveStarted = undefined;
      await new Promise<void>(resolve => {
        this.#saveRelease = resolve;
      });
    }
    if (this.unknownSaveOnce) {
      this.unknownSaveOnce = false;
      if (result.outcome === 'unknown') return result;
      return { outcome: 'unknown', blobRef: result.blobRef };
    }
    return result;
  }

  load(input: HarnessAttachmentByteOwnerLoadInput): Promise<Uint8Array | null> {
    return this.#delegate.load(input);
  }

  async delete(input: HarnessAttachmentByteOwnerDeleteInput): Promise<HarnessAttachmentByteOwnerDeleteResult> {
    if (this.#deleteStarted !== undefined) {
      this.#deleteStarted();
      this.#deleteStarted = undefined;
      await new Promise<void>(resolve => {
        this.#deleteRelease = resolve;
      });
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
});
