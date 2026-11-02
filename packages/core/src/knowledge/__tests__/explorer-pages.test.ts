import { describe, expect, it } from 'vitest';

import type { KnowledgeReadScope } from '../../storage';
import { InMemoryKnowledgePageStore } from '../../storage/domains/knowledge/pages-inmemory';
import {
  listKnowledgeTreeChildren,
  readKnowledgePage,
  readKnowledgePageActivity,
  readKnowledgePageGraph,
  searchKnowledgeExplorerPages,
} from '../explorer-pages';

const host = { author: 'host' };

/**
 * org:acme ─┬─ team:acme:support ─ Refunds ─ Refund policy
 *           │                     Billing   (notes mention Refunds and the private Roadmap)
 *           └─ team:acme:eng ─ Roadmap
 * org:globex ─ Globex handbook
 */
async function seed() {
  const store = new InMemoryKnowledgePageStore();
  const acme = (
    await store.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'Acme', provenance: host })
  ).scope;
  const support = (
    await store.materializeScope({
      address: 'team:acme:support',
      declaration: 'team:$orgId:$teamId',
      name: 'Support',
      parentId: acme.id,
      provenance: host,
    })
  ).scope;
  const eng = (
    await store.materializeScope({
      address: 'team:acme:eng',
      declaration: 'team:$orgId:$teamId',
      name: 'Engineering',
      parentId: acme.id,
      provenance: host,
    })
  ).scope;
  const globex = (
    await store.materializeScope({ address: 'org:globex', declaration: 'org:$orgId', name: 'Globex', provenance: host })
  ).scope;
  const refunds = await store.createPage({ parentId: support.id, name: 'Refunds', provenance: host });
  const policy = await store.createPage({ parentId: refunds.id, name: 'Refund policy', provenance: host });
  const billing = await store.createPage({ parentId: support.id, name: 'Billing', provenance: host });
  const roadmap = await store.createPage({ parentId: eng.id, name: 'Roadmap', provenance: host });
  const handbook = await store.createPage({ parentId: globex.id, name: 'Globex handbook', provenance: host });
  const publicNote = await store.addNote({
    pageId: billing.id,
    text: 'Refund disputes go through [[Refunds]]',
    stampScopeIds: [support.id],
    mentions: [refunds.id],
    provenance: { author: 'agent:alex' },
  });
  await store.addNote({
    pageId: billing.id,
    text: 'Billing changes ship with [[Roadmap]] Q3',
    stampScopeIds: [support.id],
    mentions: [roadmap.id],
    provenance: { author: 'agent:alex' },
  });
  await store.addNote({
    pageId: refunds.id,
    text: 'Refunds take 5 days',
    stampScopeIds: [support.id],
    mentions: [],
    provenance: { author: 'agent:alex' },
  });
  await store.addPinAudience({ pageId: refunds.id, audience: ['team:acme:support'], createdBy: 'host' });
  return { store, acme, support, eng, globex, refunds, policy, billing, roadmap, handbook, publicNote };
}

/** A support-team viewer: reads team:acme:support only, not org:acme or team:acme:eng. */
const supportOnly: KnowledgeReadScope = { addresses: ['team:acme:support'], prefixes: [], children: [] };

const names = (pages: Array<{ name: string }>) => pages.map(page => page.name);

describe('listKnowledgeTreeChildren', () => {
  it("lists root scopes, then a page's child scopes before its child pages, as the owner", async () => {
    const { store, acme, support } = await seed();
    const roots = await listKnowledgeTreeChildren(store, { parentId: null, read: 'all' });
    expect(names(roots.pages)).toEqual(['Acme', 'Globex']);
    expect(names((await listKnowledgeTreeChildren(store, { parentId: acme.id, read: 'all' })).pages)).toEqual([
      'Support',
      'Engineering',
    ]);
    expect(names((await listKnowledgeTreeChildren(store, { parentId: support.id, read: 'all' })).pages)).toEqual([
      'Refunds',
      'Billing',
    ]);
  });

  it('hoists a readable scope found under an unreadable one, and hides everything else', async () => {
    const { store, acme, support } = await seed();
    const roots = await listKnowledgeTreeChildren(store, { parentId: null, read: supportOnly });
    expect(names(roots.pages)).toEqual(['Support']);
    expect((await listKnowledgeTreeChildren(store, { parentId: acme.id, read: supportOnly })).pages).toEqual([]);
    expect(names((await listKnowledgeTreeChildren(store, { parentId: support.id, read: supportOnly })).pages)).toEqual([
      'Refunds',
      'Billing',
    ]);
  });

  describe('child counts', () => {
    const counts = (pages: Array<{ name: string; childCount?: number }>) =>
      Object.fromEntries(pages.map(page => [page.name, page.childCount]));

    it('counts the pages, and for a scope the child scopes, directly under each listed page', async () => {
      const { store, acme, support } = await seed();
      expect(counts((await listKnowledgeTreeChildren(store, { parentId: null, read: 'all' })).pages).Acme).toBe(2);
      expect(counts((await listKnowledgeTreeChildren(store, { parentId: acme.id, read: 'all' })).pages)).toEqual({
        Support: 2,
        Engineering: 1,
      });
      expect(counts((await listKnowledgeTreeChildren(store, { parentId: support.id, read: 'all' })).pages)).toEqual({
        Refunds: 1,
        Billing: 0,
      });
    });

    it('counts only what the caller can read', async () => {
      const { store } = await seed();
      const roots = await listKnowledgeTreeChildren(store, { parentId: null, read: supportOnly });
      expect(counts(roots.pages)).toEqual({ Support: 2 });
    });

    it('leaves counts out when the store cannot count children', async () => {
      const { store, support } = await seed();
      // An adapter built before countChildPages existed.
      Object.assign(store, { countChildPages: undefined });
      const level = await listKnowledgeTreeChildren(store, { parentId: support.id, read: 'all' });
      expect(level.pages.map(page => 'childCount' in page)).toEqual([false, false]);
    });
  });

  it('pages ordinary child pages with a cursor and lists scopes only on the first page', async () => {
    const { store, support } = await seed();
    const first = await listKnowledgeTreeChildren(store, { parentId: support.id, read: 'all', limit: 1 });
    expect(names(first.pages)).toEqual(['Refunds']);
    expect(first.nextCursor).toBeDefined();
    const second = await listKnowledgeTreeChildren(store, {
      parentId: support.id,
      read: 'all',
      cursor: first.nextCursor,
      limit: 1,
    });
    expect(names(second.pages)).toEqual(['Billing']);
    expect(second.nextCursor).toBeUndefined();
  });
});

