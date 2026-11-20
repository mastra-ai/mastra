import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { WorkItemsStorage } from './base.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const requireFrom = (pkg: string) => createRequire(import.meta.resolve(pkg));

// The query listDeferredDecisions sends for one card: the dispatcher's update fold and the
// intake tester both read a card's decisions this way.
const BY_CARD = `SELECT * FROM factory_deferred_decisions
  WHERE org_id = 'org-1' AND factory_project_id = 'project-1' AND work_item_id = 'card-1'
  ORDER BY created_at ASC`;

describe("reading one card's deferred decisions", () => {
  it('uses the work item index on libsql, not a scan of the project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deferred-index-'));
    onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
    const url = `file:${join(dir, 'factory.db')}`;
    const storage = new LibSQLFactoryStorage({ id: `deferred-index-${randomUUID()}`, url });
    storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    await storage.close();

    const { createClient } = requireFrom('@mastra/libsql')('@libsql/client') as typeof import('@libsql/client');
    const client = createClient({ url });
    onTestFinished(() => client.close());
    const plan = await client.execute(`EXPLAIN QUERY PLAN ${BY_CARD}`);
    const details = plan.rows.map(row => String(row.detail));
    expect(details.join('\n')).toContain('factory_deferred_decisions_tenant_work_item_idx');
  });

  it.runIf(postgresUrl)('uses the work item index on postgres', async () => {
    const storage = new PgFactoryStorage({ id: `deferred-index-${randomUUID()}`, connectionString: postgresUrl! });
    storage.registerDomain(new WorkItemsStorage());
    await storage.init();
    onTestFinished(() => storage.close());

    const { Client } = requireFrom('@mastra/pg')('pg') as typeof import('pg');
    const client = new Client({ connectionString: postgresUrl });
    await client.connect();
    onTestFinished(() => client.end());
    // An empty table is cheapest to scan; with scans off the planner names the index it can use.
    await client.query('SET enable_seqscan = off');
    const plan = await client.query<{ 'QUERY PLAN': string }>(`EXPLAIN ${BY_CARD}`);
    expect(plan.rows.map(row => row['QUERY PLAN']).join('\n')).toContain(
      'factory_deferred_decisions_tenant_work_item_idx',
    );
  });
});
