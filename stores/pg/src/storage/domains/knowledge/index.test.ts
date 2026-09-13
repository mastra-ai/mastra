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