describe('readKnowledgePage', () => {
  it('returns notes, pin, readable ancestors, related pages and notes mentioning it', async () => {
    const { store, refunds, publicNote } = await seed();
    const view = await readKnowledgePage(store, { pageId: refunds.id, read: 'all' });
    expect(view?.page.name).toBe('Refunds');
    expect(names(view?.ancestors ?? [])).toEqual(['Acme', 'Support']);
    expect(view?.notes.map(note => note.text)).toEqual(['Refunds take 5 days']);
    expect(view?.pin?.audience).toEqual(['team:acme:support']);
    expect(view?.mentionedBy.map(note => note.id)).toEqual([publicNote.id]);
    expect(names(view?.related ?? [])).toContain('Billing');
  });

  it('skips unreadable ancestors and returns null for a page the caller cannot read', async () => {
    const { store, policy, roadmap } = await seed();
    const view = await readKnowledgePage(store, { pageId: policy.id, read: supportOnly });
    expect(names(view?.ancestors ?? [])).toEqual(['Support', 'Refunds']);
    expect(await readKnowledgePage(store, { pageId: roadmap.id, read: supportOnly })).toBeNull();
  });

  it('hides a note that mentions a page the caller cannot read', async () => {
    const { store, billing } = await seed();
    const owner = await readKnowledgePage(store, { pageId: billing.id, read: 'all' });
    const bound = await readKnowledgePage(store, { pageId: billing.id, read: supportOnly });
    expect(owner?.notes).toHaveLength(2);
    expect(bound?.notes.map(note => note.text)).toEqual(['Refund disputes go through [[Refunds]]']);
    expect(names(bound?.related ?? [])).not.toContain('Roadmap');
  });
});

describe('readKnowledgePage by reference', () => {
  // Tool results (knowledge_list) name pages by scope address and key path, not id.
  async function keyed() {
    const seeded = await seed();
    const { store, support, eng } = seeded;
    const policies = await store.createPage({
      parentId: support.id,
      key: 'policies',
      name: 'Policies',
      provenance: host,
    });
    const guides = await store.createPage({ parentId: policies.id, key: 'guides', name: 'Guides', provenance: host });
    const disputes = await store.createPage({
      parentId: guides.id,
      key: 'disputes',
      name: 'Disputes',
      provenance: host,
    });
    const plans = await store.createPage({ parentId: eng.id, key: 'plans', name: 'Plans', provenance: host });
    return { ...seeded, disputes, plans };
  }

  it('opens a scope by its address', async () => {
    const { store, support } = await keyed();
    expect((await readKnowledgePage(store, { pageId: 'team:acme:support', read: 'all' }))?.page.id).toBe(support.id);
  });

  it('opens a page by scope#key/path at any depth', async () => {
    const { store, disputes } = await keyed();
    const view = await readKnowledgePage(store, { pageId: 'team:acme:support#policies/guides/disputes', read: 'all' });
    expect(view?.page.id).toBe(disputes.id);
    expect(names(view?.ancestors ?? [])).toEqual(['Acme', 'Support', 'Policies', 'Guides']);
  });

  it('finds nothing the caller cannot read, nor a ref that names no page', async () => {
    const { store } = await keyed();
    expect(await readKnowledgePage(store, { pageId: 'team:acme:eng', read: supportOnly })).toBeNull();
    expect(await readKnowledgePage(store, { pageId: 'team:acme:eng#plans', read: supportOnly })).toBeNull();
    expect(await readKnowledgePage(store, { pageId: 'team:acme:support#nowhere', read: 'all' })).toBeNull();
    expect(await readKnowledgePage(store, { pageId: 'team:acme:nobody', read: 'all' })).toBeNull();
  });
});

