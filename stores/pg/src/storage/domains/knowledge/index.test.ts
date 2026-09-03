import { createKnowledgeStorageTests } from '@internal/storage-test-utils';
import { knowledgeImporterBindingKey, KnowledgeSchemaError, TABLE_KNOWLEDGE_SCHEMA } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from '../../client';
import { connectionString } from '../../test-utils';
import { getPgKnowledgeIsolationKey, KnowledgePG, postgresSql } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pool = new Pool({ connectionString });
const schemas: string[] = [];
let schemaCounter = 0;
let canonicalSchemaName: string | undefined;

createKnowledgeStorageTests(async () => {
  if (!canonicalSchemaName) {
    canonicalSchemaName = `knowledge_canonical_${process.pid}_${schemaCounter++}`;
    schemas.push(canonicalSchemaName);
    await pool.query(`CREATE SCHEMA "${canonicalSchemaName}"`);
  }
  return new KnowledgePG({ pool, schemaName: canonicalSchemaName });
});

afterAll(async () => {
  for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

describe('KnowledgePG schema completion marker', () => {
  it('writes the marker only after canonical initialization succeeds', async () => {
    const schemaName = `knowledge_marker_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await new KnowledgePG({ pool, schemaName }).init();

    const marker = await pool.query(
      `SELECT "version" FROM "${schemaName}"."${TABLE_KNOWLEDGE_SCHEMA}" WHERE id = 'canonical'`,
    );
    expect(marker.rows[0]?.version).toBe(1);
  });

  it('rejects a markerless partial schema without mutating it', async () => {
    const schemaName = `knowledge_partial_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    await pool.query(`CREATE TABLE "${schemaName}".mastra_knowledge_nodes (id TEXT PRIMARY KEY)`);

    await expect(new KnowledgePG({ pool, schemaName }).init()).rejects.toBeInstanceOf(KnowledgeSchemaError);
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name`,
      [schemaName],
    );
    expect(tables.rows.map(row => row.table_name)).toEqual(['mastra_knowledge_nodes']);
  });
});

describe('PostgreSQL knowledge SQL normalization', () => {
  it('quotes canonical camel-case identifiers without rewriting string literals', () => {
    expect(
      postgresSql(
        `SELECT nodeId,scopeNodeId FROM "mastra_knowledge_node_scopes" WHERE nodeId='nodeId' AND scopeNodeId=?`,
        'knowledge',
      ),
    ).toBe(
      `SELECT "nodeId","scopeNodeId" FROM "knowledge"."mastra_knowledge_node_scopes" WHERE "nodeId"='nodeId' AND "scopeNodeId"=$1`,
    );
  });
});

describe('KnowledgePG storage isolation', () => {
  it('identifies domains using the same pool and schema as one physical backend', () => {
    expect(new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgePG({ pool, schemaName: 'first' }).getStorageIsolationKey()).not.toBe(
      new KnowledgePG({ pool, schemaName: 'second' }).getStorageIsolationKey(),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('serializes concurrent grant reconciliation across clients', async () => {
    const schemaName = `knowledge_access_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const plan = {
      scopes: [
        { address: 'principal:shared', name: 'Shared principal' },
        {
          address: 'project:shared',
          name: 'Shared project',
          grants: [{ scopeRefAddress: 'principal:shared', role: 'edit' as const }],
        },
      ],
    };

    const [left, right] = await Promise.all([first.reconcileStructure(plan), second.reconcileStructure(plan)]);

    expect(left.scopes).toEqual(right.scopes);
    expect([left.changed, right.changed].sort()).toEqual([false, true]);
    expect(await first.getAccessEpoch()).toBe(1);
    expect(await second.getAccessEpoch()).toBe(1);
    expect(await second.listScopeGrants()).toEqual([
      {
        scopeNodeId: left.scopes['project:shared'],
        scopeRefId: left.scopes['principal:shared'],
        role: 'edit',
        canSuggest: undefined,
      },
    ]);

    const withRole = (role: 'append' | 'owner') => ({
      scopes: [
        { address: 'principal:shared', name: 'Shared principal' },
        {
          address: 'project:shared',
          name: 'Shared project',
          grants: [{ scopeRefAddress: 'principal:shared', role }],
        },
      ],
    });
    const [appendResult, ownerResult] = await Promise.all([
      first.reconcileStructure(withRole('append')),
      second.reconcileStructure(withRole('owner')),
    ]);
    const finalRole = appendResult.accessEpoch > ownerResult.accessEpoch ? 'append' : 'owner';
    expect([appendResult.accessEpoch, ownerResult.accessEpoch].sort()).toEqual([2, 3]);
    expect(await first.getAccessEpoch()).toBe(3);
    expect(await first.listScopeGrants()).toEqual([
      {
        scopeNodeId: left.scopes['project:shared'],
        scopeRefId: left.scopes['principal:shared'],
        role: finalRole,
        canSuggest: undefined,
      },
    ]);
  });

  it('claims one importer run and skips one overlapping cron enqueue across clients', async () => {
    const schemaName = `knowledge_import_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: 'project:mastra' });
    const enqueue = (store: KnowledgePG, id: string, triggerKind: 'webhook' | 'cron') =>
      store.enqueueImportRun({
        id,
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind,
        payloadKey: `payload/${id}`,
        payload: '{}',
        skipIfActiveCron: triggerKind === 'cron',
      });
    await enqueue(first, 'webhook-1', 'webhook');

    const claims = await Promise.all([
      first.claimImportRun({ importerId: 'calendar', binding, workerId: 'first', leaseKey: 'lease/' }),
      second.claimImportRun({ importerId: 'calendar', binding, workerId: 'second', leaseKey: 'lease/' }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.find(Boolean)).toMatchObject({ id: 'webhook-1' });

    const cronBinding = knowledgeImporterBindingKey({ source: 'calendar:cron', scope: 'project:mastra' });
    const enqueueCron = (store: KnowledgePG, id: string) =>
      store.enqueueImportRun({
        id,
        importerId: 'calendar',
        binding: cronBinding,
        importKind: 'static',
        triggerKind: 'cron',
        payloadKey: `payload/${id}`,
        payload: '{}',
        skipIfActiveCron: true,
      });
    const cronRuns = await Promise.all([enqueueCron(first, 'cron-1'), enqueueCron(second, 'cron-2')]);
    expect(cronRuns.map(run => run.status).sort()).toEqual(['queued', 'skipped']);
  });

  it('does not lock or starve a visible scope behind a disjoint outbox backlog', async () => {
    const schemaName = `knowledge_scoped_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    const firstScopeId = crypto.randomUUID();
    const secondScopeId = crypto.randomUUID();
    await first.createNode({ id: firstScopeId, name: 'First claim scope', isScope: true, scopeIds: [] });
    await first.createNode({ id: secondScopeId, name: 'Second claim scope', isScope: true, scopeIds: [] });
    for (let index = 0; index < 150; index++) {
      await first.createNode({ name: `Second hidden subject ${index}`, scopeIds: [secondScopeId] });
    }
    const firstSubject = await first.createNode({ name: 'First visible subject', scopeIds: [firstScopeId] });

    const [firstClaim, secondClaim] = await Promise.all([
      first.claimSemanticOutbox({ workerId: 'first-scope-worker', scopeIds: [firstScopeId], limit: 1 }),
      second.claimSemanticOutbox({ workerId: 'second-scope-worker', scopeIds: [secondScopeId], limit: 1 }),
    ]);

    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]?.documentId).toContain(firstSubject.id);
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0]?.scopeIds).toEqual([secondScopeId]);
  });

  it('claims each semantic outbox entry through only one concurrent worker', async () => {
    const schemaName = `knowledge_claim_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const first = new KnowledgePG({ pool, schemaName });
    const second = new KnowledgePG({ pool, schemaName });
    await first.init();
    await first.createNode({ name: 'Claim once', scopeIds: [] });

    const [firstClaim, secondClaim] = await Promise.all([
      first.claimSemanticOutbox({ workerId: 'first', limit: 1 }),
      second.claimSemanticOutbox({ workerId: 'second', limit: 1 }),
    ]);

    expect([...firstClaim, ...secondClaim]).toHaveLength(1);
  });
});
