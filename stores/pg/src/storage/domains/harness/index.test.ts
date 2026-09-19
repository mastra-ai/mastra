import { randomUUID } from 'node:crypto';

import { createSampleSessionRecord } from '@internal/storage-test-utils';
import {
  InMemoryHarnessAttachmentByteOwner,
  HarnessStorageAttachmentInUseError,
  HarnessStorageAttachmentUnavailableError,
  HarnessStorageChannelBindingConflictError,
  HarnessStorageLeaseConflictError,
  HarnessStoragePlanTaskNotFoundError,
  HarnessStoragePlanTaskVersionConflictError,
  HarnessStorageProviderCallbackBindingTransitionError,
  HarnessStorageSessionNotFoundError,
  HarnessStorageThreadDeleteFenceConflictError,
  HarnessStorageVersionConflictError,
  TABLE_HARNESS_ATTACHMENT_OPERATIONS,
  TABLE_HARNESS_PLAN_TASKS,
  TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS,
  TABLE_HARNESS_SESSION_EVENTS,
  TABLE_HARNESS_WORKSPACE_ACTIONS,
} from '@mastra/core/storage';
import type {
  ChannelBinding,
  HarnessPlanTask,
  HarnessProviderCallbackBinding,
  SessionRecord,
  WorkspaceActionJournalEntry,
} from '@mastra/core/storage';
import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from 'vitest';

