import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore } from '../../storage';
import { knowledgeLinkRefKey } from '../../storage/domains/knowledge';
import { Knowledge } from '../index';
import { refreshKnowledgeLinksTo } from '../links';
import { KnowledgeImporter } from './define';
import type { KnowledgeImporterContext } from './define';
import type { KnowledgeImporterOp, KnowledgeImportItem } from './types';

/**
 * Key paths come from one `getPageParents` call per page, not one `getPage` per level (r483
 * change 2), and callers still start from the page they hold, which may be a before-image.
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
  return { knowledge, run };
}

describe('importer key paths read a page’s parents in one call', () => {
  it('renders a link to a deep page without reading its ancestors one by one', async () => {
    const { knowledge, run } = setup();
    const chain = [
      upsert({ sourceId: 'a' }),
      upsert({ sourceId: 'b', parent: 'a' }),
      upsert({ sourceId: 'c', parent: 'b' }),
    ];
    await run([...chain, upsert({ sourceId: 'd', parent: 'c' })]);
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    const at = (path: string) => storage.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' });
    const ancestors = new Set(
      (await Promise.all(['notion/a', 'notion/a/b', 'notion/a/b/c'].map(at))).map(found => found!.id),
    );

    const getPage = vi.spyOn(storage, 'getPage');
    const getPageParents = vi.spyOn(storage, 'getPageParents');
    const receipt = await run([upsert({ sourceId: 'l', links: [{ sourceId: 'd' }] })]);
    expect(receipt).toMatchObject({ outcome: 'succeeded' });
    expect((await at('notion/l'))?.body).toBe('body of l\n\nLinks:\n- [[docs:acme#notion/a/b/c/d]]');

    expect(getPage.mock.calls.filter(([input]) => ancestors.has(input.id))).toEqual([]);
    expect(getPageParents.mock.calls.some(([input]) => ancestors.has(input.parentId))).toBe(true);
  });

  it('refreshes links to the path a page had in the copy the caller holds, not the one stored now', async () => {
    const { knowledge, run } = setup();
    await run([upsert({ sourceId: 'a' }), upsert({ sourceId: 'p', parent: 'a' }), upsert({ sourceId: 'b' })]);
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    const at = (path: string) => storage.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' });
    const old = (await at('notion/a/p'))!;
    const b = (await at('notion/b'))!;
    await storage.movePage({
      id: old.id,
      expectedVersion: old.version,
      parentId: b.id,
      provenance: { author: 'alex' },
    });

    const sources = vi.spyOn(storage, 'listPageBodyLinkSources');
    await refreshKnowledgeLinksTo(storage, [old]);
    const refs = sources.mock.calls.flatMap(([input]) => input.refs);
    expect(refs).toContain(knowledgeLinkRefKey('docs:acme#notion/a/p'));
    expect(refs).not.toContain(knowledgeLinkRefKey('docs:acme#notion/b/p'));
  });

  it('refreshes links to a deep page without reading its ancestors one by one', async () => {
    const { knowledge, run } = setup();
    await run([
      upsert({ sourceId: 'a' }),
      upsert({ sourceId: 'b', parent: 'a' }),
      upsert({ sourceId: 'c', parent: 'b' }),
      upsert({ sourceId: 'd', parent: 'c' }),
    ]);
    const storage = await knowledge.getStorage();
    const [scope] = await storage.getScopesByAddress(['docs:acme']);
    const at = (path: string) => storage.getPageByPath({ scopeId: scope!.id, path: path.split('/'), read: 'all' });
    const deep = (await at('notion/a/b/c/d'))!;
    const ancestors = new Set(
      (await Promise.all(['notion', 'notion/a', 'notion/a/b', 'notion/a/b/c'].map(at))).map(found => found!.id),
    );

    const getPage = vi.spyOn(storage, 'getPage');
    const getPageParents = vi.spyOn(storage, 'getPageParents');
    const sources = vi.spyOn(storage, 'listPageBodyLinkSources');
    await refreshKnowledgeLinksTo(storage, [deep]);
    expect(sources.mock.calls.flatMap(([input]) => input.refs)).toContain(
      knowledgeLinkRefKey('docs:acme#notion/a/b/c/d'),
    );
    expect(getPage.mock.calls.filter(([input]) => ancestors.has(input.id))).toEqual([]);
    expect(getPageParents).toHaveBeenCalledWith({ parentId: deep.parentId, read: 'all' });
  });
});
