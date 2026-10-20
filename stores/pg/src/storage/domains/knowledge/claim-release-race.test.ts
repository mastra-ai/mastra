import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { PoolAdapter } from '../../client';
import type { DbClient, TxClient } from '../../client';
import { connectionString } from '../../test-utils';
import { KnowledgePG } from './index';

/**
 * A release pauses mid-transaction while another importer claims the same target from a second connection.
 * Whatever order they land in, no claim may survive on a deleted record and no claimed membership may be dropped.
 */
const pool = new Pool({ connectionString });
afterAll(() => pool.end());

function pausingClient(pause: RegExp) {
  const base = new PoolAdapter(pool);
  let armed = false;
  let reached!: () => void;
  let resume!: () => void;
  const atPause = new Promise<void>(resolve => (reached = resolve));
  const released = new Promise<void>(resolve => (resume = resolve));
  const wrapTx = (tx: TxClient) =>
    new Proxy(tx, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (key !== 'query') return typeof value === 'function' ? value.bind(target) : value;
        return async (sql: string, values?: unknown[]) => {
          if (armed && pause.test(sql)) {
            armed = false;
            reached();
            await released;
          }
          return target.query(sql, values as never);
        };
      },
    });
  const client = new Proxy(base, {
    get(target, key) {
      if (key === 'tx') return <T>(cb: (tx: TxClient) => Promise<T>) => target.tx(tx => cb(wrapTx(tx)));
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as DbClient;
  return { client, arm: () => (armed = true), atPause, resume };
}

const claimant = (importerId: string, scope: string) => ({
  importerId,
  binding: JSON.stringify(['src', scope]),
  source: 'src',
});

describe('PG importer claims under a concurrent release', () => {
  const schemas: string[] = [];
  afterAll(async () => {
    for (const schema of schemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  it.each([
    ['node', /UPDATE .*mastra_knowledge_nodes.*SET version=version\+1/],
    ['record', /DELETE FROM .*mastra_knowledge_records/],
  ] as const)('keeps a concurrent %s claim consistent with the release', async (mode, pause) => {
    const schemaName = `claim_race_${mode}_${randomUUID().slice(0, 8)}`;
    schemas.push(schemaName);
    const gated = pausingClient(pause);
    const store = new KnowledgePG({ client: gated.client, schemaName });
    const other = new KnowledgePG({ pool, schemaName });
    await store.init();
    const [alpha, beta] = [randomUUID(), randomUUID()];
    for (const [id, name] of [
      [alpha, 'Alpha'],
      [beta, 'Beta'],
    ]) {
      await store.createNode({ id, name, isScope: true, scopeIds: [] });
    }
    const [a, b, c] = [claimant('a', 'project:a'), claimant('b', 'project:b'), claimant('c', 'project:c')];
    let node = await store.createNode({ name: 'Shared', scopeIds: [alpha], claimant: a });
    node = await store.setNodeScopes({ id: node.id, version: node.version, scopeIds: [beta], claimant: b });
    const record =
      mode === 'record'
        ? await store.createRecord({ node, text: 'Shared record', source: 'src', scopeIds: [alpha], claimant: a })
        : null;

    gated.arm();
    const release = record
      ? store.releaseRecordClaim({ id: record.id, version: record.version, claimant: a })
      : store.releaseImportClaims(a);
    await gated.atPause;
    const claim = (
      record
        ? other.claimRecord({ id: record.id, version: record.version, scopeIds: [alpha], claimant: c })
        : other.setNodeScopes({ id: node.id, version: node.version, scopeIds: [alpha], claimant: c })
    ).then(
      () => 'claimed' as const,
      (error: Error) => error,
    );
    // Give the claim time to commit first if nothing holds it back.
    await new Promise(resolve => setTimeout(resolve, 300));
    gated.resume();
    await release;
    const outcome = await claim;

    const targetId = record ? record.id : node.id;
    const claims = await other.listImportClaims({ targetType: record ? 'record' : 'node', targetId });
    if (record) {
      const current = await other.getRecord({ id: record.id });
      if (!current) expect(claims).toEqual([]);
      else {
        const scopes = await other.getRecordScopeIds(record.id);
        for (const held of claims) for (const id of held.scopeIds) expect(scopes).toContain(id);
      }
    } else {
      const scopes = await other.getNodeScopeIds(node.id);
      for (const held of claims) for (const id of held.scopeIds) expect(scopes).toContain(id);
    }
    // The claim either landed after the release or was refused because the target moved under it.
    if (outcome !== 'claimed') expect(outcome.name).toMatch(/Knowledge(Conflict|NotFound)Error/);
  });
});