import { exportSchemas, HarnessPG, PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

describe('HarnessPG', () => {
  const store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-test-store' });
  const attachmentSchemaName = `pf4267_attachment_${randomUUID().replaceAll('-', '_')}`;
  const attachmentStore = new PostgresStore({
    ...TEST_CONFIG,
    id: 'pg-harness-attachment-test-store',
    schemaName: attachmentSchemaName,
    enabledDomains: ['harness'],
    sessionRecordProjection: { enabled: true, maxAttempts: 1, maxPendingIntents: 20 },
    attachmentByteOwner: new InMemoryHarnessAttachmentByteOwner({ providerId: 'pg-test' }),
  });

  beforeAll(async () => {
    await store.init();
    await attachmentStore.init();
  });

  beforeEach(async () => {
    await store.stores.harness?.dangerouslyClearAll();
  });

  afterAll(async () => {
    await store.stores.harness?.dangerouslyClearAll().catch(() => {});
    await attachmentStore.db.none(`DROP SCHEMA IF EXISTS "${attachmentSchemaName}" CASCADE`).catch(() => {});
    await store.close();
    await attachmentStore.close();
  });

  it('exports harness tables and creates live default indexes', async () => {
    const ddl = exportSchemas();

    expect(ddl).toContain('mastra_harness_sessions');
    expect(ddl).toContain('mastra_harness_attachments');
    expect(ddl).toContain(TABLE_HARNESS_ATTACHMENT_OPERATIONS);
    expect(ddl).toContain('mastra_harness_channel_inbox');
    expect(ddl).toContain('mastra_harness_wakeups');
    expect(ddl).toContain(TABLE_HARNESS_SESSION_EVENTS);
    expect(ddl).toContain(TABLE_HARNESS_WORKSPACE_ACTIONS);
    expect(ddl).toContain('idx_harness_sessions_active_key');
    expect(ddl).toContain('idx_harness_sessions_parent');
    expect(ddl).toContain('idx_harness_sessions_pending_resume_expiry');
    expect(ddl).toContain('idx_harness_message_results_lookup');
    expect(ddl).toContain('idx_harness_message_results_admission');
    expect(ddl).toContain('idx_harness_tombstones_lookup');
    expect(ddl).toContain('idx_harness_session_events_replay');
    expect(ddl).toContain('idx_harness_workspace_actions_page');
    expect(ddl).toContain('idx_harness_workspace_actions_session');
    expect(ddl).toContain('idx_harness_channel_outbox_idempotency');

    const indexes = await store.db.manyOrNone<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1)
       ORDER BY indexname`,
      [
        [
          'idx_harness_sessions_active_key',
          'idx_harness_sessions_pending_resume_expiry',
          'idx_harness_channel_inbox_idempotency',
          'idx_harness_channel_outbox_idempotency',
          'idx_harness_session_events_replay',
          'idx_harness_wakeups_idempotency',
          'idx_harness_workspace_actions_page',
          'idx_harness_workspace_actions_session',
        ],
      ],
    );
    expect(indexes.map(row => row.indexname)).toEqual([
      'idx_harness_channel_inbox_idempotency',
      'idx_harness_channel_outbox_idempotency',
      'idx_harness_session_events_replay',
      'idx_harness_sessions_active_key',
      'idx_harness_sessions_pending_resume_expiry',
      'idx_harness_wakeups_idempotency',
      'idx_harness_workspace_actions_page',
      'idx_harness_workspace_actions_session',
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
    const harness = attachmentStore.stores.harness;
    expect(harness).toBeDefined();
    await harness!.dangerouslyClearAll();
    await harness!.createOrLoadActiveSession(createSampleSessionRecord(), {
      initialLease: { ownerId: 'attachment-test', ttlMs: 60_000 },
    });

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

  it('appends and pages workspace action journal rows by session/resource', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
    await harness!.saveSession(createSampleSessionRecord({ id: 'other-session', resourceId: 'other-resource' }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await harness!.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'b', createdAt: 1000 }));
    await harness!.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'a', createdAt: 1000 }));
    await harness!.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'c', createdAt: 1100 }));
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'other-resource-entry',
        sessionId: 'other-session',
        resourceId: 'other-resource',
      }),
    );

    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        limit: 2,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ id: 'a', actionKind: 'file', path: expect.objectContaining({ rootId: 'project' }) }),
      expect.objectContaining({ id: 'b', actionKind: 'file' }),
    ]);
    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        after: { createdAt: 1000, id: 'b' },
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'c' })]);
    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        limit: -1,
      }),
    ).resolves.toEqual([]);
  });

  it('filters workspace action journal rows by thread, kind, operation, and policy decision', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
    await harness!.saveSession(createSampleSessionRecord({ harnessName: 'other-harness' }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await expect(
      harness!.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'wrong-thread', threadId: 'thread-2' }),
      ),
    ).resolves.toEqual({ created: false });
    await harness!.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'a', createdAt: 1000 }));
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'b',
        operation: 'read',
        action: { kind: 'file', operation: 'read', path: 'notes.md' },
        policyDecision: 'allow',
        createdAt: 1000,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'c',
        actionKind: 'command',
        operation: 'run',
        action: { kind: 'command', operation: 'run', command: 'pnpm test' },
        policyDecision: 'deny',
        path: undefined,
        createdAt: 1100,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'd',
        actionKind: 'mcp',
        operation: 'call',
        action: { kind: 'mcp', operation: 'call', serverKey: 'filesystem' },
        policyDecision: 'allow',
        path: undefined,
        createdAt: 1200,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'e',
        actionKind: 'network',
        operation: 'fetch',
        action: { kind: 'network', operation: 'fetch', url: 'https://example.test' },
        path: undefined,
        createdAt: 1300,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        harnessName: 'other-harness',
        id: 'other-namespace',
        createdAt: 900,
      }),
    );

    const listIds = async (
      overrides: Partial<Parameters<typeof harness.listWorkspaceActionJournalEntries>[0]>,
    ): Promise<string[]> =>
      (
        await harness!.listWorkspaceActionJournalEntries({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          limit: 10,
          ...overrides,
        })
      ).map(entry => entry.id);

    await expect(listIds({ threadId: 'thread-1' })).resolves.toEqual(['a', 'b', 'c', 'd', 'e']);
    await expect(listIds({ threadId: 'thread-2' })).resolves.toEqual([]);
    await expect(listIds({ sessionId: 'other-session' })).resolves.toEqual([]);
    await expect(listIds({ resourceId: 'other-resource' })).resolves.toEqual([]);
    await expect(listIds({ actionKind: 'file' })).resolves.toEqual(['a', 'b']);
    await expect(listIds({ operation: 'write' })).resolves.toEqual(['a']);
    await expect(listIds({ policyDecision: 'ask' })).resolves.toEqual(['a', 'e']);
    await expect(listIds({ actionKind: 'mcp', policyDecision: 'allow' })).resolves.toEqual(['d']);
    await expect(listIds({ actionKind: 'command', operation: 'run', policyDecision: 'deny' })).resolves.toEqual(['c']);
    await expect(listIds({ actionKind: 'file', after: { createdAt: 1000, id: 'a' } })).resolves.toEqual(['b']);
    await expect(listIds({ harnessName: 'other-harness' })).resolves.toEqual(['other-namespace']);
  });

  it('round-trips workspace action journal observability correlation fields', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });

    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'with-span',
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'other-span',
        traceId: 'trace-2',
        spanId: 'span-2',
      }),
    );

    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-1',
        spanId: 'span-1',
        limit: 10,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'with-span',
        requestId: 'request-1',
        traceId: 'trace-1',
        spanId: 'span-1',
      }),
    ]);
    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-1',
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'with-span' })]);
    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        traceId: 'trace-2',
        spanId: 'span-2',
        limit: 10,
      }),
    ).resolves.toEqual([expect.objectContaining({ id: 'other-span' })]);
    await expect(
      harness!.listWorkspaceActionJournalEntries({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        spanId: 'span-2',
        limit: 10,
      }),
    ).rejects.toThrow('spanId filter requires traceId');
    await expect(
      harness!.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({
          id: 'invalid-span',
          spanId: 'span-without-trace',
        }),
      ),
    ).rejects.toThrow('spanId requires traceId');
  });

  it('widens existing workspace action journal tables with observability columns', async () => {
    const schemaName = `pf_593_workspace_actions_${randomUUID().replaceAll('-', '_')}`;
    await store.db.none(`CREATE SCHEMA "${schemaName}"`);
    try {
      await store.db.none(`CREATE TABLE "${schemaName}"."${TABLE_HARNESS_WORKSPACE_ACTIONS}" (
        id TEXT NOT NULL,
        harness_name TEXT NOT NULL,
        session_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        action_kind TEXT NOT NULL,
        operation TEXT,
        action JSONB NOT NULL,
        policy_decision TEXT NOT NULL,
        policy_reasons JSONB NOT NULL,
        matched_rules JSONB NOT NULL,
        path JSONB,
        to_path JSONB,
        cwd JSONB,
        actor JSONB,
        request_id TEXT,
        result JSONB,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (harness_name, session_id, id)
      )`);
      const harness = new HarnessPG({ client: store.db, schemaName });
      await harness.init();
      await harness.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
      await expect(
        harness.appendWorkspaceActionJournalEntry(
          sampleWorkspaceActionJournalEntry({
            id: 'with-span',
            traceId: 'trace-1',
            spanId: 'span-1',
          }),
        ),
      ).resolves.toEqual({ created: true });
      await expect(
        harness.listWorkspaceActionJournalEntries({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          traceId: 'trace-1',
          limit: 10,
        }),
      ).resolves.toEqual([expect.objectContaining({ id: 'with-span', spanId: 'span-1' })]);
    } finally {
      await store.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  it('filters workspace action journal rows by request and affected path', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });

    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'write-readme',
        requestId: 'turn-1',
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/README.md',
          relativePath: 'README.md',
        },
        action: { kind: 'file', operation: 'write', path: 'README.md' },
        createdAt: 1000,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'rename-source',
        requestId: 'turn-1',
        operation: 'rename',
        action: { kind: 'file', operation: 'rename', path: 'src/old.ts', toPath: 'src/new.ts' },
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/src/old.ts',
          relativePath: 'src/old.ts',
        },
        toPath: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/src/new.ts',
          relativePath: 'src/new.ts',
        },
        createdAt: 1100,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'write-docs-readme',
        requestId: 'turn-2',
        path: {
          rootId: 'project',
          rootPath: '/workspace',
          path: '/workspace/docs/README.md',
          relativePath: 'docs/README.md',
        },
        action: { kind: 'file', operation: 'write', path: 'docs/README.md' },
        createdAt: 1200,
      }),
    );
    await harness!.appendWorkspaceActionJournalEntry(
      sampleWorkspaceActionJournalEntry({
        id: 'run-command',
        requestId: 'turn-1',
        actionKind: 'command',
        operation: 'run',
        action: { kind: 'command', operation: 'run', command: 'pnpm test' },
        path: undefined,
        createdAt: 1300,
      }),
    );

    type HarnessJournalListInput = Parameters<NonNullable<typeof harness>['listWorkspaceActionJournalEntries']>[0];
    const listIds = async (overrides: Partial<HarnessJournalListInput>): Promise<string[]> =>
      (
        await harness!.listWorkspaceActionJournalEntries({
          sessionId: 'session-1',
          resourceId: 'resource-1',
          limit: 10,
          ...overrides,
        })
      ).map(entry => entry.id);

    await expect(listIds({ requestId: 'turn-1' })).resolves.toEqual(['write-readme', 'rename-source', 'run-command']);
    await expect(listIds({ requestId: 'turn-2', affectedPath: { relativePath: 'docs/README.md' } })).resolves.toEqual([
      'write-docs-readme',
    ]);
    await expect(listIds({ affectedPath: { rootId: 'project', relativePath: 'README.md' } })).resolves.toEqual([
      'write-readme',
    ]);
    await expect(listIds({ affectedPath: { path: '/workspace/src/old.ts' } })).resolves.toEqual(['rename-source']);
    await expect(listIds({ affectedPath: { relativePath: 'src/new.ts' } })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: { relativePath: 'src/new.ts', includeToPath: true } })).resolves.toEqual([
      'rename-source',
    ]);
    await expect(listIds({ affectedPath: { rootId: 'other', relativePath: 'README.md' } })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: {} })).resolves.toEqual([]);
    await expect(listIds({ affectedPath: { includeToPath: true } })).resolves.toEqual([]);
  });

  it('ignores duplicate or mismatched workspace action journal appends and deletes rows with the session', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(createSampleSessionRecord({ closedAt: 2000, lastActivityAt: 2000 }), {
      ownerId: 'h-1',
      ifVersion: 0,
    });

    await expect(
      harness!.appendWorkspaceActionJournalEntry(sampleWorkspaceActionJournalEntry({ id: 'entry-1' })),
    ).resolves.toEqual({ created: true });
    await expect(
      harness!.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'entry-1', result: { status: 'changed' } }),
      ),
    ).resolves.toEqual({ created: false });
    await expect(
      harness!.appendWorkspaceActionJournalEntry(
        sampleWorkspaceActionJournalEntry({ id: 'wrong-resource', resourceId: 'other-resource' }),
      ),
    ).resolves.toEqual({ created: false });

    await expect(
      harness!.listWorkspaceActionJournalEntries({ sessionId: 'session-1', resourceId: 'resource-1', limit: 10 }),
    ).resolves.toEqual([expect.objectContaining({ id: 'entry-1', result: { status: 'ok' } })]);

    const closed = await harness!.loadSession({ sessionId: 'session-1' });
    if (!closed) throw new Error('expected closed session');
    await harness!.deleteSession({
      sessionId: 'session-1',
      ifVersion: closed.version,
      expectedResourceId: closed.resourceId,
      expectedThreadId: closed.threadId,
      expectedParentSessionId: closed.parentSessionId ?? null,
      expectedCreatedAt: closed.createdAt,
      requireClosed: true,
    });

    await expect(
      harness!.listWorkspaceActionJournalEntries({ sessionId: 'session-1', resourceId: 'resource-1', limit: 10 }),
    ).resolves.toEqual([]);
  });

  it('round-trips subagentTypeId on the session record (M4)', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(
      createSampleSessionRecord({ subagentTypeId: 'scoped-worker', subagentToolAllowlistScoped: true }),
      { ownerId: 'h', ifVersion: 0 },
    );
    const loaded = await harness!.loadSession({ sessionId: 'session-1' });
    expect(loaded?.subagentTypeId).toBe('scoped-worker');
    expect(loaded?.subagentToolAllowlistScoped).toBe(true);

    // A record without the field round-trips as undefined (legacy / top-level).
    await harness!.saveSession(createSampleSessionRecord({ id: 'session-2', threadId: 'thread-2' }), {
      ownerId: 'h',
      ifVersion: 0,
    });
    const topLevel = await harness!.loadSession({ sessionId: 'session-2' });
    expect(topLevel?.subagentTypeId).toBeUndefined();
    expect(topLevel?.subagentToolAllowlistScoped).toBeUndefined();
  });

  it('round-trips every restart-critical session field', async () => {
    const harness = store.stores.harness!;
    const record = createSampleSessionRecord({
      subagentTypeId: 'critic',
      subagentToolAllowlistScoped: true,
      permissionRulesSeedHash: 'seed-hash-v1',
      currentRun: {
        runId: 'run-1',
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        agentId: 'critic-agent',
        operation: { kind: 'signal', signalId: 'signal-1' },
        modeId: 'build',
        modelId: 'claude-opus-4-7',
        status: 'waiting',
        startedAt: 1000,
        updatedAt: 1100,
      },
      assistantDrafts: {
        'run-1': {
          runId: 'run-1',
          sessionId: 'session-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          text: 'durable partial answer',
          status: 'streaming',
          startedAt: 1000,
          updatedAt: 1100,
        },
      },
      cancelRequest: {
        requestedAt: 1200,
        reason: 'operator-stop',
        requestedBy: 'conformance-test',
      },
    });

    await harness.saveSession(record, { ownerId: 'h', ifVersion: 0 });

    await expect(harness.loadSession({ sessionId: record.id })).resolves.toMatchObject({
      subagentTypeId: record.subagentTypeId,
      subagentToolAllowlistScoped: true,
      permissionRulesSeedHash: record.permissionRulesSeedHash,
      currentRun: record.currentRun,
      assistantDrafts: record.assistantDrafts,
      cancelRequest: record.cancelRequest,
    });
  });

  it('keyset-pages exact due pending generations and round-trips finalizing/tombstone state', async () => {
    const harness = store.stores.harness!;
    const pendingSession = (
      id: string,
      expiresAt: number,
      pendingOverrides: Partial<NonNullable<SessionRecord['pendingResume']>> = {},
      sessionOverrides: Partial<SessionRecord> = {},
    ) =>
      createSampleSessionRecord({
        id,
        resourceId: `resource-${id}`,
        threadId: `thread-${id}`,
        pendingResume: {
          kind: 'tool-approval',
          itemId: `item-${id}`,
          runId: `run-${id}`,
          toolCallId: `tool-call-${id}`,
          source: 'parent',
          requestedAt: 10,
          expiresAt,
          ...pendingOverrides,
        },
        ...sessionOverrides,
      });

    for (const record of [
      pendingSession('due-a', 100),
      pendingSession('due-b', 100),
      pendingSession(
        'finalizing',
        200,
        { expiryStartedAt: 201 },
        {
          expiredPendingInteractions: {
            old: {
              generationKey: 'old',
              itemId: 'old-item',
              kind: 'question',
              runId: 'old-run',
              toolCallId: 'old-tool',
              requestedAt: 1,
              expiresAt: 2,
              expiredAt: 3,
              error: { code: 'harness.pending_interaction_expired', message: 'expired' },
            },
          },
        },
      ),
      pendingSession('recovering', 1_000, { resumedAt: 50, resumeRecoveryAt: 150 }),
      pendingSession('future', 201),
      pendingSession('resumed', 50, { resumedAt: 51 }),
      pendingSession('closed', 50, {}, { closedAt: 60 }),
      createSampleSessionRecord({
        id: 'cleared',
        resourceId: 'resource-cleared',
        threadId: 'thread-cleared',
      }),
    ]) {
      await harness.saveSession(record, { ownerId: 'owner', ifVersion: 0 });
    }

    const first = await harness.listDuePendingInteractions({ now: 200, limit: 2 });
    expect(first.items.map(item => item.sessionId)).toEqual(['due-a', 'due-b']);
    expect(first.nextCursor).toEqual({ dueAt: 100, sessionId: 'due-b' });
    await expect(harness.listDuePendingInteractions({ now: 200, limit: 2, cursor: first.nextCursor })).resolves.toEqual(
      {
        items: [
          expect.objectContaining({
            sessionId: 'recovering',
            dueAt: 150,
            expiresAt: 1_000,
            resumedAt: 50,
            resumeRecoveryAt: 150,
          }),
          expect.objectContaining({ sessionId: 'finalizing', dueAt: 200, expiresAt: 200, expiryStartedAt: 201 }),
        ],
      },
    );
    await expect(harness.loadSession({ sessionId: 'finalizing' })).resolves.toMatchObject({
      pendingResume: { expiresAt: 200, expiryStartedAt: 201 },
      expiredPendingInteractions: { old: { generationKey: 'old', expiredAt: 3 } },
    });
  });

  it('round-trips run summaries with idempotent first-write-wins + keyset listing (span-summary)', async () => {
    const harness = store.stores.harness!;
    const mk = (runId: string, completedAt: number, over: Record<string, unknown> = {}) => ({
      harnessName: 'default',
      runId,
      sessionId: 'session-rs',
      resourceId: 'u1',
      threadId: 'thread-rs',
      agentId: 'agent-x',
      modeId: 'default',
      modelId: 'openai/gpt-4o-mini',
      status: 'completed' as const,
      finishReason: 'complete',
      reconstructed: false,
      startedAt: completedAt - 10,
      completedAt,
      durationMs: 10,
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      toolRollup: {
        count: 1,
        errors: 0,
        totalDurationMs: 4,
        maxDurationMs: 4,
        perTool: { lookup: { count: 1, errors: 0, totalDurationMs: 4 } },
      },
      createdAt: completedAt,
      ...over,
    });

    const saved = await harness.saveRunSummary({ summary: mk('rs-1', 100) as any });
    expect(saved.durationMs).toBe(10);
    // Idempotent: a later write for the same runId is a no-op.
    const again = await harness.saveRunSummary({
      summary: mk('rs-1', 100, { durationMs: 999, status: 'failed' }) as any,
    });
    expect(again.durationMs).toBe(10);
    expect(again.status).toBe('completed');

    const loaded = await harness.loadRunSummary({ runId: 'rs-1' });
    expect(loaded?.toolRollup?.perTool.lookup?.count).toBe(1);
    expect(loaded?.usage.totalTokens).toBe(3);

    await harness.saveRunSummary({ summary: mk('rs-2', 200) as any });
    await harness.saveRunSummary({ summary: mk('rs-3', 300) as any });
    // Newest-first; composite keyset paging.
    const page1 = await harness.listRunSummaries({ sessionId: 'session-rs', limit: 2 });
    expect(page1.summaries.map(s => s.runId)).toEqual(['rs-3', 'rs-2']);
    expect(page1.nextBeforeCompletedAt).toBe(200);
    const page2 = await harness.listRunSummaries({
      sessionId: 'session-rs',
      limit: 2,
      beforeCompletedAt: page1.nextBeforeCompletedAt,
      beforeRunId: page1.nextBeforeRunId,
    });
    expect(page2.summaries.map(s => s.runId)).toEqual(['rs-1']);
    expect(page2.nextBeforeCompletedAt).toBeUndefined();

    // Tie boundary: two rows share completedAt=200 — paging with limit 1 must
    // return BOTH (no skip) thanks to the composite (completedAt, runId) cursor.
    await harness.saveRunSummary({ summary: mk('rs-2b', 200) as any });
    const seen: string[] = [];
    let cursorC: number | undefined;
    let cursorR: string | undefined;
    for (let i = 0; i < 10; i++) {
      const p = await harness.listRunSummaries({
        sessionId: 'session-rs',
        limit: 1,
        beforeCompletedAt: cursorC,
        beforeRunId: cursorR,
      });
      seen.push(...p.summaries.map(s => s.runId));
      if (p.nextBeforeCompletedAt === undefined) break;
      cursorC = p.nextBeforeCompletedAt;
      cursorR = p.nextBeforeRunId;
    }
    expect(seen).toEqual(['rs-3', 'rs-2b', 'rs-2', 'rs-1']);
  });

  it('keeps §15 attachment-reference admission atomic and delete-guarded', async () => {
    const harness = attachmentStore.stores.harness;
    expect(harness).toBeDefined();

    await harness!.dangerouslyClearAll();
    await harness!.createOrLoadActiveSession(createSampleSessionRecord(), {
      initialLease: { ownerId: 'h', ttlMs: 60_000 },
    });
    const initial = await harness!.loadSession({ sessionId: 'session-1' });
    if (!initial) throw new Error('expected session');

    await harness!.saveAttachment({
      sessionId: 'session-1',
      attachmentId: 'attachment-1',
      name: 'note.txt',
      mimeType: 'text/plain',
      source: 'preupload',
      data: new Uint8Array([1, 2, 3]),
    });
    await expect(
      harness!.saveSessionWithAttachmentReferences(
        { ...initial, state: { admitted: 'missing-ref' } },
        { ownerId: 'h', ifVersion: initial.version },
        [
          { sessionId: 'session-1', attachmentId: 'attachment-1', source: 'queued_item', sourceId: 'queued-valid' },
          { sessionId: 'session-1', attachmentId: 'missing', source: 'queued_item', sourceId: 'queued-missing' },
        ],
      ),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentUnavailableError);
    await expect(harness!.loadSession({ sessionId: 'session-1' })).resolves.toMatchObject({
      version: initial.version,
      state: {},
    });
    await expect(
      harness!.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual([]);

    const saved = await harness!.saveSessionWithAttachmentReferences(
      { ...initial, state: { admitted: 'queued-ref' } },
      { ownerId: 'h', ifVersion: initial.version },
      [{ sessionId: 'session-1', attachmentId: 'attachment-1', source: 'queued_item', sourceId: 'queued-1' }],
    );

    expect(saved.version).toBe(initial.version + 1);
    await expect(
      harness!.listAttachmentReferences({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toEqual([{ source: 'queued_item', sourceId: 'queued-1' }]);
    await expect(
      harness!.deleteAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).rejects.toBeInstanceOf(HarnessStorageAttachmentInUseError);
    await expect(
      harness!.loadAttachment({ sessionId: 'session-1', attachmentId: 'attachment-1' }),
    ).resolves.toMatchObject({
      name: 'note.txt',
      data: new Uint8Array([1, 2, 3]),
    });
  });

  it('stores message result evidence and blocks active admission behind delete fences', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    const terminalEvidence = {
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      signalId: 'signal-1',
      runId: 'run-1',
      modeId: 'mode-1',
      modelId: 'model-1',
      admissionId: 'admission-1',
      admissionHash: 'hash-1',
      status: 'completed' as const,
      result: { ok: true },
      createdAt: 1,
      updatedAt: 2,
    };
    await expect(harness!.writeMessageResultEvidence(terminalEvidence)).resolves.toEqual({
      created: true,
      applied: true,
    });
    await expect(harness!.writeMessageResultEvidence(terminalEvidence)).resolves.toMatchObject({
      created: false,
      applied: false,
      evidence: { status: 'completed', admissionId: 'admission-1' },
    });

    await expect(
      harness!.loadMessageResultEvidence({
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        signalId: 'signal-1',
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      runId: 'run-1',
      modeId: 'mode-1',
      modelId: 'model-1',
      result: { ok: true },
    });

    await harness!.withThreadDeleteFence({ threadId: 'thread-1', ownerId: 'deleter', ttlMs: 30_000 }, async () => {
      await expect(
        harness!.createOrLoadActiveSession(createSampleSessionRecord(), {
          initialLease: { ownerId: 'harness-worker', ttlMs: 30_000 },
        }),
      ).rejects.toBeInstanceOf(HarnessStorageThreadDeleteFenceConflictError);
    });
  });

  it('locks competing signal dispatch claims and migrates a legacy run row', async () => {
    const harness = store.stores.harness!;
    const pending = {
      harnessName: 'default',
      sessionId: 'session-cas',
      resourceId: 'resource-cas',
      threadId: 'thread-cas',
      signalId: 'signal-cas',
      admissionId: 'admission-cas',
      admissionHash: 'hash-cas',
      operationKind: 'signal' as const,
      status: 'pending' as const,
      dispatch: { state: 'reserved' as const },
      createdAt: 1000,
      updatedAt: 1000,
    };
    await harness.writeMessageResultEvidence(pending);
    const claim = (attemptId: string) =>
      harness.compareAndSwapSignalDispatch({
        harnessName: 'default',
        sessionId: pending.sessionId,
        resourceId: pending.resourceId,
        threadId: pending.threadId,
        signalId: pending.signalId,
        admissionId: pending.admissionId,
        admissionHash: pending.admissionHash,
        expected: { state: 'reserved' },
        next: {
          state: 'dispatching',
          attemptId,
          claimExpiresAt: 4000,
          delivery: 'idle',
          runId: 'run-cas',
        },
        updatedAt: 2000,
      });
    const competing = await Promise.all([claim('attempt-a'), claim('attempt-b')]);
    expect(competing.filter(result => result.applied)).toHaveLength(1);
    expect(competing.filter(result => !result.applied)).toHaveLength(1);

    await harness.writeMessageResultEvidence({
      ...pending,
      signalId: 'harness-channel-signal-legacy',
      admissionId: 'legacy-admission',
      runId: 'legacy-run',
      operationKind: undefined,
      dispatch: undefined,
    });
    await expect(
      harness.writeMessageResultEvidence({
        ...pending,
        signalId: 'harness-channel-signal-legacy',
        admissionId: 'legacy-admission',
        runId: 'legacy-run',
        operationKind: undefined,
        dispatch: undefined,
        status: 'completed',
        result: 'unfenced terminal',
      }),
    ).resolves.toMatchObject({ applied: false, evidence: { status: 'pending', runId: 'legacy-run' } });
    await expect(
      harness.compareAndSwapSignalDispatch({
        harnessName: 'default',
        sessionId: pending.sessionId,
        resourceId: pending.resourceId,
        threadId: pending.threadId,
        signalId: 'harness-channel-signal-legacy',
        admissionId: 'legacy-admission',
        admissionHash: pending.admissionHash,
        expected: {
          state: 'accepted',
          attemptId: 'legacy',
          delivery: 'active',
          runId: 'legacy-run',
          acceptedAt: 1000,
        },
        next: {
          state: 'dispatching',
          attemptId: 'recovery-attempt',
          claimExpiresAt: 5000,
          delivery: 'active',
          runId: 'legacy-run',
        },
        updatedAt: 3000,
      }),
    ).resolves.toMatchObject({
      applied: true,
      evidence: {
        runId: 'legacy-run',
        dispatch: { state: 'dispatching', attemptId: 'recovery-attempt' },
      },
    });
  });

  it('round-trips JSONB semantic dispatch CAS and fences terminal settlement by attempt', async () => {
    const harness = store.stores.harness!;
    const identity = {
      harnessName: 'default',
      sessionId: 'session-semantic-cas',
      resourceId: 'resource-semantic-cas',
      threadId: 'thread-semantic-cas',
      signalId: 'signal-semantic-cas',
      admissionId: 'admission-semantic-cas',
      admissionHash: 'hash-semantic-cas',
    };
    const dispatchingA = {
      state: 'dispatching' as const,
      attemptId: 'attempt-a',
      claimExpiresAt: 2000,
      delivery: 'idle' as const,
      runId: 'run-stable',
    };
    await harness.writeMessageResultEvidence({
      ...identity,
      status: 'pending',
      runId: dispatchingA.runId,
      operationKind: 'signal',
      dispatch: dispatchingA,
      createdAt: 1000,
      updatedAt: 1000,
    });
    const dispatchingB = { ...dispatchingA, attemptId: 'attempt-b', claimExpiresAt: 3000 };
    await expect(
      harness.compareAndSwapSignalDispatch({
        ...identity,
        expected: {
          runId: dispatchingA.runId,
          delivery: dispatchingA.delivery,
          claimExpiresAt: dispatchingA.claimExpiresAt,
          attemptId: dispatchingA.attemptId,
          state: 'dispatching',
        },
        next: dispatchingB,
        updatedAt: 2000,
      }),
    ).resolves.toMatchObject({ applied: true });
    const acceptedB = {
      state: 'accepted' as const,
      attemptId: dispatchingB.attemptId,
      delivery: dispatchingB.delivery,
      runId: dispatchingB.runId,
      acceptedAt: 4000,
    };
    await expect(
      harness.compareAndSwapSignalDispatch({ ...identity, expected: dispatchingB, next: acceptedB, updatedAt: 4000 }),
    ).resolves.toMatchObject({ applied: true });
    await expect(
      harness.writeMessageResultEvidence({
        ...identity,
        status: 'failed',
        error: { code: 'generic', message: 'must not overwrite accepted attempt' },
        createdAt: 1000,
        updatedAt: 4250,
      }),
    ).resolves.toMatchObject({ applied: false, evidence: { status: 'pending', dispatch: acceptedB } });
    await expect(
      harness.compareAndSwapSignalTerminal({
        ...identity,
        expected: acceptedB,
        terminal: { status: 'completed', signalId: identity.signalId, runId: 'different-run', result: 'invalid' },
        updatedAt: 4500,
      }),
    ).rejects.toThrow();
    await expect(
      harness.compareAndSwapSignalTerminal({
        ...identity,
        expected: dispatchingA,
        terminal: { status: 'completed', signalId: identity.signalId, runId: 'stale-run', result: 'stale' },
        updatedAt: 5000,
      }),
    ).resolves.toMatchObject({ applied: false, evidence: { status: 'pending', dispatch: acceptedB } });
    await expect(
      harness.compareAndSwapSignalTerminal({
        ...identity,
        expected: acceptedB,
        terminal: { status: 'completed', signalId: identity.signalId, runId: 'run-stable', result: 'winner' },
        updatedAt: 6000,
      }),
    ).resolves.toMatchObject({
      applied: true,
      evidence: { status: 'completed', runId: 'run-stable', result: 'winner', dispatch: acceptedB },
    });
    await expect(
      harness.writeMessageResultEvidence({
        ...identity,
        status: 'pending',
        dispatch: { state: 'reserved' },
        createdAt: 1000,
        updatedAt: 7000,
      }),
    ).resolves.toMatchObject({
      applied: false,
      evidence: { status: 'completed', runId: 'run-stable', result: 'winner', dispatch: acceptedB },
    });
  });

  it('applies exactly one of two competing unfenced terminal evidence writes', async () => {
    const harness = store.stores.harness!;
    const pending = {
      harnessName: 'default',
      sessionId: 'session-terminal-cas',
      resourceId: 'resource-terminal-cas',
      threadId: 'thread-terminal-cas',
      signalId: 'signal-terminal-cas',
      runId: 'run-terminal-cas',
      operationKind: 'message' as const,
      status: 'pending' as const,
      createdAt: 1000,
      updatedAt: 1000,
    };
    await harness.writeMessageResultEvidence(pending);
    const competing = await Promise.all([
      harness.writeMessageResultEvidence({
        ...pending,
        status: 'completed',
        result: { winner: 'completed' },
        updatedAt: 2000,
      }),
      harness.writeMessageResultEvidence({
        ...pending,
        status: 'failed',
        error: { code: 'failed', message: 'failed' },
        updatedAt: 2001,
      }),
    ]);
    expect(competing.filter(result => result.applied === true)).toHaveLength(1);
    expect(competing.filter(result => result.applied === false)).toHaveLength(1);
    const winner = await harness.loadMessageResultEvidence({
      sessionId: pending.sessionId,
      resourceId: pending.resourceId,
      threadId: pending.threadId,
      signalId: pending.signalId,
    });
    expect(['completed', 'failed']).toContain((winner as { status: string }).status);
    expect(competing.every(result => result.evidence?.status === (winner as { status: string }).status)).toBe(true);
  });

  it('settles and reloads completed and failed admitted messages after an adapter restart', async () => {
    const harness = store.stores.harness!;
    const terminals = [
      { status: 'completed' as const, result: { text: 'done' } },
      { status: 'failed' as const, error: { code: 'model_failed', message: 'model failed' } },
    ];

    for (const [index, terminal] of terminals.entries()) {
      const pending = {
        harnessName: 'default',
        sessionId: `session-message-restart-${index}`,
        resourceId: 'resource-1',
        threadId: `thread-message-restart-${index}`,
        signalId: `harness-message-${index}`,
        runId: `run-message-${index}`,
        admissionId: `admission-message-${index}`,
        admissionHash: `hash-message-${index}`,
        operationKind: 'message' as const,
        status: 'pending' as const,
        createdAt: 1000,
        updatedAt: 1000,
      };
      await harness.writeMessageResultEvidence(pending);
      await expect(
        harness.writeMessageResultEvidence({ ...pending, ...terminal, updatedAt: 2000 }),
      ).resolves.toMatchObject({ applied: true });

      const restartedStore = new PostgresStore({ ...TEST_CONFIG, id: `pg-harness-restart-${index}` });
      try {
        await restartedStore.init();
        await expect(
          restartedStore.stores.harness!.loadMessageResultEvidence({
            sessionId: pending.sessionId,
            resourceId: pending.resourceId,
            threadId: pending.threadId,
            signalId: pending.signalId,
          }),
        ).resolves.toMatchObject({ ...terminal, operationKind: 'message', runId: pending.runId });
      } finally {
        await restartedStore.close();
      }
    }
  });

  // §5.2a/§5.3/§5.5 cross-adapter parity (mirrors InMemoryHarness): closing a
  // session then resolving the SAME (resourceId, threadId) must surface the
  // CLOSED owner for reopen, not null and not a fresh active row.
  it('returns the closed current owner by thread for reopen (no fresh active row)', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(
      createSampleSessionRecord({ id: 'closed-owner', closedAt: 2000, lastActivityAt: 2000 }),
      { ownerId: 'h-1', ifVersion: 0 },
    );

    await expect(
      harness!.loadSessionByThread({ threadId: 'thread-1', resourceId: 'resource-1' }),
    ).resolves.toMatchObject({ id: 'closed-owner', closedAt: 2000 });

    const admitted = await harness!.createOrLoadActiveSession(
      createSampleSessionRecord({ id: 'would-be-fresh', lastActivityAt: 3000 }),
      { initialLease: { ownerId: 'h-2', ttlMs: 30_000 } },
    );
    expect(admitted).toMatchObject({
      created: false,
      leaseAcquired: false,
      record: expect.objectContaining({ id: 'closed-owner', closedAt: 2000 }),
    });
    await expect(harness!.loadSession({ sessionId: 'would-be-fresh' })).resolves.toBeNull();
  });

  // §4.5b cross-adapter parity (mirrors InMemoryHarness): a child admitted under
  // a CLOSING parent must surface the parent's closing window.
  it('carries the parent closing window on parent-unavailable (closing)', async () => {
    const harness = store.stores.harness;
    expect(harness).toBeDefined();

    await harness!.saveSession(
      createSampleSessionRecord({ id: 'closing-parent', closingAt: 5000, closeDeadlineAt: 9000, lastActivityAt: 5000 }),
      { ownerId: 'h-1', ifVersion: 0 },
    );

    await expect(
      harness!.createOrLoadActiveSession(
        createSampleSessionRecord({ id: 'child', threadId: 'child-thread', parentSessionId: 'closing-parent' }),
        { initialLease: { ownerId: 'h-2', ttlMs: 30_000 } },
      ),
    ).rejects.toMatchObject({
      name: 'HarnessStorageParentSessionUnavailableError',
      reason: 'closing',
      closingAt: 5000,
      closeDeadlineAt: 9000,
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

  it('replay state reflects single-epoch seq bounds unchanged', async () => {
    const harness = store.stores.harness;
    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch-1:1',
      epoch: 'epoch-1',
      sequence: 1,
      event: { type: 'app.event', id: 'harness-v1:epoch-1:1', timestamp: 1000 },
      emittedAt: 1000,
      storedAt: 1001,
    });
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch-1:2',
      epoch: 'epoch-1',
      sequence: 2,
      event: { type: 'app.event', id: 'harness-v1:epoch-1:2', timestamp: 1002 },
      emittedAt: 1002,
      storedAt: 1003,
    });

    await expect(
      harness!.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toEqual({ epoch: 'epoch-1', oldestSequence: 1, newestSequence: 2 });
  });

  it('collapses to null on a multi-epoch ledger, matching the authoritative in-memory adapter', async () => {
    // §10.5: replay state is anchored to the CURRENT in-memory Session
    // instance's epoch, which storage cannot observe. A multi-epoch ledger is
    // ambiguous, so storage returns null; the server then 412s the stale cursor
    // and the client recovers via the snapshot path. The in-memory reference
    // (packages/core/.../inmemory.ts: `if (epochs.size !== 1) return null;`)
    // returns null for the identical input, so pg MUST too.
    const harness = store.stores.harness;
    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch-prior:1',
      epoch: 'epoch-prior',
      sequence: 1,
      event: { type: 'agent_start', id: 'harness-v1:epoch-prior:1', timestamp: 1000 },
      emittedAt: 1000,
      storedAt: 1000,
    });
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch-prior:2',
      epoch: 'epoch-prior',
      sequence: 2,
      event: { type: 'agent_end', id: 'harness-v1:epoch-prior:2', timestamp: 1010 },
      emittedAt: 1010,
      storedAt: 1010,
    });
    // Fresh, chronologically-newest epoch after a rehydrate.
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:aFresh:0',
      epoch: 'aFresh',
      sequence: 0,
      event: { type: 'agent_start', id: 'harness-v1:aFresh:0', timestamp: 2000 },
      emittedAt: 2000,
      storedAt: 2000,
    });

    await expect(
      harness!.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();
  });

  it('still collapses to null when the prior epoch and fresh epoch share a stored_at millisecond', async () => {
    // Edge case: stored_at is `Date.now()` and same-ms cross-epoch collisions are
    // routine; a stored_at/sequence tiebreak could otherwise misidentify the
    // "newest" epoch. Collapsing to null is independent of stored_at ordering,
    // so the ambiguous ledger stays null regardless of the clock collision.
    const harness = store.stores.harness;
    await harness!.saveSession(createSampleSessionRecord(), { ownerId: 'h-1', ifVersion: 0 });
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:epoch-prior:5',
      epoch: 'epoch-prior',
      sequence: 5,
      event: { type: 'agent_end', id: 'harness-v1:epoch-prior:5', timestamp: 1500 },
      emittedAt: 1500,
      storedAt: 1500,
    });
    // Fresh epoch's seq-0 event lands in the SAME millisecond as the prior
    // epoch's higher-sequence row.
    await harness!.appendSessionEvent({
      harnessName: 'default',
      sessionId: 'session-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      eventId: 'harness-v1:aFresh:0',
      epoch: 'aFresh',
      sequence: 0,
      event: { type: 'agent_start', id: 'harness-v1:aFresh:0', timestamp: 1500 },
      emittedAt: 1500,
      storedAt: 1500,
    });

    await expect(
      harness!.getSessionEventReplayState({
        harnessName: 'default',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
      }),
    ).resolves.toBeNull();
  });
});

function sampleChannelBinding(overrides: Partial<ChannelBinding> = {}): ChannelBinding {
  return {
    id: 'binding-1',
    harnessName: 'default',
    channelId: 'support',
    providerId: 'slack',
    status: 'active',
    platform: 'slack',
    externalTenantId: 'T1',
    externalChannelId: 'C1',
    externalThreadId: 'th-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    sessionId: 'session-1',
    mode: 'per-user-resource',
    generation: 1,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('HarnessPG channel binding ledger (§5.1h / §14.1 / PF-824)', () => {
  const store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-channel-binding-test-store' });

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

  it('saves a binding and loads it back by external tuple', async () => {
    const harness = store.stores.harness!;
    const binding = sampleChannelBinding();
    await harness.saveChannelBinding(binding);

    const byId = await harness.loadChannelBinding({ bindingId: binding.id });
    expect(byId).toEqual(binding);

    const byExternal = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: 'T1',
      externalChannelId: 'C1',
      externalThreadId: 'th-1',
    });
    expect(byExternal).toEqual(binding);
  });

  it('excludes non-active rows from the external lookup', async () => {
    const harness = store.stores.harness!;
    await harness.saveChannelBinding(sampleChannelBinding({ id: 'fenced', status: 'replaced' }));

    const byExternal = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: 'T1',
      externalChannelId: 'C1',
      externalThreadId: 'th-1',
    });
    expect(byExternal).toBeNull();

    // The fenced row is still addressable by id.
    const byId = await harness.loadChannelBinding({ bindingId: 'fenced' });
    expect(byId?.status).toBe('replaced');
  });

  it('rejects a second active binding for the same tuple (§5.2h)', async () => {
    const harness = store.stores.harness!;
    await harness.saveChannelBinding(sampleChannelBinding({ id: 'first' }));

    await expect(harness.saveChannelBinding(sampleChannelBinding({ id: 'second' }))).rejects.toBeInstanceOf(
      HarnessStorageChannelBindingConflictError,
    );

    // The conflict names the holder of the active row.
    await harness
      .saveChannelBinding(sampleChannelBinding({ id: 'third' }))
      .catch((err: HarnessStorageChannelBindingConflictError) => {
        expect(err).toBeInstanceOf(HarnessStorageChannelBindingConflictError);
        expect(err.heldBy).toBe('first');
      });

    // Re-saving the SAME id (an in-place update) is always allowed.
    await expect(
      harness.saveChannelBinding(sampleChannelBinding({ id: 'first', lastInboundAt: 5000 })),
    ).resolves.toBeUndefined();
    const reloaded = await harness.loadChannelBinding({ bindingId: 'first' });
    expect(reloaded?.lastInboundAt).toBe(5000);
  });

  it('treats a missing optional external id as a sentinel match (§14.1)', async () => {
    const harness = store.stores.harness!;
    // Persist a binding with no tenant/channel id, then look it up with the same
    // omitted ids — the sentinel makes them collide, not SQL NULL semantics.
    const binding = sampleChannelBinding({
      id: 'no-optional',
      externalTenantId: undefined,
      externalChannelId: undefined,
    });
    await harness.saveChannelBinding(binding);

    const matched = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalThreadId: 'th-1',
    });
    expect(matched).toEqual(binding);

    // A second active binding with the same omitted optional ids still conflicts.
    await expect(
      harness.saveChannelBinding(
        sampleChannelBinding({ id: 'no-optional-2', externalTenantId: undefined, externalChannelId: undefined }),
      ),
    ).rejects.toBeInstanceOf(HarnessStorageChannelBindingConflictError);

    // Supplying a real tenant id is a DIFFERENT tuple, so it does not match/conflict.
    const distinct = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: 'T1',
      externalThreadId: 'th-1',
    });
    expect(distinct).toBeNull();
  });

  it('keeps an empty-string optional external id distinct from undefined (§14.1)', async () => {
    const harness = store.stores.harness!;
    // The out-of-band U+001F-prefixed sentinel (not '') means an EXPLICIT empty-string
    // tenant id round-trips faithfully and addresses a different tuple than an omitted
    // tenant id.
    const empty = sampleChannelBinding({ id: 'empty-tenant', externalTenantId: '', externalChannelId: '' });
    await harness.saveChannelBinding(empty);

    const reloaded = await harness.loadChannelBinding({ bindingId: 'empty-tenant' });
    expect(reloaded?.externalTenantId).toBe('');
    expect(reloaded?.externalChannelId).toBe('');

    // The empty-string tuple matches an empty-string lookup ...
    const matched = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: '',
      externalChannelId: '',
      externalThreadId: 'th-1',
    });
    expect(matched?.id).toBe('empty-tenant');

    // ... but an OMITTED optional id is a distinct tuple and must not collide.
    const omitted = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalThreadId: 'th-1',
    });
    expect(omitted).toBeNull();
  });

  it('a literal single-space external id does not alias the missing-optional-id sentinel (§14.1)', async () => {
    const harness = store.stores.harness!;
    // Binding A omits the optional external ids (sentinel-normalised).
    await harness.saveChannelBinding(
      sampleChannelBinding({ id: 'missing', externalTenantId: undefined, externalChannelId: undefined }),
    );
    // Binding B uses real single-space external ids — a DIFFERENT tuple that must
    // not alias the missing-id sentinel. Both active rows coexist (no conflict).
    await expect(
      harness.saveChannelBinding(sampleChannelBinding({ id: 'space', externalTenantId: ' ', externalChannelId: ' ' })),
    ).resolves.toBeUndefined();

    // The single-space tuple round-trips faithfully and resolves to its own binding.
    const space = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: ' ',
      externalChannelId: ' ',
      externalThreadId: 'th-1',
    });
    expect(space?.id).toBe('space');
    expect(space?.externalTenantId).toBe(' ');
    expect(space?.externalChannelId).toBe(' ');

    // The missing-id tuple resolves to the missing-id binding only — no aliasing.
    const missing = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalThreadId: 'th-1',
    });
    expect(missing?.id).toBe('missing');
  });

  it('advances inbound activity forward-only (§14.1)', async () => {
    const harness = store.stores.harness!;
    await harness.saveChannelBinding(sampleChannelBinding({ updatedAt: 1000 }));

    const forward = await harness.touchChannelBindingInbound({ bindingId: 'binding-1', at: 5000 });
    expect(forward?.lastInboundAt).toBe(5000);
    expect(forward?.updatedAt).toBe(5000);

    // An older ingress must NOT regress the marker.
    const backward = await harness.touchChannelBindingInbound({ bindingId: 'binding-1', at: 2000 });
    expect(backward?.lastInboundAt).toBe(5000);
    expect(backward?.updatedAt).toBe(5000);

    // A newer ingress advances it again.
    const newer = await harness.touchChannelBindingInbound({ bindingId: 'binding-1', at: 9000 });
    expect(newer?.lastInboundAt).toBe(9000);

    // Touching an unknown binding returns null.
    expect(await harness.touchChannelBindingInbound({ bindingId: 'missing', at: 1 })).toBeNull();
  });

  it('resolves idempotently and fences the prior active binding on replacement (§14.1)', async () => {
    const harness = store.stores.harness!;
    const first = await harness.resolveChannelBinding({ candidate: sampleChannelBinding({ id: 'gen-1' }) });
    expect(first).toEqual({ binding: expect.objectContaining({ id: 'gen-1', generation: 1 }), created: true });

    // No replacement: the existing active binding wins (idempotent), generation stays.
    const again = await harness.resolveChannelBinding({ candidate: sampleChannelBinding({ id: 'gen-1-dup' }) });
    expect(again.created).toBe(false);
    expect(again.binding.id).toBe('gen-1');

    // Replacement fences the prior active binding and bumps the generation.
    const replaced = await harness.resolveChannelBinding({
      candidate: sampleChannelBinding({ id: 'gen-2', updatedAt: 2000 }),
      replaceBindingId: 'gen-1',
    });
    expect(replaced.created).toBe(true);
    expect(replaced.binding.generation).toBe(2);
    expect(replaced.replacedBindingId).toBe('gen-1');

    const fenced = await harness.loadChannelBinding({ bindingId: 'gen-1' });
    expect(fenced?.status).toBe('replaced');
    expect(fenced?.replacedByBindingId).toBe('gen-2');

    // Exactly one active binding remains for the tuple.
    const active = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: 'T1',
      externalChannelId: 'C1',
      externalThreadId: 'th-1',
    });
    expect(active?.id).toBe('gen-2');
  });

  it('lists active bindings for a scope ordered by activity then id, with cursor paging (§14.8)', async () => {
    const harness = store.stores.harness!;
    await harness.saveChannelBinding(sampleChannelBinding({ id: 'a', externalThreadId: 'th-a', lastOutboundAt: 100 }));
    await harness.saveChannelBinding(sampleChannelBinding({ id: 'b', externalThreadId: 'th-b', lastOutboundAt: 300 }));
    await harness.saveChannelBinding(sampleChannelBinding({ id: 'c', externalThreadId: 'th-c', lastInboundAt: 200 }));

    const page1 = await harness.listActiveChannelBindingsForScope({ harnessName: 'default', limit: 2 });
    expect(page1.bindings.map(b => b.id)).toEqual(['b', 'c']);
    expect(page1.nextCursor).toBe('c');

    const page2 = await harness.listActiveChannelBindingsForScope({
      harnessName: 'default',
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.bindings.map(b => b.id)).toEqual(['a']);
    expect(page2.nextCursor).toBeUndefined();

    // An unknown cursor pages to the end of the set rather than restarting.
    const stale = await harness.listActiveChannelBindingsForScope({
      harnessName: 'default',
      limit: 2,
      cursor: 'ghost',
    });
    expect(stale.bindings).toEqual([]);
  });

  it('removes the binding on deleteSessions and frees the tuple for rebind', async () => {
    const harness = store.stores.harness!;
    await harness.saveSession(createSampleSessionRecord({ id: 'session-1' }), { ownerId: 'h-1', ifVersion: 0 });
    const seeded = await harness.loadSession({ sessionId: 'session-1' });
    if (!seeded) throw new Error('expected seeded session');
    await harness.saveChannelBinding(sampleChannelBinding({ sessionId: 'session-1' }));

    await harness.deleteSessions({
      sessions: [
        {
          sessionId: 'session-1',
          ifVersion: seeded.version,
          expectedResourceId: seeded.resourceId,
          expectedThreadId: seeded.threadId,
          expectedCreatedAt: seeded.createdAt,
        },
      ],
    });

    // The session-scoped binding is gone.
    expect(await harness.loadChannelBinding({ bindingId: 'binding-1' })).toBeNull();
    expect(await harness.listChannelBindingsForSession({ sessionId: 'session-1' })).toEqual([]);

    // The conversation tuple is free, so a replacement session can rebind it.
    await expect(
      harness.saveChannelBinding(sampleChannelBinding({ id: 'rebind', sessionId: 'session-2' })),
    ).resolves.toBeUndefined();
    const rebound = await harness.loadChannelBindingByExternal({
      harnessName: 'default',
      channelId: 'support',
      platform: 'slack',
      externalTenantId: 'T1',
      externalChannelId: 'C1',
      externalThreadId: 'th-1',
    });
    expect(rebound?.id).toBe('rebind');
  });
});

function sampleWorkspaceActionJournalEntry(
  overrides: Partial<WorkspaceActionJournalEntry> = {},
): WorkspaceActionJournalEntry {
  return {
    id: 'workspace-action-1',
    harnessName: 'default',
    sessionId: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    actionKind: 'file',
    operation: 'write',
    action: { kind: 'file', operation: 'write', path: 'notes.md' },
    policyDecision: 'ask',
    policyReasons: ['workspace.default_ask'],
    matchedRules: [],
    path: {
      rootId: 'project',
      rootPath: '/workspace',
      path: '/workspace/notes.md',
      relativePath: 'notes.md',
    },
    actor: { type: 'user', id: 'user-1' },
    requestId: 'request-1',
    result: { status: 'ok' },
    createdAt: 1000,
    ...overrides,
  };
}

function sampleProviderCallbackBinding(
  overrides: Partial<HarnessProviderCallbackBinding> = {},
): HarnessProviderCallbackBinding {
  return {
    id: 'callback-binding-1',
    providerId: 'slack',
    selectorKind: 'installation',
    selectorValue: 'installation-1',
    harnessName: 'default',
    channelId: 'support',
    origin: { route: 'support-events' },
    status: 'active',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('HarnessPG provider callback binding ledger (§5.1i)', () => {
  const store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-provider-callback-binding-test-store' });

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

  it('dedupes exact active selector bindings and creates the active-selector indexes', async () => {
    const harness = store.stores.harness!;

    await expect(harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding())).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      binding: { id: 'callback-binding-1', status: 'active' },
    });
    await expect(
      harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding({ id: 'callback-binding-retry' })),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      binding: { id: 'callback-binding-1' },
    });

    const indexes = await store.db.manyOrNone<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1)
       ORDER BY indexname`,
      [['idx_harness_provider_callback_active_selector', 'idx_harness_provider_callback_selector_status']],
    );
    expect(indexes.map(row => row.indexname)).toEqual([
      'idx_harness_provider_callback_active_selector',
      'idx_harness_provider_callback_selector_status',
    ]);
    // The active-selector index is a PARTIAL UNIQUE index (WHERE status = 'active').
    const activeSelectorDef = indexes.find(
      row => row.indexname === 'idx_harness_provider_callback_active_selector',
    )?.indexdef;
    expect(activeSelectorDef).toMatch(/UNIQUE INDEX/i);
    expect(activeSelectorDef).toMatch(/WHERE.*status.*=.*'active'/i);
  });

  it('reports same selector with a different target as a conflict without retargeting', async () => {
    const harness = store.stores.harness!;
    await harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      harness.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          channelId: 'sales',
          origin: { route: 'sales-events' },
        }),
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: true,
      binding: { id: 'callback-binding-1', channelId: 'support' },
    });
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', channelId: 'support' });
  });

  it('replaces active selector bindings and keeps replaced rows terminal', async () => {
    const harness = store.stores.harness!;
    await harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding(), {
        replaceBindingId: 'callback-binding-1',
      }),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      harness.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-disabled',
          status: 'disabled',
          harnessName: 'support-disabled',
          channelId: 'support-disabled',
          createdAt: 1500,
          updatedAt: 1500,
          origin: { route: 'support-events-disabled' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', status: 'active' });
    await expect(
      harness.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          harnessName: 'support-v2',
          channelId: 'support-v2',
          createdAt: 2000,
          updatedAt: 2000,
          origin: { route: 'support-events-v2' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).resolves.toMatchObject({
      duplicate: false,
      conflict: false,
      replacedBindingId: 'callback-binding-1',
      binding: { id: 'callback-binding-2', harnessName: 'support-v2', status: 'active' },
    });
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-2' });
    await expect(
      harness.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          harnessName: 'support-v2',
          channelId: 'support-v2',
          createdAt: 2000,
          updatedAt: 2000,
          origin: { route: 'support-events-v2' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).resolves.toMatchObject({
      duplicate: true,
      conflict: false,
      replacedBindingId: 'callback-binding-1',
      binding: { id: 'callback-binding-2', status: 'active' },
    });
    await expect(
      harness.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
  });

  it('rejects replacement retries when the previous owner was not replaced by the duplicate id', async () => {
    const harness = store.stores.harness!;
    await harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding());
    const stalledReplacement = sampleProviderCallbackBinding({
      id: 'callback-binding-2',
      status: 'disabled',
      harnessName: 'support-v2',
      channelId: 'support-v2',
      createdAt: 2000,
      updatedAt: 2000,
      origin: { route: 'support-events-v2' },
    });
    // Seed a disabled row with the would-be replacement id that the replacement target
    // never transitioned to (replaced_by_binding_id stays NULL), so the unique-conflict
    // resolver must refuse to treat the retry as an idempotent success.
    await store.db.none(
      `INSERT INTO ${TABLE_HARNESS_PROVIDER_CALLBACK_BINDINGS}
            (id, provider_id, selector_kind, selector_value, harness_name, channel_id, origin, status,
             created_at, updated_at, replaced_at, replaced_by_binding_id, last_error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        stalledReplacement.id,
        stalledReplacement.providerId,
        stalledReplacement.selectorKind,
        stalledReplacement.selectorValue,
        stalledReplacement.harnessName,
        stalledReplacement.channelId,
        JSON.stringify(stalledReplacement.origin),
        stalledReplacement.status,
        stalledReplacement.createdAt,
        stalledReplacement.updatedAt,
        null,
        null,
        null,
      ],
    );

    await expect(
      harness.resolveProviderCallbackBinding(
        sampleProviderCallbackBinding({
          id: 'callback-binding-2',
          harnessName: 'support-v2',
          channelId: 'support-v2',
          createdAt: 2000,
          updatedAt: 2000,
          origin: { route: 'support-events-v2' },
        }),
        { replaceBindingId: 'callback-binding-1' },
      ),
    ).rejects.toBeInstanceOf(HarnessStorageProviderCallbackBindingTransitionError);
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toMatchObject({ id: 'callback-binding-1', status: 'active' });
  });

  it('round-trips provider binding JSON columns through mark transitions', async () => {
    const harness = store.stores.harness!;
    await harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding());
    await harness.markProviderCallbackBindingStatus({
      bindingId: 'callback-binding-1',
      status: 'undeliverable',
      updatedAt: 2000,
      lastError: { code: 'worker_unavailable', message: 'provider missing', retryable: true },
    });

    await expect(
      harness.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).resolves.toMatchObject({
      id: 'callback-binding-1',
      origin: { route: 'support-events' },
      status: 'active',
      lastError: undefined,
    });
  });

  it('allows disabled or undeliverable bindings to reactivate when no active selector owner exists', async () => {
    const harness = store.stores.harness!;
    await harness.resolveProviderCallbackBinding(sampleProviderCallbackBinding());

    await expect(
      harness.markProviderCallbackBindingStatus({
        bindingId: 'callback-binding-1',
        status: 'disabled',
        updatedAt: 2000,
        lastError: { code: 'worker_unavailable', message: 'provider disabled', retryable: true },
      }),
    ).resolves.toMatchObject({ status: 'disabled', lastError: { code: 'worker_unavailable' } });
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toBeNull();
    await expect(
      harness.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 3000 }),
    ).resolves.toMatchObject({ status: 'active', lastError: undefined });
    await expect(
      harness.markProviderCallbackBindingStatus({
        bindingId: 'callback-binding-1',
        status: 'undeliverable',
        updatedAt: 4000,
        lastError: { code: 'worker_unavailable', message: 'provider undeliverable', retryable: true },
      }),
    ).resolves.toMatchObject({ status: 'undeliverable', lastError: { code: 'worker_unavailable' } });
    await expect(
      harness.loadProviderCallbackBindingBySelector({
        providerId: 'slack',
        selectorKind: 'installation',
        selectorValue: 'installation-1',
      }),
    ).resolves.toBeNull();
    await expect(
      harness.markProviderCallbackBindingStatus({ bindingId: 'callback-binding-1', status: 'active', updatedAt: 5000 }),
    ).resolves.toMatchObject({ status: 'active', lastError: undefined });
  });
});

describe('HarnessPG renewSessionLeaseSubtree (§5.8 / PF-821)', () => {
  const store = new PostgresStore({ ...TEST_CONFIG, id: 'pg-harness-renew-subtree-test-store' });

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

  async function seedOwned(
    id: string,
    ownerId: string,
    parentSessionId?: string,
    overrides: Partial<Parameters<typeof createSampleSessionRecord>[0]> = {},
  ) {
    const harness = store.stores.harness!;
    await harness.saveSession(createSampleSessionRecord({ id, threadId: `t-${id}`, parentSessionId, ...overrides }), {
      ownerId,
      ifVersion: 0,
    });
    await harness.acquireSessionLease({ sessionId: id, ownerId, ttlMs: 60_000 });
  }

  it('atomically renews the root and every active descendant (incl. a grandchild) to one capped expiry', async () => {
    const harness = store.stores.harness!;
    await seedOwned('root', 'h-1');
    await seedOwned('child', 'h-1', 'root');
    await seedOwned('grandchild', 'h-1', 'child');

    const before = Date.now();
    const result = await harness.renewSessionLeaseSubtree({ rootSessionId: 'root', ownerId: 'h-1', ttlMs: 120_000 });
    // child + grandchild — the recursive CTE must descend past the first level.
    expect(result.renewedDescendantCount).toBe(2);

    for (const id of ['root', 'child', 'grandchild']) {
      const rec = await harness.loadSession({ sessionId: id });
      expect(rec?.leaseExpiresAt).toBeGreaterThanOrEqual(before + 120_000 - 5_000);
    }
  });

  it('skips closed descendants (no live lease) but still renews active ones', async () => {
    const harness = store.stores.harness!;
    await seedOwned('root', 'h-1');
    await seedOwned('open-child', 'h-1', 'root');
    // A closed descendant holds no live lease and must not be counted/renewed.
    await harness.saveSession(
      createSampleSessionRecord({
        id: 'closed-child',
        threadId: 't-closed',
        parentSessionId: 'root',
        closedAt: 5000,
        lastActivityAt: 5000,
      }),
      { ownerId: 'h-1', ifVersion: 0 },
    );

    const result = await harness.renewSessionLeaseSubtree({ rootSessionId: 'root', ownerId: 'h-1', ttlMs: 120_000 });
    expect(result.renewedDescendantCount).toBe(1);
  });

  it('fences and renews NOTHING when an active descendant is owned by another instance (§5.8 all-or-nothing)', async () => {
    const harness = store.stores.harness!;
    await seedOwned('root', 'h-1');
    await seedOwned('foreign-child', 'h-2', 'root'); // split subtree

    const rootBefore = await harness.loadSession({ sessionId: 'root' });
    await expect(
      harness.renewSessionLeaseSubtree({ rootSessionId: 'root', ownerId: 'h-1', ttlMs: 120_000 }),
    ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);

    // Root lease must be untouched — no parent-only partial commit.
    const rootAfter = await harness.loadSession({ sessionId: 'root' });
    expect(rootAfter?.leaseExpiresAt).toBe(rootBefore?.leaseExpiresAt);
  });

  it('throws SessionNotFound for an unknown root and LeaseConflict for a non-owned root', async () => {
    const harness = store.stores.harness!;
    await expect(
      harness.renewSessionLeaseSubtree({ rootSessionId: 'ghost', ownerId: 'h-1', ttlMs: 1000 }),
    ).rejects.toBeInstanceOf(HarnessStorageSessionNotFoundError);

    await seedOwned('root', 'h-2'); // owned by someone else
    await expect(
      harness.renewSessionLeaseSubtree({ rootSessionId: 'root', ownerId: 'h-1', ttlMs: 1000 }),
    ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
  });

  describe('plan tasks (§5.1k)', () => {
    const OWNER = 'plan-owner';

    async function setupSession(
      sessionId = 'plan-session',
      overrides: Partial<Parameters<typeof createSampleSessionRecord>[0]> = {},
    ): Promise<{ sessionId: string; version: number }> {
      const harness = store.stores.harness!;
      const record = createSampleSessionRecord({ id: sessionId, ...overrides });
      const res = await harness.createOrLoadActiveSession(record, {
        initialLease: { ownerId: OWNER, ttlMs: 30_000 },
      });
      return { sessionId, version: res.version };
    }

    function fence(sessionId: string, ifSessionVersion: number, owner = OWNER) {
      return { harnessName: 'default', sessionId, ownerId: owner, ifSessionVersion };
    }

    function sampleTask(sessionId: string, overrides: Partial<HarnessPlanTask> = {}): HarnessPlanTask {
      return {
        taskId: 'task-1',
        harnessName: 'default',
        sessionId,
        resourceId: 'resource-1',
        threadId: 'thread-1',
        order: 0,
        status: 'pending',
        statusSource: 'explicit',
        content: 'do the thing',
        createdAt: 1000,
        updatedAt: 1000,
        version: 0,
        ...overrides,
      };
    }

    it('creates a root task and lists it', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      const created = await harness.createPlanTask({ fence: fence(sessionId, version), task: sampleTask(sessionId) });
      expect(created).toMatchObject({ taskId: 'task-1', status: 'pending', version: 1, statusSource: 'explicit' });
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks).toHaveLength(1);
      expect(listed.tasks[0]).toMatchObject({ taskId: 'task-1', content: 'do the thing' });
    });

    it('createPlanTask is idempotent on idempotencyKey within a session', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      const a = await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, {
          taskId: 't-a',
          idempotencyKey: 'idem-1',
          idempotencyInputHash: 'request-hash-a',
          content: 'first',
        }),
      });
      const b = await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, {
          taskId: 't-b',
          idempotencyKey: 'idem-1',
          idempotencyInputHash: 'request-hash-b',
          content: 'second',
        }),
      });
      expect(b.taskId).toBe('t-a');
      expect(b.content).toBe('first');
      expect(b.idempotencyInputHash).toBe('request-hash-a');
      expect(b.version).toBe(a.version);
    });

    it('rejects keyed direct and batched creates without a non-empty immutable input hash', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      const missingHash = sampleTask(sessionId, { taskId: 'missing-hash', idempotencyKey: 'idem-missing' });
      const emptyHash = sampleTask(sessionId, {
        taskId: 'empty-hash',
        idempotencyKey: 'idem-empty',
        idempotencyInputHash: '',
      });

      await expect(harness.createPlanTask({ fence: fence(sessionId, version), task: missingHash })).rejects.toThrow(
        /idempotencyInputHash must be a non-empty string/,
      );
      await expect(harness.createPlanTask({ fence: fence(sessionId, version), task: emptyHash })).rejects.toThrow(
        /idempotencyInputHash must be a non-empty string/,
      );
      await expect(
        harness.mutatePlanTasksForSession({
          fence: fence(sessionId, version),
          ops: [{ kind: 'create', task: missingHash }],
        }),
      ).rejects.toThrow(/idempotencyInputHash must be a non-empty string/);

      await expect(harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 })).resolves.toEqual({
        tasks: [],
      });
    });

    it('preserves key-only replay for a pre-hash task after the row mutates', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      const legacy = await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, {
          taskId: 'legacy-task',
          idempotencyKey: 'legacy-key',
          idempotencyInputHash: 'legacy-seed-hash',
          content: 'legacy input',
        }),
      });
      await store.db.none(
        `UPDATE ${TABLE_HARNESS_PLAN_TASKS}
         SET idempotency_input_hash = NULL
         WHERE harness_name = $1 AND session_id = $2 AND task_id = $3`,
        ['default', sessionId, legacy.taskId],
      );
      const mutated = await harness.updatePlanTask({
        fence: fence(sessionId, version),
        taskId: legacy.taskId,
        ifVersion: legacy.version,
        patch: { content: 'mutated after creation', priority: 9 },
      });

      const replay = await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, {
          taskId: 'retry-task',
          idempotencyKey: 'legacy-key',
          idempotencyInputHash: 'new-client-hash',
          content: 'different retry input',
        }),
      });

      expect(replay).toMatchObject({
        taskId: legacy.taskId,
        content: 'mutated after creation',
        priority: 9,
        version: mutated.version,
      });
      expect(replay.idempotencyInputHash).toBeUndefined();
    });

    it('updatePlanTask advances the per-row version and applies the patch', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({ fence: fence(sessionId, version), task: sampleTask(sessionId) });
      const r1 = await harness.updatePlanTask({
        fence: fence(sessionId, version),
        taskId: 'task-1',
        ifVersion: 1,
        patch: { status: 'in_progress', activeForm: 'doing it', startedAt: 4000, completedAt: 5000, blockedBy: ['x'] },
      });
      expect(r1.version).toBe(2);
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks[0]).toMatchObject({
        status: 'in_progress',
        activeForm: 'doing it',
        startedAt: 4000,
        completedAt: 5000,
        blockedBy: ['x'],
        version: 2,
      });
    });

    it('updatePlanTask rejects a stale per-row version', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({ fence: fence(sessionId, version), task: sampleTask(sessionId) });
      await expect(
        harness.updatePlanTask({
          fence: fence(sessionId, version),
          taskId: 'task-1',
          ifVersion: 99,
          patch: { status: 'completed' },
        }),
      ).rejects.toBeInstanceOf(HarnessStoragePlanTaskVersionConflictError);
    });

    it('updatePlanTask throws not-found for an unknown task', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await expect(
        harness.updatePlanTask({ fence: fence(sessionId, version), taskId: 'nope', ifVersion: 1, patch: {} }),
      ).rejects.toBeInstanceOf(HarnessStoragePlanTaskNotFoundError);
    });

    it('the session-owner fence rejects a wrong ownerId', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await expect(
        harness.createPlanTask({ fence: fence(sessionId, version, 'someone-else'), task: sampleTask(sessionId) }),
      ).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
    });

    it('rejects every plan-task mutator after the owner lease expires', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'existing' }),
      });
      await harness.renewSessionLease({ sessionId, ownerId: OWNER, ttlMs: -1 });

      const expiredFence = fence(sessionId, version);
      const writes = [
        () =>
          harness.createPlanTask({
            fence: expiredFence,
            task: sampleTask(sessionId, { taskId: 'new' }),
          }),
        () =>
          harness.updatePlanTask({
            fence: expiredFence,
            taskId: 'existing',
            ifVersion: 1,
            patch: { status: 'completed' },
          }),
        () => harness.deletePlanTaskSubtree({ fence: expiredFence, rootTaskId: 'existing' }),
        () =>
          harness.mutatePlanTasksForSession({
            fence: expiredFence,
            ops: [{ kind: 'update', taskId: 'existing', ifVersion: 1, patch: { status: 'completed' } }],
          }),
      ];

      for (const write of writes) {
        await expect(write()).rejects.toBeInstanceOf(HarnessStorageLeaseConflictError);
      }
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks).toEqual([expect.objectContaining({ taskId: 'existing', status: 'pending', version: 1 })]);
    });

    it('the session-owner fence rejects a stale session version', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await expect(
        harness.createPlanTask({ fence: fence(sessionId, version + 5), task: sampleTask(sessionId) }),
      ).rejects.toBeInstanceOf(HarnessStorageVersionConflictError);
    });

    it('the session-owner fence throws not-found for an unknown session', async () => {
      const harness = store.stores.harness!;
      await expect(
        harness.createPlanTask({ fence: fence('ghost', 1), task: sampleTask('ghost') }),
      ).rejects.toBeInstanceOf(HarnessStorageSessionNotFoundError);
    });

    it('listPlanTasks paginates and orders by (parentTaskId, order)', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'r1', order: 1 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'r0', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'c1', parentTaskId: 'r0', order: 1 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'c0', parentTaskId: 'r0', order: 0 }),
      });

      const page1 = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 2 });
      expect(page1.tasks.map(t => t.taskId)).toEqual(['r0', 'r1']);
      expect(page1.cursor).toBeDefined();
      const page2 = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 2, cursor: page1.cursor });
      expect(page2.tasks.map(t => t.taskId)).toEqual(['c0', 'c1']);
      expect(page2.cursor).toBeUndefined();
    });

    it('listPlanTasks keyset-continues even when the cursor row was deleted between pages', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      for (let i = 0; i < 4; i++) {
        await harness.createPlanTask({
          fence: fence(sessionId, version),
          task: sampleTask(sessionId, { taskId: `r${i}`, order: i }),
        });
      }
      const page1 = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 2 });
      expect(page1.tasks.map(t => t.taskId)).toEqual(['r0', 'r1']);
      // Delete the cursor's own row before the next page — keyset continues at r2
      // (cross-adapter parity with the in-memory adapter).
      await harness.deletePlanTaskSubtree({ fence: fence(sessionId, version), rootTaskId: 'r1' });
      const page2 = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 2, cursor: page1.cursor });
      expect(page2.tasks.map(t => t.taskId)).toEqual(['r2', 'r3']);
    });

    it('listPlanTasks isolates by session', async () => {
      const harness = store.stores.harness!;
      const a = await setupSession('sess-a', { threadId: 'thread-a' });
      const b = await setupSession('sess-b', { threadId: 'thread-b' });
      await harness.createPlanTask({
        fence: fence(a.sessionId, a.version),
        task: sampleTask(a.sessionId, { taskId: 'ta' }),
      });
      await harness.createPlanTask({
        fence: fence(b.sessionId, b.version),
        task: sampleTask(b.sessionId, { taskId: 'tb' }),
      });
      const listedA = await harness.listPlanTasks({ harnessName: 'default', sessionId: a.sessionId, limit: 10 });
      expect(listedA.tasks.map(t => t.taskId)).toEqual(['ta']);
    });

    it('deletePlanTaskSubtree cascades to all descendants (recursive CTE)', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'root' }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'a', parentTaskId: 'root', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'b', parentTaskId: 'a', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'c', parentTaskId: 'root', order: 1 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'd', order: 9 }),
      });

      const res = await harness.deletePlanTaskSubtree({ fence: fence(sessionId, version), rootTaskId: 'root' });
      expect(res.deletedCount).toBe(4);
      const remaining = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(remaining.tasks.map(t => t.taskId)).toEqual(['d']);
    });

    it('deletePlanTaskSubtree terminates on a parentTaskId cycle (UNION guard)', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'x', parentTaskId: 'y' }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'y', parentTaskId: 'x' }),
      });
      const res = await harness.deletePlanTaskSubtree({ fence: fence(sessionId, version), rootTaskId: 'x' });
      expect(res.deletedCount).toBe(2);
      const remaining = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(remaining.tasks).toHaveLength(0);
    });

    it('mutatePlanTasksForSession applies multi-row ops atomically', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'p', order: 0 }),
      });
      await harness.mutatePlanTasksForSession({
        fence: fence(sessionId, version),
        ops: [
          { kind: 'create', task: sampleTask(sessionId, { taskId: 'c1', parentTaskId: 'p', order: 0 }) },
          { kind: 'create', task: sampleTask(sessionId, { taskId: 'c2', parentTaskId: 'p', order: 1 }) },
          { kind: 'update', taskId: 'p', ifVersion: 1, patch: { status: 'in_progress' } },
        ],
      });
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks.map(t => t.taskId)).toEqual(['p', 'c1', 'c2']);
      expect(listed.tasks.find(t => t.taskId === 'p')).toMatchObject({ status: 'in_progress', version: 2 });
    });

    it('mutatePlanTasksForSession rejects all ops when one op conflicts (transaction rollback)', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'p', order: 0 }),
      });
      await expect(
        harness.mutatePlanTasksForSession({
          fence: fence(sessionId, version),
          ops: [
            { kind: 'create', task: sampleTask(sessionId, { taskId: 'new', order: 5 }) },
            { kind: 'update', taskId: 'p', ifVersion: 99, patch: { status: 'completed' } },
          ],
        }),
      ).rejects.toBeInstanceOf(HarnessStoragePlanTaskVersionConflictError);
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks.map(t => t.taskId)).toEqual(['p']);
    });

    it('loadPlanTaskSubtree returns a bounded next-N subtree honoring depth + status', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'root', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'a', parentTaskId: 'root', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'b', parentTaskId: 'a', order: 0 }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'c', parentTaskId: 'root', order: 1, status: 'completed' }),
      });

      const d1 = await harness.loadPlanTaskSubtree({
        harnessName: 'default',
        sessionId,
        rootTaskId: 'root',
        depth: 1,
        limit: 10,
      });
      expect(d1.tasks.map(t => t.taskId)).toEqual(['root', 'a', 'c']);
      expect(d1.truncated).toBe(false);

      const completed = await harness.loadPlanTaskSubtree({
        harnessName: 'default',
        sessionId,
        status: 'completed',
        limit: 10,
      });
      expect(completed.tasks.map(t => t.taskId)).toEqual(['c']);

      const limited = await harness.loadPlanTaskSubtree({
        harnessName: 'default',
        sessionId,
        rootTaskId: 'root',
        limit: 2,
      });
      expect(limited.tasks).toHaveLength(2);
      expect(limited.truncated).toBe(true);
    });

    it('session delete cascades plan tasks (§5.2g)', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      await harness.createPlanTask({ fence: fence(sessionId, version), task: sampleTask(sessionId, { taskId: 't1' }) });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 't2', parentTaskId: 't1' }),
      });
      await harness.deleteSession({ harnessName: 'default', sessionId });
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks).toHaveLength(0);
    });

    it('countPlanTasksByStatus aggregates by status and counts roots + orphans', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      // Two real roots (one with a child) + an orphan whose parent is unresolvable.
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'r1', order: 0, status: 'in_progress' }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'r2', order: 1, status: 'pending' }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'c1', parentTaskId: 'r1', order: 0, status: 'completed' }),
      });
      await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'orphan', parentTaskId: 'missing', order: 2, status: 'pending' }),
      });

      const counts = await harness.countPlanTasksByStatus({ harnessName: 'default', sessionId });
      expect(counts.total).toBe(4);
      // The orphan's parent is not in the set, so it counts as a root alongside r1/r2.
      expect(counts.rootCount).toBe(3);
      expect(counts.byStatus.in_progress).toBe(1);
      expect(counts.byStatus.pending).toBe(2);
      expect(counts.byStatus.completed).toBe(1);
    });

    it('round-trips the delegatedSubagentSessionId link (TM-6) through create, list, subtree, and update', async () => {
      const harness = store.stores.harness!;
      const { sessionId, version } = await setupSession();
      const created = await harness.createPlanTask({
        fence: fence(sessionId, version),
        task: sampleTask(sessionId, { taskId: 'd1', delegatedSubagentSessionId: 'sub-abc' }),
      });
      expect(created.delegatedSubagentSessionId).toBe('sub-abc');
      const listed = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(listed.tasks[0]!.delegatedSubagentSessionId).toBe('sub-abc');
      const sub = await harness.loadPlanTaskSubtree({
        harnessName: 'default',
        sessionId,
        rootTaskId: 'd1',
        depth: 0,
        limit: 10,
      });
      expect(sub.tasks[0]!.delegatedSubagentSessionId).toBe('sub-abc');
      await harness.updatePlanTask({
        fence: fence(sessionId, version),
        taskId: 'd1',
        ifVersion: created.version,
        patch: { delegatedSubagentSessionId: 'sub-xyz' },
      });
      const after = await harness.listPlanTasks({ harnessName: 'default', sessionId, limit: 10 });
      expect(after.tasks[0]!.delegatedSubagentSessionId).toBe('sub-xyz');
      // The updated link also hydrates through a subtree read (not just list).
      const afterSub = await harness.loadPlanTaskSubtree({
        harnessName: 'default',
        sessionId,
        rootTaskId: 'd1',
        depth: 0,
        limit: 10,
      });
      expect(afterSub.tasks[0]!.delegatedSubagentSessionId).toBe('sub-xyz');
    });
  });
});
