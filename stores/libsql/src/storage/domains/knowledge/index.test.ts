import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';
import { knowledgeImporterBindingKey, KnowledgeSchemaError, TABLE_KNOWLEDGE_SCHEMA } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { getLibSQLKnowledgeIsolationKey, KnowledgeLibSQL } from '.';

createKnowledgeStorageTests(() => new KnowledgeLibSQL({ url: 'file::memory:?cache=shared' }));

describe('KnowledgeLibSQL schema completion marker', () => {
  it('writes the marker only after canonical initialization succeeds', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await new KnowledgeLibSQL({ client }).init();
      const marker = await client.execute(`SELECT version FROM ${TABLE_KNOWLEDGE_SCHEMA} WHERE id = 'canonical'`);
      expect(marker.rows[0]?.version).toBe(1);
    } finally {
      client.close();
    }
  });

  it('rejects a markerless partial schema without mutating it', async () => {
    const client = createClient({ url: ':memory:' });
    try {
      await client.execute('CREATE TABLE mastra_knowledge_nodes (id TEXT PRIMARY KEY)');
      await expect(new KnowledgeLibSQL({ client }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
      const tables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'mastra_knowledge_%' ORDER BY name",
      );
      expect(tables.rows.map(row => row.name)).toEqual(['mastra_knowledge_nodes']);
    } finally {
      client.close();
    }
  });
});

describe('KnowledgeLibSQL semantic outbox claims', () => {
  it('claims each entry through only one client', async () => {
    const path = join(tmpdir(), `mastra-knowledge-outbox-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const scopeId = randomUUID();
      await first.createNode({ id: scopeId, name: 'Claim scope', isScope: true, scopeIds: [] });
      await first.createNode({ name: 'Claim subject', scopeIds: [scopeId] });

      const now = new Date();
      const [firstClaim, secondClaim] = await Promise.all([
        first.claimSemanticOutbox({ workerId: 'worker-1', now }),
        second.claimSemanticOutbox({ workerId: 'worker-2', now }),
      ]);
      const claimedIds = [...firstClaim, ...secondClaim].map(entry => entry.id);
      expect(claimedIds.length).toBeGreaterThan(0);
      expect(new Set(claimedIds).size).toBe(claimedIds.length);
      expect([firstClaim.length, secondClaim.length].filter(count => count > 0)).toHaveLength(1);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL importer run claims', () => {
  it('claims a binding through one client and fences heartbeats and finalization by worker', async () => {
    const path = join(tmpdir(), `mastra-knowledge-import-claim-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
      await first.enqueueImportRun({
        id: 'run-1',
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: '__mastra_internal/import-payload/run-1',
        payload: '{"payload":{"event":"first"}}',
      });
      await first.enqueueImportRun({
        id: 'run-2',
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'webhook',
        payloadKey: '__mastra_internal/import-payload/run-2',
        payload: '{"payload":{"event":"second"}}',
      });

      const [firstClaim, secondClaim] = await Promise.all([
        first.claimImportRun({ importerId: 'calendar', binding, workerId: 'worker-1', leaseKey: 'lease/' }),
        second.claimImportRun({ importerId: 'calendar', binding, workerId: 'worker-2', leaseKey: 'lease/' }),
      ]);
      const claimed = firstClaim ?? secondClaim;
      const owner = firstClaim ? 'worker-1' : 'worker-2';
      const other = firstClaim ? 'worker-2' : 'worker-1';
      const ownerStore = firstClaim ? first : second;
      const otherStore = firstClaim ? second : first;
      expect(claimed).toMatchObject({ id: 'run-1', status: 'running' });
      expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1);
      await expect(
        otherStore.heartbeatImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: other,
          leaseKey: 'lease/run-1',
        }),
      ).resolves.toBe(false);
      await expect(
        otherStore.finalizeImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: other,
          leaseKey: 'lease/run-1',
          status: 'succeeded',
          state: [{ key: 'cursor', value: 'forged' }],
        }),
      ).resolves.toBeNull();
      await expect(
        ownerStore.finalizeImportRun({
          id: 'run-1',
          importerId: 'calendar',
          binding,
          workerId: owner,
          leaseKey: 'lease/run-1',
          status: 'succeeded',
          state: [{ key: 'cursor', value: 'first' }],
        }),
      ).resolves.toMatchObject({ status: 'succeeded' });
      await expect(
        otherStore.claimImportRun({ importerId: 'calendar', binding, workerId: other, leaseKey: 'lease/' }),
      ).resolves.toMatchObject({ id: 'run-2', status: 'running' });
      await expect(first.getImportState({ importerId: 'calendar', binding, key: 'cursor' })).resolves.toMatchObject({
        value: 'first',
      });
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });

  it('atomically skips overlapping cron enqueue across clients', async () => {
    const path = join(tmpdir(), `mastra-knowledge-import-cron-${randomUUID()}.db`);
    const url = `file:${path}`;
    const firstClient = createClient({ url });
    const secondClient = createClient({ url });
    try {
      const first = new KnowledgeLibSQL({ client: firstClient, storageIsolationKey: url });
      const second = new KnowledgeLibSQL({ client: secondClient, storageIsolationKey: url });
      await first.init();
      await second.init();
      const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
      const enqueue = (store: KnowledgeLibSQL, id: string) =>
        store.enqueueImportRun({
          id,
          importerId: 'calendar',
          binding,
          importKind: 'static',
          triggerKind: 'cron',
          payloadKey: `__mastra_internal/import-payload/${id}`,
          payload: '{}',
          skipIfActiveCron: true,
        });

      const runs = await Promise.all([enqueue(first, 'cron-1'), enqueue(second, 'cron-2')]);
      expect(runs.map(run => run.status).sort()).toEqual(['queued', 'skipped']);
    } finally {
      firstClient.close();
      secondClient.close();
      await rm(path, { force: true });
    }
  });
});

describe('KnowledgeLibSQL storage isolation', () => {
  it('identifies domains configured for the same URL as one physical backend', () => {
    expect(new KnowledgeLibSQL({ url: 'file:shared.db' }).getStorageIsolationKey()).toBe(
      new KnowledgeLibSQL({ url: 'file:./shared.db' }).getStorageIsolationKey(),
    );
    expect(getLibSQLKnowledgeIsolationKey({ url: 'file:///tmp/shared.db' })).toBe(
      getLibSQLKnowledgeIsolationKey({ url: 'file://localhost/tmp/shared.db' }),
    );
    expect(getLibSQLKnowledgeIsolationKey({ url: 'libsql://EXAMPLE.com/db?mode=ro' })).toBe(
      getLibSQLKnowledgeIsolationKey({ url: 'libsql://example.com:443/db' }),
    );
    expect(new KnowledgeLibSQL({ url: 'file:first.db' }).getStorageIsolationKey()).not.toBe(
      new KnowledgeLibSQL({ url: 'file:second.db' }).getStorageIsolationKey(),
    );

    const firstClient = createClient({ url: 'file:first-client.db' });
    const secondClient = createClient({ url: 'file:second-client.db' });
    try {
      expect(getLibSQLKnowledgeIsolationKey({ client: firstClient })).toBe(
        getLibSQLKnowledgeIsolationKey({ client: secondClient }),
      );
      expect(getLibSQLKnowledgeIsolationKey({ client: firstClient, storageIsolationKey: 'first' })).not.toBe(
        getLibSQLKnowledgeIsolationKey({ client: secondClient, storageIsolationKey: 'second' }),
      );
    } finally {
      firstClient.close();
      secondClient.close();
    }
  });
});