describe('readKnowledgePageGraph', () => {
  it('walks every root as the owner with parent and mention edges, and marks pins', async () => {
    const { store, billing, refunds, roadmap, support } = await seed();
    const graph = await readKnowledgePageGraph(store, { read: 'all' });
    expect(names(graph?.pages ?? []).sort()).toEqual(
      [
        'Acme',
        'Billing',
        'Engineering',
        'Globex',
        'Globex handbook',
        'Refund policy',
        'Refunds',
        'Roadmap',
        'Support',
      ].sort(),
    );
    expect(graph?.outsideIds).toEqual([]);
    expect(graph?.edges).toContainEqual({ source: support.id, target: refunds.id, kind: 'parent' });
    expect(graph?.edges).toContainEqual({ source: billing.id, target: refunds.id, kind: 'mention', count: 1 });
    expect(graph?.edges).toContainEqual({ source: billing.id, target: roadmap.id, kind: 'mention', count: 1 });
    expect(graph?.pinnedIds).toEqual([refunds.id]);
    expect(graph?.truncated).toBe(false);
  });

  it('gives a bound viewer only readable pages and links from readable notes', async () => {
    const { store, roadmap } = await seed();
    const graph = await readKnowledgePageGraph(store, { read: supportOnly });
    expect(names(graph?.pages ?? []).sort()).toEqual(['Billing', 'Refund policy', 'Refunds', 'Support']);
    expect(graph?.edges.some(edge => edge.target === roadmap.id || edge.source === roadmap.id)).toBe(false);
  });

  it('adds mentioned pages outside a rooted walk as endpoints', async () => {
    const { store, billing, eng, roadmap } = await seed();
    const graph = await readKnowledgePageGraph(store, { read: 'all', rootId: billing.id });
    expect(graph?.pages.map(page => page.id).sort()).toContain(roadmap.id);
    expect(graph?.outsideIds).toContain(roadmap.id);
    expect(graph?.pages.some(page => page.id === eng.id)).toBe(false);
  });

  it("finds a mention in any of a page's notes, not just its first batch", async () => {
    const { store, refunds, roadmap, support } = await seed();
    for (let i = 0; i < 120; i++) {
      await store.addNote({
        pageId: refunds.id,
        text: `Note ${i}`,
        stampScopeIds: [support.id],
        mentions: [],
        provenance: host,
      });
    }
    await store.addNote({
      pageId: refunds.id,
      text: 'Refund tooling ships with [[Roadmap]]',
      stampScopeIds: [support.id],
      mentions: [roadmap.id],
      provenance: host,
    });
    const graph = await readKnowledgePageGraph(store, { read: 'all' });
    expect(graph?.edges).toContainEqual({ source: refunds.id, target: roadmap.id, kind: 'mention', count: 1 });
    expect(graph?.truncated).toBe(false);

    const capped = await readKnowledgePageGraph(store, { read: 'all', limits: { maxNotes: 10 } });
    expect(capped?.truncated).toBe(true);
  });

  it('stops at maxPages and reports truncation; an unreadable root is null', async () => {
    const { store, roadmap } = await seed();
    const graph = await readKnowledgePageGraph(store, { read: 'all', limits: { maxPages: 3 } });
    expect(graph?.pages.length).toBeLessThanOrEqual(3 + (graph?.outsideIds.length ?? 0));
    expect(graph?.truncated).toBe(true);
    expect(await readKnowledgePageGraph(store, { read: supportOnly, rootId: roadmap.id })).toBeNull();
  });
});

describe('search and activity', () => {
  it('filters search hits and activity by the read scope', async () => {
    const { store, roadmap, refunds } = await seed();
    const owner = await searchKnowledgeExplorerPages(store, { query: 'roadmap', read: 'all' });
    expect(owner.length).toBeGreaterThan(0);
    expect(await searchKnowledgeExplorerPages(store, { query: 'roadmap', read: supportOnly })).toEqual([]);
    const ownerActivity = await readKnowledgePageActivity(store, { read: 'all', limit: 100 });
    const boundActivity = await readKnowledgePageActivity(store, { read: supportOnly, limit: 100 });
    const ownerPages = new Set(ownerActivity.events.map(event => event.pageId));
    const boundPages = new Set(boundActivity.events.map(event => event.pageId));
    expect(ownerPages.has(roadmap.id)).toBe(true);
    expect(boundPages.has(roadmap.id)).toBe(false);
    expect(boundPages.has(refunds.id)).toBe(true);
    expect(boundActivity.events.length).toBeLessThan(ownerActivity.events.length);
    const firstPage = await readKnowledgePageActivity(store, { read: 'all', limit: 2 });
    expect(firstPage.events).toHaveLength(2);
    expect(firstPage.nextCursor).toBeDefined();
  });
});
