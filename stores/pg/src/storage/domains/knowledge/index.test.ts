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

createKnowledgeStorageTests(async reopen => {
  const schemaName = reopen ? schemas.at(-1)! : `knowledge_canonical_${process.pid}_${schemaCounter++}`;
  if (!reopen) {
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
  }
  return new KnowledgePG({ pool, schemaName });
});

afterAll(async () => {
  for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

describe('KnowledgePG replacement rollback', () => {
  it.each(['second-page', 'outbox', 'commit'])('restores every Knowledge table after %s failure', async stage => {
    const schemaName = `knowledge_replacement_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const store = new KnowledgePG({ pool, schemaName });
    await store.init();
    const scopeId = '10000000-0000-4000-8000-000000000001';
    await store.createNode({ id: scopeId, name: 'Scope', isScope: true, scopeIds: [] });
    const node = await store.createNode({ name: 'Document', scopeIds: [scopeId] });
    await store.setNodeAddress({ source: 'importer', address: 'document:1', nodeId: node.id });
    for (let index = 0; index < 105; index++)
      await store.createRecord({
        id: `prior-${String(index).padStart(3, '0')}`,
        node,
        text: 'Original [[Existing link]]',
        source: 'curator',
        scopeIds: [scopeId],
        metadata: { sourceThreadId: 'original' },
      });
    const tables = await pool.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema=$1 ORDER BY table_name',
      [schemaName],
    );
    const snapshot = async () =>
      Promise.all(
        tables.rows.map(async ({ table_name }) => ({
          name: table_name,
          rows: (await pool.query(`SELECT * FROM "${schemaName}"."${table_name}" AS t ORDER BY row_to_json(t)::text`))
            .rows,
        })),
      );
    const before = await snapshot();
    await pool.query(
      `CREATE FUNCTION "${schemaName}".fail_replacement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected ${stage} failure'; END; $$`,
    );
    if (stage === 'second-page')
      await pool.query(
        `CREATE TRIGGER fail_page BEFORE UPDATE OF "deletedAt" ON "${schemaName}".mastra_knowledge_records FOR EACH ROW WHEN (NEW.id='prior-100') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    if (stage === 'outbox')
      await pool.query(
        `CREATE TRIGGER fail_outbox BEFORE INSERT ON "${schemaName}".mastra_knowledge_semantic_outbox FOR EACH ROW WHEN (NEW."documentId"='knowledge:record:replacement') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    if (stage === 'commit')
      await pool.query(
        `CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON "${schemaName}".mastra_knowledge_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.id='replacement') EXECUTE FUNCTION "${schemaName}".fail_replacement()`,
      );
    await expect(
      store.replaceNodeRecords({
        node: { id: node.id, version: node.version },
        record: {
          id: 'replacement',
          text: 'Replacement [[New link]]',
          source: 'curator',
          scopeIds: [scopeId],
          metadata: { sourceThreadId: 'new' },
        },
        visibilityScopeIds: [scopeId],
      }),
    ).rejects.toThrow(`injected ${stage} failure`);
    expect(await snapshot()).toEqual(before);
  });
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

    // Grant changes on an existing scope flow through the governed grant API; reconcile
    // seeds grants only when it creates the scope. Concurrent governed grant writes
    // serialize and advance one epoch each.
    const withRole = (role: 'append' | 'owner') => ({
      scopeNodeId: left.scopes['project:shared']!,
      scopeRefId: left.scopes['principal:shared']!,
      role,
    });
    const [appendResult, ownerResult] = await Promise.all([
      first.upsertScopeGrant(withRole('append')),
      second.upsertScopeGrant(withRole('owner')),
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

    // Re-materializing the seeded structure must not resurrect or re-impose the planned grant.
    const rematerialized = await first.reconcileStructure(plan);
    expect(rematerialized).toMatchObject({ changed: false, accessEpoch: 3 });
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

  it('keeps outbox reads bounded when stale scope stamps overlap the caller but current visibility fails', async () => {
    const schemaName = `knowledge_stale_outbox_${process.pid}_${schemaCounter++}`;
    schemas.push(schemaName);
    let queries = 0;
    const countingPool = new Proxy(pool, {
      get(target, prop) {
        if (prop === 'query') {
          const query = target.query.bind(target);
          return async (...args: Parameters<typeof query>) => {
            queries += 1;
            return query(...args);
          };
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const store = new KnowledgePG({ pool: countingPool, schemaName });
    await store.init();
    const callerScopeId = crypto.randomUUID();
    const hiddenScopeId = crypto.randomUUID();
    await store.createNode({ id: callerScopeId, name: 'Caller scope', isScope: true, scopeIds: [] });
    await store.createNode({ id: hiddenScopeId, name: 'Hidden scope', isScope: true, scopeIds: [] });

    // Stale-overlap backlog: rows stamped with the caller scope at enqueue
    // time whose nodes have since moved into the hidden scope — the SQL
    // visibility predicate must exclude them inside the bounded query.
    for (let index = 0; index < 50; index++) {
      const node = await store.createNode({ name: `Stale subject ${index}`, scopeIds: [callerScopeId] });
      await store.updateNode({ id: node.id, version: node.version, scopeIds: [hiddenScopeId] });
    }
    const mentionTarget = await store.createNode({ name: 'MentionTarget', scopeIds: [callerScopeId] });
    const owner = await store.createNode({ name: 'Record owner', scopeIds: [callerScopeId] });
    await store.createRecord({ node: owner.id, text: 'See [[MentionTarget]] for details.', scopeIds: [callerScopeId] });
    await store.updateNode({ id: mentionTarget.id, version: mentionTarget.version, scopeIds: [hiddenScopeId] });
    const visible = await store.createNode({ name: 'Visible subject', scopeIds: [callerScopeId] });

    // Visible to the caller: the two live upserts plus the reindex `delete`
    // entries (stamped with the caller scope at move time) — never a stale
    // upsert whose current scope state is hidden.
    queries = 0;
    const listed = await store.listSemanticOutbox({ scopeIds: [callerScopeId], limit: 200 });
    expect(listed).toHaveLength(53);
    for (const entry of listed) {
      if (entry.operation === 'upsert') {
        expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
      } else {
        expect(entry.operation).toBe('delete');
      }
    }
    expect(queries).toBe(1);

    queries = 0;
    const claimed = await store.claimSemanticOutbox({ workerId: 'stale-worker', scopeIds: [callerScopeId], limit: 5 });
    // reindex deletes queue behind their stale (filtered) upserts, so only the
    // two legitimate upserts are claimable — the stale backlog is never walked
    expect(claimed).toHaveLength(2);
    for (const entry of claimed) {
      expect(entry.operation).toBe('upsert');
      expect([visible.id, owner.id].some(id => entry.documentId.includes(id))).toBe(true);
    }
    // BEGIN, bounded SELECT, SKIP LOCKED lock, one claim UPDATE per row, COMMIT
    expect(queries).toBeLessThanOrEqual(10);
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
