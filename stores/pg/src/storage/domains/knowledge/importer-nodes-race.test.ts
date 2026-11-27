import { Knowledge, KnowledgeImporter, knowledgeImportKey } from '@mastra/core/knowledge';
import type { KnowledgeImporterContext, KnowledgeImporterOp, KnowledgeImportItem } from '@mastra/core/knowledge';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../../index';
import { connectionString as defaultConnectionString } from '../../test-utils';

import { PgKnowledgeImporters } from './importers';

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
 * A link is rendered from the target's node as it is when the link is rendered, not as it was when
 * the flush started (r483 change 3): another binding's flush may take the target over and commit in
 * between, and the run lock only fences this binding's own runs.
 */
describe('importer link targets are read when the link is rendered', () => {
  it("renders a link unresolved when another binding took its target over after this flush's earlier ops", async () => {
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

    // A imports s, B has its folder y, and a person moves A's page for s into y.
    expect(await run('a', [upsert({ sourceId: 's' })])).toMatchObject({ outcome: 'succeeded' });
    expect(await run('b', [upsert({ sourceId: 'y0' })])).toMatchObject({ outcome: 'succeeded' });
    const s = (await at(`a/${knowledgeImportKey('s')}`))!;
    const y = (await at('y'))!;
    await store.movePage({ id: s.id, expectedVersion: s.version, parentId: y.id, provenance: { author: 'person' } });

    // A's next flush pauses once its first op is written, before the op that links to s.
    let reached!: () => void;
    const paused = new Promise<void>(resolve => (reached = resolve));
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const getNode = PgKnowledgeImporters.prototype.getNode;
    vi.spyOn(PgKnowledgeImporters.prototype, 'getNode').mockImplementation(async function (
      this: PgKnowledgeImporters,
      bindingId: string,
      sourceId: string,
    ) {
      if (bindingId === 'a' && sourceId === 'l') {
        reached();
        await gate;
      }
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
});
