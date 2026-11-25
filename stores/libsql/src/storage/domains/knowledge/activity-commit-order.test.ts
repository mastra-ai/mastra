import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { afterAll, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';
import type { KnowledgeLibSQL } from './index';

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

it('upgrades an activity table from before feed positions, numbering its events in createdAt order', async () => {
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
  expect(events.map(event => event.pageId)).toEqual([early.id, late.id]);
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

  // The insert the pre-position store makes (its exact column list), from a clock behind.
  const raw = createClient({ url });
  await raw.execute({
    sql: `INSERT INTO "mastra_knowledge_activity" (id, action, scopeId, pageId, noteId, provenance, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      '01OLDWRITER0000000000000000',
      'page-updated',
      scope.id,
      x.id,
      null,
      JSON.stringify(alex),
      new Date(T - 50).toISOString(),
    ],
  });
  raw.close();

  const later = await a.listPageActivity({ read, since, order: 'asc', after: held });
  expect(later.events.map(event => event.id)).toEqual(['01OLDWRITER0000000000000000']);
  expect(later.events[0]!.position).toEqual(expect.any(String));
});

const domain = async (url: string, id: string) => {
  const storage = new LibSQLStore({ id, url });
  const knowledge = await new Knowledge({ storage, scopes }).getStorage();
  return { knowledge, domain: (await storage.getStore('knowledge')) as KnowledgeLibSQL };
};

it('refuses a position held from before clearAll, whose numbering starts again', async () => {
  const url = `file:${join(dir, 'clear.db')}`;
  const { knowledge, domain: store } = await domain(url, 'clear');
  const make = async (name: string) => {
    const { scope } = await knowledge.materializeScope({
      address: 'org:acme',
      declaration: 'org:$orgId',
      name: 'org:acme',
      provenance: alex,
    });
    return knowledge.createPage({ parentId: scope.id, name, provenance: alex });
  };
  await make('one');
  await make('two');
  const held = (await knowledge.listPageActivity({ read, order: 'asc' })).events.at(-1)!.position!;

  await store.dangerouslyClearAll();
  for (let i = 0; i < 5; i++) await make(`again ${i}`);
  await expect(knowledge.listPageActivity({ read, order: 'asc', after: held })).rejects.toThrow(
    /rebased.*restart from since/,
  );
  expect((await knowledge.listPageActivity({ read, order: 'asc' })).events.length).toBeGreaterThan(5);
});

it('after restoring an older database file: refuses a held position ahead of the feed, and after rebaseActivityFeed any old one', async () => {
  const path = join(dir, 'restore.db');
  const url = `file:${path}`;
  const { knowledge } = await domain(url, 'live');
  const { scope } = await knowledge.materializeScope({
    address: 'org:acme',
    declaration: 'org:$orgId',
    name: 'org:acme',
    provenance: alex,
  });
  await knowledge.createPage({ parentId: scope.id, name: 'in the backup', provenance: alex });
  const backup = createClient({ url });
  await backup.execute(`VACUUM INTO '${join(dir, 'restore.backup.db')}'`);
  backup.close();
  await knowledge.createPage({ parentId: scope.id, name: 'after the backup 1', provenance: alex });
  await knowledge.createPage({ parentId: scope.id, name: 'after the backup 2', provenance: alex });
  const held = (await knowledge.listPageActivity({ read, order: 'asc' })).events.at(-1)!.position!;

  for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });
  copyFileSync(join(dir, 'restore.backup.db'), path);
  const restored = await domain(url, 'restored');
  await expect(restored.knowledge.listPageActivity({ read, order: 'asc', after: held })).rejects.toThrow(
    /ahead of this feed/,
  );

  await restored.domain.rebaseActivityFeed();
  for (let i = 0; i < 4; i++) {
    await restored.knowledge.createPage({ parentId: scope.id, name: `after restore ${i}`, provenance: alex });
  }
  // Writes have passed the held number again: only the new incarnation tells it apart.
  await expect(restored.knowledge.listPageActivity({ read, order: 'asc', after: held })).rejects.toThrow(
    /rebased.*restart from since/,
  );
  const fresh = await restored.knowledge.listPageActivity({ read, order: 'asc' });
  expect(fresh.events.map(event => event.position)).not.toContain(held);
});
