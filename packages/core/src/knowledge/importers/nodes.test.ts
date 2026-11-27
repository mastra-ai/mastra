import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../storage';
import { InMemoryKnowledgeImportersStorage } from '../../storage/domains/knowledge/importers-inmemory';
import { Knowledge } from '../index';
import { KnowledgeImporter } from './define';
import type { KnowledgeImporterContext } from './define';
import type { KnowledgeImporterOp, KnowledgeImportItem } from './types';

/**
 * An item's link targets come from one `getNodes` call per render, not one `getNode` per link
 * (r483 change 3). A store that has only `getNode` still renders the same links.
 */

const upsert = (item: Partial<KnowledgeImportItem> & { sourceId: string }): KnowledgeImporterOp => ({
  op: 'upsert',
  item: { title: item.sourceId.toUpperCase(), body: `body of ${item.sourceId}`, ...item },
});

function setup() {
  let ops: KnowledgeImporterOp[] = [];
  const knowledge = new Knowledge({
    storage: new InMemoryStore(),
    scopes: { 'docs:$orgId': {} },
    importers: [
      new (class extends KnowledgeImporter({ id: 'notes', label: 'Notes' }) {
        async import(ctx: KnowledgeImporterContext<Record<string, never>, never>) {
          for (const op of ops) if (op.op === 'upsert') await ctx.items.upsert(op.item);
        }
      })({ id: 'b1', target: 'docs:acme#notion' }),
    ],
  });
  const run = (next: KnowledgeImporterOp[]) => {
    ops = next;
    return knowledge.importers!.run('b1');
  };
  const body = async (path: string) => {
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    return (await storage.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' }))?.body;
  };
  return { run, body };
}

const links = [{ sourceId: 'a' }, { sourceId: 'b', rel: 'see' }, { sourceId: 'missing' }];
const expected = 'body of l\n\nLinks:\n- [[docs:acme#notion/a]]\n- see: [[docs:acme#notion/b]]';

afterEach(() => {
  vi.restoreAllMocks();
});

describe("importer links read their targets' nodes in one call", () => {
  it('renders every link of an item from one getNodes read', async () => {
    const { run, body } = setup();
    await run([upsert({ sourceId: 'a' }), upsert({ sourceId: 'b' })]);
    const getNodes = vi.spyOn(InMemoryKnowledgeImportersStorage.prototype, 'getNodes');
    const getNode = vi.spyOn(InMemoryKnowledgeImportersStorage.prototype, 'getNode');

    expect(await run([upsert({ sourceId: 'l', links })])).toMatchObject({ outcome: 'succeeded' });
    expect(await body('notion/l')).toBe(expected);
    const linkReads = getNodes.mock.calls.filter(([, ids]) => ids.includes('a'));
    // Each render reads all its targets before the pages and the resolved ones after: rendered
    // once with the body, and again by the settle pass that retries the unresolved link.
    expect(linkReads.length).toBeGreaterThan(0);
    expect(linkReads.length % 2).toBe(0);
    linkReads.forEach((call, i) => expect(call).toEqual(['b1', i % 2 ? ['a', 'b'] : ['a', 'b', 'missing']]));
    expect(getNode.mock.calls.filter(([, id]) => id === 'a' || id === 'b')).toEqual([]);
  });

  it('renders the same links on a store that has only getNode', async () => {
    const { run, body } = setup();
    await run([upsert({ sourceId: 'a' }), upsert({ sourceId: 'b' })]);
    // A store written against the interface before getNodes, as PG and LibSQL implement it.
    const getNode = vi.spyOn(InMemoryKnowledgeImportersStorage.prototype, 'getNode');
    const own = Object.getOwnPropertyDescriptor(InMemoryKnowledgeImportersStorage.prototype, 'getNodes')!;
    Object.defineProperty(InMemoryKnowledgeImportersStorage.prototype, 'getNodes', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      expect(await run([upsert({ sourceId: 'l', links })])).toMatchObject({ outcome: 'succeeded' });
      expect(await body('notion/l')).toBe(expected);
      // The importer's own loop read each target, the missing one included.
      expect(getNode.mock.calls.some(([, id]) => id === 'missing')).toBe(true);
    } finally {
      Object.defineProperty(InMemoryKnowledgeImportersStorage.prototype, 'getNodes', own);
    }
  });
});
