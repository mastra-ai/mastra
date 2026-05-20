import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import { HarnessStorageThreadDeleteFenceConflictError, TABLE_HARNESS_SESSION_EVENTS } from '@mastra/core/storage';
import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { exportSchemas, HarnessPG, PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('HarnessPG', () => {
  const store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-test-store' });

  beforeAll(async () => {
    await store.init();
  });

  beforeEach(async () => {
    await store.stores.harness?.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.stores.harness?.dangerouslyClearAll().catch(() => {});
    await store.close();
  });

  it('exports harness tables and creates live default indexes', async () => {
    const ddl = exportSchemas();

    expect(ddl).toContain('mastra_harness_sessions');
    expect(ddl).toContain('mastra_harness_attachments');
    expect(ddl).toContain('mastra_harness_channel_inbox');
    expect(ddl).toContain('mastra_harness_wakeups');
    expect(ddl).toContain(TABLE_HARNESS_SESSION_EVENTS);
    expect(ddl).toContain('idx_harness_sessions_active_key');
    expect(ddl).toContain('idx_harness_session_events_replay');
    expect(ddl).toContain('idx_harness_channel_outbox_idempotency');

    const indexes = await store.db.manyOrNone<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1)
       ORDER BY indexname`,
      [
        [
          'idx_harness_sessions_active_key',
          'idx_harness_channel_inbox_idempotency',
          'idx_harness_channel_outbox_idempotency',
          'idx_harness_session_events_replay',
          'idx_harness_wakeups_idempotency',
        ],
      ],
    );
    expect(indexes.map(row => row.indexname)).toEqual([
      'idx_harness_channel_inbox_idempotency',
      'idx_harness_channel_outbox_idempotency',
      'idx_harness_session_events_replay',
      'idx_harness_sessions_active_key',
      'idx_harness_wakeups_idempotency',
    ]);
  });

  it('keeps long schema-prefixed default index names valid and unique', async () => {
    const schemaName = 'migration_test_schema_1779266119440_dfd7f958d5b5e8';
    const indexNames = HarnessPG.getDefaultIndexDefs(`${schemaName}_`).map(index => index.name);

    expect(indexNames).toHaveLength(new Set(indexNames).size);
    for (const indexName of indexNames) {
      expect(Buffer.byteLength(indexName, 'utf-8')).toBeLessThanOrEqual(63);
    }

    const ddl = HarnessPG.getExportDDL(schemaName).join('\n');
    expect(ddl).toContain('CREATE INDEX');
    expect(ddl).toMatch(/_idx_[0-9a-f]{8}/);
    expect(ddl).not.toContain(`${schemaName}_idx_harness_session_events_replay`);
  });

  it('preserves existing mixed-case short schema index names', () => {
    const indexNames = HarnessPG.getDefaultIndexDefs('TenantA_').map(index => index.name);

    expect(indexNames).toContain('TenantA_idx_harness_sessions_active_key');
    for (const indexName of indexNames) {
      expect(indexName.startsWith('TenantA_')).toBe(true);
      expect(Buffer.byteLength(indexName, 'utf-8')).toBeLessThanOrEqual(63);
    }
  });

  it('initializes Harness indexes for long schema names', async () => {
    const schemaName = `harness_long_schema_${randomUUID().replaceAll('-', '_')}`;
    const longSchemaStore = new PostgresStore({
      ...TEST_CONFIG,
      id: 'pg-harness-long-schema-indexes',
      schemaName,
    });
    try {
      await longSchemaStore.init();
      const expectedNames = HarnessPG.getDefaultIndexDefs(`${schemaName}_`).map(index => index.name);
      const indexes = await longSchemaStore.db.manyOrNone<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = $1
           AND indexname = ANY($2)
         ORDER BY indexname`,
        [schemaName, expectedNames],
      );

      expect(indexes.map(row => row.indexname)).toEqual([...expectedNames].sort());
    } finally {
      await longSchemaStore.close().catch(() => {});
      const cleanupStore = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-long-schema-index-cleanup' });
      try {
        await cleanupStore.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanupStore.close();
      }
    }
  });

  it('allows legacy duplicate active sessions when default indexes are skipped', async () => {
    const schemaName = `harness_skip_${randomUUID().replaceAll('-', '_')}`;
    let seedStore: PostgresStore | undefined;
    let reopenedStore: PostgresStore | undefined;
    try {
      seedStore = new PostgresStore({
        ...TEST_CONFIG,
        id: 'pg-harness-skip-index-seed',
        schemaName,
        skipDefaultIndexes: true,
      });
      await seedStore.init();
      await seedStore.stores.harness!.saveSession(
        createSampleSessionRecord({
          id: 'legacy-active-a',
          resourceId: 'legacy-resource',
          threadId: 'legacy-thread',
        }),
        { ownerId: 'owner-a', ifVersion: 0 },
      );
      await seedStore.stores.harness!.saveSession(
        createSampleSessionRecord({
          id: 'legacy-active-b',
          resourceId: 'legacy-resource',
          threadId: 'legacy-thread',
        }),
        { ownerId: 'owner-b', ifVersion: 0 },
      );
      await seedStore.close();
      seedStore = undefined;

      reopenedStore = new PostgresStore({
        ...TEST_CONFIG,
        id: 'pg-harness-skip-index-reopen',
        schemaName,
        skipDefaultIndexes: true,
      });
      await expect(reopenedStore.init()).resolves.toBeUndefined();
    } finally {
      await reopenedStore?.close().catch(() => {});
      await seedStore?.close().catch(() => {});
      const cleanupStore = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-skip-index-cleanup' });
      try {
        await cleanupStore.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanupStore.close();
      }
    }
  });

  it('persists primitive and element attachment metadata including object pointers', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'primitive-json',
      name: 'data.json',
      mimeType: 'application/json',
      source: 'provider',
      data: new TextEncoder().encode('{"ok":true}'),
      semantic: {
        kind: 'primitive',
        primitiveType: 'json',
        renderer: { id: 'json-viewer', version: '1' },
        schemaId: 'schema:paper-metadata',
        metadata: { label: 'metadata', rows: 1 },
        object: {
          providerId: 'cloudflare-r2',
          objectKey: 'harness/default/sessions/session-1/attachments/primitive-json/hash',
          etag: 'etag-1',
          storageClass: 'standard',
        },
      },
    });
    await harness!.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'element-citation',
      name: 'citation.element',
      mimeType: 'application/vnd.mastra.element+json',
      source: 'inline',
      data: new TextEncoder().encode('citation'),
      semantic: {
        kind: 'element',
        elementType: 'citation-card',
        renderer: { id: 'citation-card', version: '2' },
        metadata: { doi: '10.1234/example' },
      },
    });

    await expect(
      harness!.loadAttachment({ sessionId: 'session-1', attachmentId: 'primitive-json' }),
    ).resolves.toMatchObject({
      semantic: {
        kind: 'primitive',
        primitiveType: 'json',
        renderer: { id: 'json-viewer', version: '1' },
        schemaId: 'schema:paper-metadata',
        metadata: { label: 'metadata', rows: 1 },
        object: {
          providerId: 'cloudflare-r2',
          objectKey: 'harness/default/sessions/session-1/attachments/primitive-json/hash',
          etag: 'etag-1',
          storageClass: 'standard',
        },
      },
    });
    await expect(
      harness!.getAttachmentRecord({ sessionId: 'session-1', attachmentId: 'element-citation' }),
    ).resolves.toMatchObject({
      kind: 'element',
      elementType: 'citation-card',
      renderer: { id: 'citation-card', version: '2' },
      metadata: { doi: '10.1234/example' },
    });
  });

  it('stores message result evidence and blocks active admission behind delete fences', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.writeMessageResultEvidence({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      runId: 'run-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'completed',
      result: { ok: true },
      createdAt: 1,
      updatedAt: 2,
    });

    await expect(
      harness!.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toMatchObject({ status: 'completed', runId: 'run-1', result: { ok: true } });

    await harness!.withThreadDeleteFence({ threadId: 'thread-1', ownerId: 'deleter', ttlMs: 30_000 }, async () => {
      await expect(
        harness!.createOrLoadActiveSession(createSampleSessionRecord(), {
          initialLease: { ownerId: 'harness-worker', ttlMs: 30_000 },
        }),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('atomically claims channel inbox and wakeup rows with PG claim metadata', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();
    const now = Date.now();

    await harness!.saveChannelInboxItem({
      id: 'inbox-1',
      harnessName: 'default',
      channelId: 'slack',
      providerId: 'slack',
      idempotencyKey: 'provider-event-1',
      payloadHash: 'payload-hash-1',
      admissionId: 'admission-1',
      externalMessageId: 'external-1',
      receivedAt: now,
      updatedAt: now,
      status: 'received',
      attempts: 0,
      requestContext: {},
      content: 'hello',
      attachments: [],
    });
    await harness!.createOrLoadHarnessWakeupItem({
      id: 'wakeup-1',
      harnessName: 'default',
      source: 'schedule',
      sourceId: 'schedule-1',
      fireId: 'fire-1',
      idempotencyKey: 'wakeup-key-1',
      payloadHash: 'payload-hash-1',
      admissionId: 'admission-1',
      dueAt: now - 1,
      createdAt: now,
      updatedAt: now,
      status: 'due',
      yolo: true,
      attempts: 0,
      content: 'wake up',
      attachments: [],
    });

    await expect(
      harness!.claimChannelInboxItems({
        harnessName: 'default',
        statuses: ['received'],
        claimId: 'claim-inbox',
        limit: 5,
        now,
        claimTtlMs: 30_000,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'inbox-1', claimId: 'claim-inbox' })]);
    await expect(
      harness!.claimHarnessWakeupItems({
        harnessName: 'default',
        statuses: ['due'],
        claimId: 'claim-wakeup',
        limit: 5,
        now,
        claimTtlMs: 30_000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'wakeup-1',
        status: 'claimed',
        claimId: 'claim-wakeup',
        attempts: 1,
        yolo: true,
      }),
    ]);
  });

  it('lists resource and session scoped channel diagnostics rows', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveChannelInboxItem({
      id: 'inbox-root',
      harnessName: 'default',
      channelId: 'support',
      providerId: 'slack',
      idempotencyKey: 'event-root',
      payloadHash: 'payload-hash-root',
      admissionId: 'admission-root',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      sessionId: 'session-1',
      externalMessageId: 'message-root',
      receivedAt: 1000,
      updatedAt: 1000,
      status: 'received',
      attempts: 0,
      requestContext: {},
      content: 'hello',
      attachments: [],
    });
    await harness!.saveChannelInboxItem({
      id: 'inbox-hidden',
      harnessName: 'default',
      channelId: 'support',
      providerId: 'slack',
      idempotencyKey: 'event-hidden',
      payloadHash: 'payload-hash-hidden',
      admissionId: 'admission-hidden',
      resourceId: 'resource-2',
      threadId: 'thread-1',
      sessionId: 'session-1',
      externalMessageId: 'message-hidden',
      receivedAt: 1000,
      updatedAt: 1000,
      status: 'received',
      attempts: 0,
      requestContext: {},
      content: 'hello',
      attachments: [],
    });
    await harness!.createOrLoadChannelActionToken({
      actionTokenId: 'action-token-1',
      harnessName: 'default',
      channelId: 'support',
      providerId: 'slack',
      resourceId: 'resource-1',
      owningSessionId: 'child-1',
      itemId: 'question-1',
      kind: 'question',
      bindingId: 'binding-1',
      bindingGeneration: 1,
      runId: 'run-1',
      pendingRequestedAt: 1000,
      audience: {},
      metadataHash: 'metadata-hash-1',
      transportHash: 'transport-hash-1',
      keyId: 'key-1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await harness!.createOrLoadChannelActionReceipt({
      id: 'receipt-1',
      harnessName: 'default',
      channelId: 'support',
      providerId: 'slack',
      actionTokenId: 'action-token-1',
      actionId: 'provider-action-1',
      bindingId: 'binding-1',
      bindingGeneration: 1,
      resourceId: 'resource-1',
      owningSessionId: 'child-1',
      itemId: 'question-1',
      kind: 'question',
      runId: 'run-1',
      pendingRequestedAt: 1000,
      audience: {},
      responseHash: 'response-hash-1',
      response: { answer: 'approved' },
      status: 'received',
      attempts: 0,
      createdAt: 1000,
      updatedAt: 1000,
    });
    await harness!.enqueueChannelOutbox({
      id: 'outbox-owned-child',
      harnessName: 'default',
      channelId: 'support',
      providerId: 'slack',
      bindingId: 'binding-1',
      bindingGeneration: 1,
      idempotencyKey: 'outbox-owned-child',
      payloadHash: 'payload-hash-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      owningSessionId: 'child-1',
      target: {
        platform: 'slack',
        externalTenantId: 'tenant-1',
        externalChannelId: 'channel-1',
        externalThreadId: 'thread-ext-1',
      },
      kind: 'assistant-message',
      operationKind: 'message-create',
      payload: { text: 'hello' },
      deliverySemantics: 'native-idempotency',
      status: 'pending',
      attempts: 0,
      createdAt: 1000,
      updatedAt: 1000,
    });

    const rows = await harness!.listChannelDiagnosticsRows({
      harnessName: 'default',
      resourceId: 'resource-1',
      sessionIds: ['session-1', 'child-1'],
      limit: 10,
    });

    expect(rows.inbox.map(row => row.id)).toEqual(['inbox-root']);
    expect(rows.actionTokens.map(row => row.actionTokenId)).toEqual(['action-token-1']);
    expect(rows.actionReceipts.map(row => row.id)).toEqual(['receipt-1']);
    expect(rows.outbox.map(row => row.id)).toEqual(['outbox-owned-child']);
    await expect(
      harness!.listChannelDiagnosticsRows({
        harnessName: 'default',
        resourceId: 'resource-1',
        sessionIds: [],
        limit: 10,
      }),
    ).resolves.toEqual({ inbox: [], actionTokens: [], actionReceipts: [], outbox: [] });
    await expect(
      harness!.listChannelDiagnosticsRows({
        harnessName: 'default',
        resourceId: 'resource-1',
        sessionIds: ['session-1'],
        limit: 0,
      }),
    ).resolves.toEqual({ inbox: [], actionTokens: [], actionReceipts: [], outbox: [] });
  });
});
