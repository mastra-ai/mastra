import { createKnowledgeLegacyUpgradeTests, createKnowledgePageStoreTests } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PoolAdapter } from '../../client';
import type { DbClient } from '../../db';
import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';

import { getPgKnowledgeIsolationKey, KnowledgePG } from '.';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const pool = new Pool({ connectionString });
afterAll(async () => {
  await pool.end();
});

describe('KnowledgePG storage isolation', () => {
  it('lets PostgresStore callers override the isolation key', () => {
    const derived = new PostgresStore({ id: 'derived', pool, schemaName: 'shared' });
    const overridden = new PostgresStore({
      id: 'overridden',
      pool,
      schemaName: 'shared',
      storageIsolationKey: 'tenant-a',
    });

    expect(overridden.stores.knowledge!.getStorageIsolationKey()).toBe('tenant-a');
    expect(derived.stores.knowledge!.getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });

  it('identifies domains using the same pool and schema as one physical backend', () => {
    expect(new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ pool, schemaName: 'shared' }).getStorageIsolationKey(),
    );
    expect(new KnowledgePG({ pool, schemaName: 'first' }).getStorageIsolationKey()).not.toBe(
      new KnowledgePG({ pool, schemaName: 'second' }).getStorageIsolationKey(),
    );
  });

  it('canonicalizes equivalent connection forms', () => {
    expect(
      getPgKnowledgeIsolationKey({
        connectionString: 'postgresql://first:secret@EXAMPLE.com/knowledge?sslmode=require',
        schemaName: 'shared',
      }),
    ).toBe(
      getPgKnowledgeIsolationKey({
        host: 'example.com',
        port: 5432,
        database: 'knowledge',
        schemaName: 'shared',
      }),
    );
  });

  it('identifies pools that reach the same database through PG environment defaults', () => {
    const saved = { PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT, PGDATABASE: process.env.PGDATABASE };
    Object.assign(process.env, { PGHOST: 'db.internal', PGPORT: '6543', PGDATABASE: 'knowledge' });
    const first = new Pool();
    const second = new Pool();
    try {
      const key = getPgKnowledgeIsolationKey({ pool: first, schemaName: 'shared' });
      expect(key).toBe('pg:db.internal:6543/knowledge:schema:shared');
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'shared' })).toBe(key);
      expect(
        getPgKnowledgeIsolationKey({ host: 'DB.internal', port: 6543, database: 'knowledge', schemaName: 'shared' }),
      ).toBe(key);
      expect(getPgKnowledgeIsolationKey({ pool: second, schemaName: 'other' })).not.toBe(key);
    } finally {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      void first.end();
      void second.end();
    }
  });

  it('treats stores whose database cannot be determined as possibly shared', () => {
    const first = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    const second = { query: async () => ({ rows: [] }) } as unknown as DbClient;
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'shared' })).toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'shared' }),
    );
    expect(getPgKnowledgeIsolationKey({ client: first, schemaName: 'first' })).not.toBe(
      getPgKnowledgeIsolationKey({ client: second, schemaName: 'second' }),
    );
  });

  it('resolves separate client wrappers around the same pool', () => {
    expect(new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey()).toBe(
      new KnowledgePG({ client: new PoolAdapter(pool), schemaName: 'shared' }).getStorageIsolationKey(),
    );
  });
});

beforeAll(async () => {
  await pool.query('CREATE SCHEMA IF NOT EXISTS knowledge_contract_test');
});

createKnowledgePageStoreTests(() => new KnowledgePG({ pool, schemaName: 'knowledge_contract_test' }));

const LEGACY_SCHEMA = 'knowledge_legacy_test';
const legacyTable = (name: string) => `"${LEGACY_SCHEMA}"."${name}"`;
const legacyKnowledgeTables = async () =>
  (
    await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name LIKE 'mastra\\_knowledge\\_%'`,
      [LEGACY_SCHEMA],
    )
  ).rows.map(row => String(row.table_name));

createKnowledgeLegacyUpgradeTests({
  createStore: () => new KnowledgePG({ pool, schemaName: LEGACY_SCHEMA }),
  clear: async () => {
    await pool.query(`DROP SCHEMA IF EXISTS "${LEGACY_SCHEMA}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${LEGACY_SCHEMA}"`);
    await pool.query(`CREATE TABLE ${legacyTable('existing_domain')} (id text PRIMARY KEY)`);
    await pool.query(`INSERT INTO ${legacyTable('existing_domain')} VALUES ('preserved')`);
  },
  // The shape @mastra/pg 1.33.0 created, reduced to the columns, keys and references that matter here.
  createPublishedLayout: async ({ rows }) => {
    await pool.query(`CREATE TABLE ${legacyTable('mastra_knowledge_nodes')} (id text PRIMARY KEY, name text)`);
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_records')} (id text PRIMARY KEY, node text REFERENCES ${legacyTable('mastra_knowledge_nodes')} (id))`,
    );
    await pool.query(`CREATE TABLE ${legacyTable('mastra_knowledge_semantic_outbox')} (id text PRIMARY KEY)`);
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_mentions')} ("sourceType" text, "sourceId" text, "recordId" text, PRIMARY KEY ("recordId", "sourceId"))`,
    );
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_activity')} (id text PRIMARY KEY, action text, "recordType" text, "recordId" text)`,
    );
    await pool.query(
      `CREATE TABLE ${legacyTable('mastra_knowledge_access_state')} (id text PRIMARY KEY, epoch integer NOT NULL, "schemaVersion" integer NOT NULL)`,
    );
    if (!rows) return;
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_access_state')} VALUES ('knowledge', 1, 2)`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_nodes')} VALUES ('01LEGACY', 'Legacy')`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_records')} VALUES ('01REC', '01LEGACY')`);
    await pool.query(`INSERT INTO ${legacyTable('mastra_knowledge_mentions')} VALUES ('record', '01REC', '01REC')`);
    await pool.query(
      `INSERT INTO ${legacyTable('mastra_knowledge_activity')} VALUES ('01ACT', 'create', 'node', '01LEGACY')`,
    );
  },
  recreateLegacyTables: async () => {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_nodes')} (id text PRIMARY KEY, name text)`,
    );
    await pool.query(`CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_records')} (id text PRIMARY KEY)`);
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${legacyTable('mastra_knowledge_semantic_outbox')} (id text PRIMARY KEY)`,
    );
    await pool.query(
      `INSERT INTO ${legacyTable('mastra_knowledge_nodes')} VALUES ('01OLD', 'Old') ON CONFLICT DO NOTHING`,
    );
  },
  knowledgeTables: legacyKnowledgeTables,
  otherTableRows: async () =>
    Number((await pool.query(`SELECT COUNT(*) AS n FROM ${legacyTable('existing_domain')}`)).rows[0].n),
});
