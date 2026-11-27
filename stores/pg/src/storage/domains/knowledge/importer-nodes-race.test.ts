import { Knowledge, KnowledgeImporter, knowledgeImportKey } from '@mastra/core/knowledge';
import type { KnowledgeImporterContext, KnowledgeImporterOp, KnowledgeImportItem } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';

import { PgKnowledgeImporters } from './importers';
import { PgKnowledgePages } from './pages';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const pool = new Pool({ connectionString: process.env.KNOWLEDGE_PG_URL ?? defaultConnectionString });
const schemaName = `knowledge_importer_nodes_race_${process.pid}`;
afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await pool.end();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const upsert = (item: Partial<KnowledgeImportItem> & { sourceId: string }): KnowledgeImporterOp => ({
  op: 'upsert',
  item: { title: item.sourceId.toUpperCase(), body: `body of ${item.sourceId}`, ...item },
});

/**
 * A link renders only if its target's node is still this binding's after the render read the page
 * (r483 change 3): another binding's flush may take the target over and commit at any point of this
 * flush, and the run lock only fences this binding's own runs.
 */
describe('importer link targets are read when the link is rendered', () => {
  async function setup() {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schemaName}"`);
    const storage = new PostgresStore({ id: 'importer-nodes-race', pool, schemaName });
    const ops = new Map<string, KnowledgeImporterOp[]>();
    class Notes extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
      async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
        for (const op of ops.get(ctx.binding.id) ?? []) {
          if (op.op === 'upsert') await ctx.items.upsert(op.item);
        }
      }
    }
    const knowledge = new Knowledge({
      scopes: { 'docs:$orgId': {} },
      storage,
      importers: [new Notes({ id: 'a', target: 'docs:acme#a' }), new Notes({ id: 'b', target: 'docs:acme#y' })],
    });
    const run = (bindingId: string, next: KnowledgeImporterOp[]) => {
      ops.set(bindingId, next);
      return knowledge.importers!.run(bindingId);
    };
    const store = await knowledge.getStorage();
    const at = async (path: string) => {
      const [scope] = await store.getScopesByAddress(['docs:acme']);
      return store.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' });
    };

    // A imports u and s, B has its folder y, and a person moves A's page for s into y.
    expect(await run('a', [upsert({ sourceId: 'u' }), upsert({ sourceId: 's' })])).toMatchObject({
      outcome: 'succeeded',
    });
    expect(await run('b', [upsert({ sourceId: 'y0' })])).toMatchObject({ outcome: 'succeeded' });
    const s = (await at(`a/${knowledgeImportKey('s')}`))!;
    const y = (await at('y'))!;
    await store.movePage({ id: s.id, expectedVersion: s.version, parentId: y.id, provenance: { author: 'person' } });

    return { run, at, store };
  }

  /** Holds the first call `matches` lets through until `release()`; `paused` resolves when it arrives. */
  function gate() {
    let reached!: () => void;
    const paused = new Promise<void>(resolve => (reached = resolve));
    let release!: () => void;
    const open = new Promise<void>(resolve => (release = resolve));
    let held = false;
    const hold = async (matches: boolean) => {
      if (!matches || held) return;
      held = true;
      reached();
      await open;
    };
    return { paused, release, hold };
  }

  it("renders a link unresolved when another binding took its target over after this flush's earlier ops", async () => {
    const { run, at, store } = await setup();
    // A's next flush pauses once its first op is written, before the op that links to s.
    const { paused, release, hold } = gate();
    const getNode = PgKnowledgeImporters.prototype.getNode;
    vi.spyOn(PgKnowledgeImporters.prototype, 'getNode').mockImplementation(async function (
      this: PgKnowledgeImporters,
      bindingId: string,
      sourceId: string,
    ) {
      await hold(bindingId === 'a' && sourceId === 'l');
      return getNode.call(this, bindingId, sourceId);
    });
    const runA = run('a', [upsert({ sourceId: 'x' }), upsert({ sourceId: 'l', links: [{ sourceId: 's' }] })]);
    await paused;

    // B takes the page over at its own path, and commits, while A's flush is open.
    expect(await run('b', [upsert({ sourceId: 's' })])).toMatchObject({ outcome: 'succeeded' });
    expect(await store.importers!.getNode('a', 's')).toBeNull();
    release();

    expect(await runA).toMatchObject({ outcome: 'succeeded' });
    expect((await at(`a/${knowledgeImportKey('l')}`))?.body).toBe('body of l');
  });

  it('renders a link unresolved when another binding took its target over while the same render read an earlier target', async () => {
    const { run, at, store } = await setup();
    const u = (await at(`a/${knowledgeImportKey('u')}`))!;
    // A's render of l has read both targets' nodes and pauses on the first target's page.
    const { paused, release, hold } = gate();
    const getPage = PgKnowledgePages.prototype.getPage;
    vi.spyOn(PgKnowledgePages.prototype, 'getPage').mockImplementation(async function (
      this: PgKnowledgePages,
      input: Parameters<PgKnowledgePages['getPage']>[0],
    ) {
      await hold(input.id === u.id);
      return getPage.call(this, input);
    });
    const runA = run('a', [upsert({ sourceId: 'l', links: [{ sourceId: 'u' }, { sourceId: 's' }] })]);
    await paused;

    // B takes s's page over and commits before A reads it.
    expect(await run('b', [upsert({ sourceId: 's' })])).toMatchObject({ outcome: 'succeeded' });
    expect(await store.importers!.getNode('a', 's')).toBeNull();
    release();

    expect(await runA).toMatchObject({ outcome: 'succeeded' });
    expect((await at(`a/${knowledgeImportKey('l')}`))?.body).toBe(
      `body of l\n\nLinks:\n- [[docs:acme#a/${knowledgeImportKey('u')}]]`,
    );
  });
});
