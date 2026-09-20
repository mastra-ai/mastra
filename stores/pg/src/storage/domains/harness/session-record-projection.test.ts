import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
  HarnessStorageSessionProjectionIdentityError,
  HarnessStorageThreadDeleteFenceConflictError,
  TABLE_HARNESS_SESSION_PROJECTION_FENCES,
  TABLE_HARNESS_SESSION_PROJECTION_INTENTS,
  TABLE_HARNESS_SESSION_PROJECTION_PRESSURE,
} from '@mastra/core/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('HarnessPG native session record projection', () => {
  const schemaName = `pf4254_projection_${randomUUID().replaceAll('-', '_')}`;
  const store = new PostgresStore({
    ...TEST_CONFIG,
    id: 'pg-harness-session-record-projection-test-store',
    schemaName,
    enabledDomains: ['harness'],
    sessionRecordProjection: {
      enabled: true,
      maxAttempts: 1,
      maxPendingIntents: 20,
    },
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

  it('rolls back a session row when its post-image cannot be built', async () => {
    const harness = store.stores.harness!;
    const id = 'x'.repeat(1025);

    await expect(
      harness.saveSession(createSampleSessionRecord({ id }), { ownerId: 'owner-1', ifVersion: 0 }),
    ).rejects.toThrow(RangeError);

    const sessions = await store.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${schemaName}"."mastra_harness_sessions" WHERE id = $1`,
      [id],
    );
    const intents = await store.db.one<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${schemaName}"."${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}"`,
    );
    expect(sessions.count).toBe('0');
    expect(intents.count).toBe('0');
  });

  it('rejects projection identity retargeting on both session save paths', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'projection-identity-guard',
      resourceId: 'projection-identity-resource',
      threadId: 'projection-identity-thread',
    });
    await harness.saveSession(session, { ownerId: 'owner-identity', ifVersion: 0 });
    const existing = await harness.loadSession({ sessionId: session.id });
    if (!existing) throw new Error('expected projected session');

    await expect(
      harness.saveSession(
        { ...existing, threadId: 'retargeted-thread' },
        { ownerId: 'owner-identity', ifVersion: existing.version },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageSessionProjectionIdentityError);
    await expect(
      harness.saveSessionWithAttachmentReferences(
        { ...existing, resourceId: 'retargeted-resource' },
        { ownerId: 'owner-identity', ifVersion: existing.version },
        [],
      ),
    ).rejects.toBeInstanceOf(HarnessStorageSessionProjectionIdentityError);
    await expect(harness.loadSession({ sessionId: session.id })).resolves.toMatchObject({ version: 1 });
  });

  it('preserves the local deletion-fence guard for projected inserts', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'projection-local-delete-fence',
      resourceId: 'projection-local-delete-resource',
      threadId: 'projection-local-delete-thread',
    });
    await harness.withThreadDeleteFence(
      { threadId: session.threadId, ownerId: 'owner-delete', ttlMs: 30_000 },
      async () => {
        const originalNow = Date.now();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(originalNow + 60_000);
        try {
          await expect(harness.saveSession(session, { ownerId: 'owner-new', ifVersion: 0 })).rejects.toBeInstanceOf(
            HarnessStorageThreadDeleteFenceConflictError,
          );
        } finally {
          clock.mockRestore();
        }
      },
    );
  });

  it('serializes CAS revisions, fences deletion, and mints a new incarnation on recreation', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({ id: 'projection-session' });
    const createdResult = await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'owner-1', ttlMs: 60_000 },
    });
    expect(createdResult.created).toBe(true);
    const created = await harness.loadSession({ sessionId: session.id });
    if (!created?.sessionIncarnation) throw new Error('expected storage-assigned session incarnation');
    const incarnation = created.sessionIncarnation;
    const now = Date.now() + 1;

    await harness.saveAttachment({
      sessionId: session.id,
      attachmentId: 'attachment-1',
      name: 'note.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('attachment'),
    });
    await harness.saveSessionWithAttachmentReferences(
      { ...created, lastActivityAt: created.lastActivityAt + 1 },
      { ownerId: 'owner-1', ifVersion: 1 },
      [{ sessionId: session.id, attachmentId: 'attachment-1', source: 'current_run', sourceId: 'run-1' }],
    );
    await expect(
      harness.listAttachmentReferences({ sessionId: session.id, attachmentId: 'attachment-1' }),
    ).resolves.toEqual([expect.objectContaining({ source: 'current_run', sourceId: 'run-1' })]);
    const afterAttachment = await harness.loadSession({ sessionId: session.id });
    if (!afterAttachment) throw new Error('expected attachment update');

    const firstClaim = await harness.claimSessionRecordProjectionIntents({
      claimId: 'claim-1',
      limit: 1,
      now,
      claimTtlMs: 60_000,
    });
    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]).toMatchObject({ revision: 1, sessionIncarnation: incarnation });

    const outcomes = await Promise.allSettled([
      harness.saveSession(
        { ...afterAttachment, lastActivityAt: afterAttachment.lastActivityAt + 1, modeId: 'mode-a' },
        {
          ownerId: 'owner-1',
          ifVersion: 2,
        },
      ),
      harness.saveSession(
        { ...afterAttachment, lastActivityAt: afterAttachment.lastActivityAt + 2, modeId: 'mode-b' },
        {
          ownerId: 'owner-1',
          ifVersion: 2,
        },
      ),
    ]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);

    await expect(
      harness.claimSessionRecordProjectionIntents({
        claimId: 'claim-2',
        limit: 1,
        now: now + 1,
        claimTtlMs: 60_000,
      }),
    ).resolves.toHaveLength(0);
    await harness.ackSessionRecordProjection({
      operationId: firstClaim[0]!.operationId,
      sessionId: session.id,
      sessionIncarnation: incarnation,
      revision: 1,
      payloadDigest: firstClaim[0]!.payloadDigest,
      claimId: 'claim-1',
      acknowledgedAt: now + 2,
    });

    const secondClaim = await harness.claimSessionRecordProjectionIntents({
      claimId: 'claim-3',
      limit: 1,
      now: now + 3,
      claimTtlMs: 60_000,
    });
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0]).toMatchObject({ revision: 2, sessionIncarnation: incarnation });

    await harness.ackSessionRecordProjection({
      operationId: secondClaim[0]!.operationId,
      sessionId: session.id,
      sessionIncarnation: incarnation,
      revision: 2,
      payloadDigest: secondClaim[0]!.payloadDigest,
      claimId: 'claim-3',
      acknowledgedAt: now + 4,
    });
    const thirdClaim = await harness.claimSessionRecordProjectionIntents({
      claimId: 'claim-4',
      limit: 1,
      now: now + 5,
      claimTtlMs: 60_000,
    });
    expect(thirdClaim).toHaveLength(1);
    expect(thirdClaim[0]).toMatchObject({ revision: 3, sessionIncarnation: incarnation });

    await harness.deleteSession({ sessionId: session.id, ifVersion: 3 });
    await expect(
      harness.ackSessionRecordProjection({
        operationId: thirdClaim[0]!.operationId,
        sessionId: session.id,
        sessionIncarnation: incarnation,
        revision: 3,
        payloadDigest: thirdClaim[0]!.payloadDigest,
        claimId: 'claim-4',
        acknowledgedAt: now + 6,
      }),
    ).resolves.toMatchObject({ status: 'fenced' });

    await harness.saveSession(createSampleSessionRecord({ id: session.id }), { ownerId: 'owner-2', ifVersion: 0 });
    const recreated = await harness.loadSession({ sessionId: session.id });
    expect(recreated?.sessionIncarnation).toBeTruthy();
    expect(recreated?.sessionIncarnation).not.toBe(incarnation);
    await expect(
      harness.ackSessionRecordProjection({
        operationId: thirdClaim[0]!.operationId,
        sessionId: session.id,
        sessionIncarnation: incarnation,
        revision: 3,
        payloadDigest: thirdClaim[0]!.payloadDigest,
        claimId: 'claim-4',
        acknowledgedAt: now + 7,
      }),
    ).resolves.toMatchObject({ status: 'fenced' });
  });

  it('keeps concurrent saves and claim/delete bounded without a lock cycle', async () => {
    const harness = store.stores.harness!;
    const sessionA = createSampleSessionRecord({
      id: 'projection-race-a',
      resourceId: 'resource-a',
      threadId: 'thread-a',
    });
    const sessionB = createSampleSessionRecord({
      id: 'projection-race-b',
      resourceId: 'resource-b',
      threadId: 'thread-b',
    });
    await harness.createOrLoadActiveSession(sessionA, {
      initialLease: { ownerId: 'owner-a', ttlMs: 60_000 },
    });
    await harness.createOrLoadActiveSession(sessionB, {
      initialLease: { ownerId: 'owner-b', ttlMs: 60_000 },
    });
    const loadedA = await harness.loadSession({ sessionId: sessionA.id });
    const loadedB = await harness.loadSession({ sessionId: sessionB.id });
    if (!loadedA || !loadedB) throw new Error('expected race sessions');

    await Promise.all([
      harness.saveSession(
        { ...loadedA, lastActivityAt: loadedA.lastActivityAt + 1 },
        { ownerId: 'owner-a', ifVersion: 1 },
      ),
      harness.saveSession(
        { ...loadedB, lastActivityAt: loadedB.lastActivityAt + 1 },
        { ownerId: 'owner-b', ifVersion: 1 },
      ),
    ]);

    const concurrent = await Promise.race([
      Promise.all([
        harness.claimSessionRecordProjectionIntents({
          claimId: 'race-claim',
          limit: 1,
          now: Date.now(),
          claimTtlMs: 60_000,
        }),
        harness.deleteSession({ sessionId: sessionA.id, ifVersion: 2 }),
      ]),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('projection claim/delete race timed out')), 10_000);
        timer.unref?.();
      }),
    ]);
    const [claimed] = concurrent;
    for (const intent of claimed) {
      await expect(
        harness.ackSessionRecordProjection({
          operationId: intent.operationId,
          sessionId: intent.sessionId,
          sessionIncarnation: intent.sessionIncarnation,
          revision: intent.revision,
          payloadDigest: intent.payloadDigest,
          claimId: 'race-claim',
          acknowledgedAt: Date.now(),
        }),
      ).resolves.toMatchObject({ status: intent.sessionId === sessionA.id ? 'fenced' : 'applied' });
    }

    await harness.deleteSession({ sessionId: sessionB.id, ifVersion: 2 });
    const pressure = await store.db.one<{ pending_intents: string; pending_bytes: string }>(
      `SELECT pending_intents::text AS pending_intents, pending_bytes::text AS pending_bytes
       FROM "${schemaName}"."${TABLE_HARNESS_SESSION_PROJECTION_PRESSURE}"
       WHERE harness_name = $1`,
      ['default'],
    );
    expect(pressure).toEqual({ pending_intents: '0', pending_bytes: '0' });
  });

  it('does not hold projection pressure while deleting an attachment referenced by another save', async () => {
    const harness = store.stores.harness!;
    const sessionA = createSampleSessionRecord({
      id: 'projection-attachment-delete-a',
      resourceId: 'resource-attachment-delete-a',
      threadId: 'thread-attachment-delete-a',
    });
    const sessionB = createSampleSessionRecord({
      id: 'projection-attachment-delete-b',
      resourceId: 'resource-attachment-delete-b',
      threadId: 'thread-attachment-delete-b',
    });
    await harness.createOrLoadActiveSession(sessionA, {
      initialLease: { ownerId: 'owner-a', ttlMs: 60_000 },
    });
    await harness.createOrLoadActiveSession(sessionB, {
      initialLease: { ownerId: 'owner-b', ttlMs: 60_000 },
    });
    await harness.saveAttachment({
      sessionId: sessionA.id,
      attachmentId: 'attachment-race',
      name: 'race.txt',
      mimeType: 'text/plain',
      source: 'inline',
      data: new TextEncoder().encode('race'),
    });
    const loadedB = await harness.loadSession({ sessionId: sessionB.id });
    if (!loadedB) throw new Error('expected attachment race session');

    let releaseAttachment!: () => void;
    const attachmentGate = new Promise<void>(resolve => {
      releaseAttachment = resolve;
    });
    let attachmentLocked!: () => void;
    const attachmentLockObserved = new Promise<void>(resolve => {
      attachmentLocked = resolve;
    });
    const originalConnect = store.db.connect;
    const connect = originalConnect.bind(store.db);
    (store.db as any).connect = async () => {
      const client = await connect();
      const query = client.query.bind(client);
      return new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'query') {
            return async (sql: unknown, args?: unknown[]) => {
              const result = await query(sql as any, args as any);
              if (
                typeof sql === 'string' &&
                sql.includes('FOR KEY SHARE') &&
                sql.includes('mastra_harness_attachments')
              ) {
                attachmentLocked();
                await attachmentGate;
              }
              return result;
            };
          }
          if (property === 'release') return client.release.bind(client);
          return Reflect.get(target, property, receiver);
        },
      });
    };

    try {
      const save = harness.saveSessionWithAttachmentReferences(
        { ...loadedB, lastActivityAt: loadedB.lastActivityAt + 1 },
        { ownerId: 'owner-b', ifVersion: loadedB.version },
        [{ sessionId: sessionA.id, attachmentId: 'attachment-race', source: 'current_run', sourceId: 'race-run' }],
      );
      await attachmentLockObserved;
      const deletion = harness.deleteSession({ sessionId: sessionA.id, ifVersion: 1 });
      await new Promise(resolve => setTimeout(resolve, 100));
      releaseAttachment();
      const outcomes = await Promise.race([
        Promise.allSettled([save, deletion]),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('attachment/delete race timed out')), 10_000);
          timer.unref?.();
        }),
      ]);
      expect(outcomes).toEqual([
        { status: 'fulfilled', value: { version: loadedB.version + 1 } },
        { status: 'fulfilled', value: undefined },
      ]);
    } finally {
      releaseAttachment();
      (store.db as any).connect = originalConnect;
    }
  });

  it('preserves an active final claim and dead-letters it after expiry', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'projection-crash-expiry',
      resourceId: 'resource-crash-expiry',
      threadId: 'thread-crash-expiry',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'owner-crash', ttlMs: 60_000 },
    });
    const claimNow = Date.now();
    const [claimed] = await harness.claimSessionRecordProjectionIntents({
      claimId: 'crash-final-claim',
      limit: 1,
      now: claimNow,
      claimTtlMs: 10,
    });
    expect(claimed).toMatchObject({ attempts: 1, status: 'claimed' });

    await expect(
      harness.claimSessionRecordProjectionIntents({
        claimId: 'crash-too-early',
        limit: 1,
        now: claimNow + 5,
        claimTtlMs: 10,
      }),
    ).resolves.toEqual([]);
    await expect(harness.getSessionRecordProjectionQueuePressure({ sessionId: session.id })).resolves.toMatchObject({
      pendingIntents: 1,
      pendingBytes: expect.any(Number),
    });

    await expect(
      harness.claimSessionRecordProjectionIntents({
        claimId: 'crash-recovery',
        limit: 1,
        now: claimNow + 11,
        claimTtlMs: 10,
      }),
    ).resolves.toEqual([]);
    const intent = await store.db.one<{ status: string; attempts: string }>(
      `SELECT status, attempts::text AS attempts
       FROM "${schemaName}"."${TABLE_HARNESS_SESSION_PROJECTION_INTENTS}"
       WHERE session_id = $1`,
      [session.id],
    );
    expect(intent).toEqual({ status: 'dead', attempts: '1' });
    await expect(harness.getSessionRecordProjectionQueuePressure({ sessionId: session.id })).resolves.toMatchObject({
      pendingIntents: 0,
      pendingBytes: 0,
    });
  });

  it('locks the active session before checking its projection fence', async () => {
    const harness = store.stores.harness!;
    const session = createSampleSessionRecord({
      id: 'projection-open-save-race',
      resourceId: 'resource-open-save-race',
      threadId: 'thread-open-save-race',
    });
    await harness.createOrLoadActiveSession(session, {
      initialLease: { ownerId: 'owner-open-save', ttlMs: 60_000 },
    });

    const client = await store.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE "${schemaName}"."mastra_harness_sessions"
         SET version = 2
         WHERE harness_name = $1 AND id = $2`,
        ['default', session.id],
      );
      await client.query(
        `SELECT session_id
         FROM "${schemaName}"."${TABLE_HARNESS_SESSION_PROJECTION_FENCES}"
         WHERE harness_name = $1 AND session_id = $2
         FOR UPDATE`,
        ['default', session.id],
      );

      const loadPromise = harness.createOrLoadActiveSession(session, {
        initialLease: { ownerId: 'owner-open-save', ttlMs: 60_000 },
      });
      await new Promise(resolve => setTimeout(resolve, 25));
      await client.query(
        `UPDATE "${schemaName}"."${TABLE_HARNESS_SESSION_PROJECTION_FENCES}"
         SET revision = 2, updated_at = $1
         WHERE harness_name = $2 AND session_id = $3`,
        [Date.now(), 'default', session.id],
      );
      await client.query('COMMIT');

      await expect(loadPromise).resolves.toMatchObject({ created: false, version: 2 });
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
    }
  });
});
