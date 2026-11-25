import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { afterAll, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';

const dir = mkdtempSync(join(tmpdir(), 'knowledge-commit-order-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const memory = knowledgeMemoryScopes();
const alex = { author: 'agent:alex' };
const scopes = {
  ...memory,
  'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'owner' as const }] },
};
const read = { addresses: ['org:acme'], prefixes: [], children: [] };
const T = Date.UTC(2031, 5, 1);

async function at<T>(ms: number, write: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
  try {
    return await write();
  } finally {
    vi.useRealTimers();
  }
}

const open = (url: string, id: string) => new Knowledge({ storage: new LibSQLStore({ id, url }), scopes }).getStorage();

it('a write from another client whose clock is behind still comes after a position the reader holds', async () => {
  const url = `file:${join(dir, 'skew.db')}`;
  const a = await open(url, 'a');
  const b = await open(url, 'b');
  const { scope } = await at(T - 60_000, () =>
    a.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'org:acme', provenance: alex }),
  );
  const since = new Date(T - 1000);

  const x = await at(T, () => a.createPage({ parentId: scope.id, name: 'from-a', provenance: alex }));
  const first = await a.listPageActivity({ read, since, order: 'asc' });
  expect(first.events.map(event => event.pageId)).toEqual([x.id]);

  // Client b's clock says T − 50 ms. Its write commits after the reader took its position.
  const y = await at(T - 50, () => b.createPage({ parentId: scope.id, name: 'from-b', provenance: alex }));
  const later = await a.listPageActivity({ read, since, order: 'asc', after: first.events[0]!.position });
  expect(later.events.map(event => event.pageId)).toEqual([y.id]);
  const all = await a.listPageActivity({ read, since, order: 'asc' });
  expect(all.events.map(event => event.pageId)).toEqual([x.id, y.id]);
});

it('upgrades an activity table from before feed positions, numbering its events in the order they were written', async () => {
  const url = `file:${join(dir, 'upgrade.db')}`;
  const a = await open(url, 'old');
  const { scope } = await at(T - 60_000, () =>
    a.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'org:acme', provenance: alex }),
  );
  const since = new Date(T - 1000);
  const late = await at(T, () => a.createPage({ parentId: scope.id, name: 'late clock', provenance: alex }));
  const early = await at(T - 500, () => a.createPage({ parentId: scope.id, name: 'early clock', provenance: alex }));
  // Back to the pre-position shape: no seq column, index or trigger.
  const raw = createClient({ url });
  await raw.execute('DROP TRIGGER trg_kactivity_seq');
  await raw.execute('DROP INDEX idx_kactivity_seq');
  await raw.execute('ALTER TABLE mastra_knowledge_activity DROP COLUMN seq');
  raw.close();

  const upgraded = await open(url, 'new');
  await open(url, 'again');
  const events = (await upgraded.listPageActivity({ read, since, order: 'asc' })).events;
  expect(events.map(event => event.pageId)).toEqual([late.id, early.id]);
  const next = await at(T + 1000, () =>
    upgraded.createPage({ parentId: scope.id, name: 'after upgrade', provenance: alex }),
  );
  const resumed = await upgraded.listPageActivity({ read, since, order: 'asc', after: events.at(-1)!.position });
  expect(resumed.events.map(event => event.pageId)).toEqual([next.id]);
});

it('numbers an event written by an older writer that leaves seq empty, after a position the reader holds', async () => {
  const url = `file:${join(dir, 'mixed.db')}`;
  const a = await open(url, 'new');
  const { scope } = await at(T - 60_000, () =>
    a.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'org:acme', provenance: alex }),
  );
  const since = new Date(T - 1000);
  const x = await at(T, () => a.createPage({ parentId: scope.id, name: 'from new writer', provenance: alex }));
  const held = (await a.listPageActivity({ read, since, order: 'asc' })).events.at(-1)!.position;

  // An older writer's insert: every column but seq, its clock behind.
  const raw = createClient({ url });
  await raw.execute({
    sql: `INSERT INTO mastra_knowledge_activity (id, action, scopeId, pageId, provenance, createdAt) VALUES (?, 'page-updated', ?, ?, ?, ?)`,
    args: ['01OLDWRITER0000000000000000', scope.id, x.id, JSON.stringify(alex), new Date(T - 50).toISOString()],
  });
  raw.close();

  const later = await a.listPageActivity({ read, since, order: 'asc', after: held });
  expect(later.events.map(event => event.id)).toEqual(['01OLDWRITER0000000000000000']);
  expect(later.events[0]!.position).toEqual(expect.any(String));
});
