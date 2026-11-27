import { Knowledge, createKnowledgeImporterHost } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { PostgresStore, pgKnowledgeTransactionClient } from '../../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';

/**
 * A service host's `admit(tx)` writes its own claim row through the package's public
 * `pgKnowledgeTransactionClient`, in the run's start transaction: the claim commits with the run
 * when the start goes ahead, and rolls back with it when admission is refused or the start is
 * skipped.
 */
const connectionString = process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString;
const pool = new Pool({ connectionString });

afterAll(async () => {
  await pool.end();
});

let n = 0;
async function setup() {
  const schemaName = `knowledge_admit_claim_${process.pid}_${++n}`;
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  const claims = `"${schemaName}".host_claims`;
  await pool.query(`CREATE TABLE ${claims} (claim TEXT PRIMARY KEY)`);
  const knowledge = new Knowledge({
    scopes: { 'docs:$orgId': {} },
    storage: new PostgresStore({ id: 'admit-claim', pool, schemaName }),
  });
  const host = createKnowledgeImporterHost(knowledge, {
    leaseMs: 60_000,
    bindings: [{ id: 'b1', importer: 'notes', target: 'docs:acme#notion', settings: {}, credentials: {} }],
  });
  const claimed = async () => (await pool.query(`SELECT claim FROM ${claims} ORDER BY claim`)).rows.map(r => r.claim);
  const claim = (id: string) => async (tx: Parameters<typeof pgKnowledgeTransactionClient>[0]) => {
    await pgKnowledgeTransactionClient(tx).none(`INSERT INTO ${claims} (claim) VALUES ($1)`, [id]);
  };
  const drop = () => pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  return { knowledge, host, claimed, claim, drop };
}

describe('pgKnowledgeTransactionClient from @mastra/pg', () => {
  it('commits a claim written in admit with the run it starts', async () => {
    const t = await setup();
    try {
      const started = await t.host.startRun('b1', { admit: t.claim('c1') });
      expect(started.status).toBe('started');
      expect(await t.claimed()).toEqual(['c1']);
    } finally {
      await t.drop();
    }
  });

  it('rolls the claim back when admission refuses the start', async () => {
    const t = await setup();
    try {
      const refusal = new Error('claim expired');
      await expect(
        t.host.startRun('b1', {
          admit: async tx => {
            await t.claim('c1')(tx);
            throw refusal;
          },
        }),
      ).rejects.toBe(refusal);
      expect(await t.claimed()).toEqual([]);
    } finally {
      await t.drop();
    }
  });

  it('rolls the claim back when another run of the binding is going', async () => {
    const t = await setup();
    try {
      expect((await t.host.startRun('b1', { admit: t.claim('c1') })).status).toBe('started');
      expect((await t.host.startRun('b1', { admit: t.claim('c2') })).status).toBe('skipped');
      expect(await t.claimed()).toEqual(['c1']);
    } finally {
      await t.drop();
    }
  });

  it('commits a host row written in getStorage().transaction()', async () => {
    const t = await setup();
    try {
      const storage = await t.knowledge.getStorage();
      await storage.transaction(t.claim('c1'));
      expect(await t.claimed()).toEqual(['c1']);
    } finally {
      await t.drop();
    }
  });

  it('rolls a host row back with getStorage().transaction()', async () => {
    const t = await setup();
    try {
      const storage = await t.knowledge.getStorage();
      const failure = new Error('stop');
      await expect(
        storage.transaction(async tx => {
          await t.claim('c1')(tx);
          throw failure;
        }),
      ).rejects.toBe(failure);
      expect(await t.claimed()).toEqual([]);
    } finally {
      await t.drop();
    }
  });
});
