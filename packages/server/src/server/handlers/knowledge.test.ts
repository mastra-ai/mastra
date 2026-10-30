import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_KNOWLEDGE_PRINCIPALS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { knowledgeActivityQuerySchema, knowledgeSearchQuerySchema } from '../schemas/knowledge';
import { deriveAction, extractResource } from '../server-adapter/routes/permissions';
import {
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_PAGE_ROUTE,
  GET_KNOWLEDGE_TREE_ROUTE,
  LIST_KNOWLEDGE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
} from './knowledge';

const provenance = { author: 'agent:alex' };

/** org:acme ─┬─ team:acme:support ─ Refunds (note mentions Roadmap)
 *            └─ team:acme:eng ─ Roadmap (pinned) */
async function setup(scopes: ConstructorParameters<typeof Knowledge>[0]['scopes'] = {}) {
  const knowledge = new Knowledge({ id: 'kb', scopes, storage: new InMemoryStore({ id: 'kb' }) });
  const store = await knowledge.getStorage();
  const acme = (
    await store.materializeScope({ address: 'org:acme', declaration: 'org:$orgId', name: 'Acme', provenance })
  ).scope;
  const scope = async (address: string, name: string) =>
    (
      await store.materializeScope({
        address,
        declaration: 'team:$orgId:$teamId',
        name,
        parentId: acme.id,
        provenance,
      })
    ).scope;
  const support = await scope('team:acme:support', 'Support');
  const eng = await scope('team:acme:eng', 'Engineering');
  const refunds = await store.createPage({ parentId: support.id, name: 'Refunds', provenance });
  const roadmap = await store.createPage({ parentId: eng.id, name: 'Roadmap', provenance });
  await store.addNote({
    pageId: refunds.id,
    text: 'Refund tooling ships with [[Roadmap]]',
    stampScopeIds: [support.id, eng.id],
    mentions: [roadmap.id],
    provenance,
  });
  await store.addPinAudience({ pageId: roadmap.id, audience: ['team:acme:eng'], createdBy: 'host' });
  const mastra = new Mastra({ logger: false, knowledge: { main: knowledge } });
  return { mastra, acme, support, eng, refunds, roadmap };
}

const call = (route: { handler: (args: any) => Promise<any> }, args: Record<string, unknown>) => route.handler(args);
const names = (pages: Array<{ name: string }>) => pages.map(page => page.name);

describe('Knowledge read routes', () => {
  it('lists registered instances by key', async () => {
    const { mastra } = await setup();
    expect(await call(LIST_KNOWLEDGE_ROUTE, { mastra })).toEqual({ instances: [{ key: 'main', id: 'kb' }] });
  });

  it('reads the whole tree as the owner, one level at a time', async () => {
    const { mastra, acme, support } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    expect(names((await call(GET_KNOWLEDGE_TREE_ROUTE, args)).pages)).toEqual(['Acme']);
    expect(names((await call(GET_KNOWLEDGE_TREE_ROUTE, { ...args, parentId: acme.id })).pages)).toEqual([
      'Support',
      'Engineering',
    ]);
    expect(names((await call(GET_KNOWLEDGE_TREE_ROUTE, { ...args, parentId: support.id })).pages)).toEqual(['Refunds']);
  });

  it('returns a page with ancestors, notes, references and pin, and 404s an unknown page', async () => {
    const { mastra, refunds, roadmap } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    const page = await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: refunds.id });
    expect(names(page.ancestors)).toEqual(['Acme', 'Support']);
    expect(page.notes.map((note: { text: string }) => note.text)).toEqual(['Refund tooling ships with [[Roadmap]]']);
    expect(names(page.related)).toContain('Roadmap');
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: roadmap.id })).pin.audience).toEqual([
      'team:acme:eng',
    ]);
    await expect(call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: 'missing' })).rejects.toMatchObject({ status: 404 });
  });

  it("labels scope pages with their declaration's displayLabel, params filled in, in the tree, page and graph", async () => {
    const { mastra, acme, refunds } = await setup({ 'org:$orgId': { displayLabel: '$orgId organization' } });
    const args = { mastra, knowledgeKey: 'main' };
    const labels = (pages: Array<{ name: string; displayLabel?: string }>) =>
      pages.map(page => [page.name, page.displayLabel]);
    expect(labels((await call(GET_KNOWLEDGE_TREE_ROUTE, args)).pages)).toEqual([['Acme', 'acme organization']]);
    // Undeclared scope types and ordinary pages carry no label.
    expect(labels((await call(GET_KNOWLEDGE_TREE_ROUTE, { ...args, parentId: acme.id })).pages)).toEqual([
      ['Support', undefined],
      ['Engineering', undefined],
    ]);
    const page = await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: refunds.id });
    expect(labels(page.ancestors)).toEqual([
      ['Acme', 'acme organization'],
      ['Support', undefined],
    ]);
    expect((await call(GET_KNOWLEDGE_PAGE_ROUTE, { ...args, pageId: acme.id })).page.displayLabel).toBe(
      'acme organization',
    );
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, args);
    expect(graph.pages.find((p: { id: string }) => p.id === acme.id).displayLabel).toBe('acme organization');
  });

  it('returns the bounded page graph with parent and mention edges across scopes', async () => {
    const { mastra, refunds, roadmap, support } = await setup();
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'main' });
    expect(names(graph.pages).sort()).toEqual(['Acme', 'Engineering', 'Refunds', 'Roadmap', 'Support']);
    expect(graph.edges).toContainEqual({ source: support.id, target: refunds.id, kind: 'parent' });
    expect(graph.edges).toContainEqual({ source: refunds.id, target: roadmap.id, kind: 'mention', count: 1 });
    expect(graph.pinnedIds).toEqual([roadmap.id]);
    const small = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'main', maxPages: 2 });
    expect(small.truncated).toBe(true);
    await expect(
      call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'main', rootId: 'missing' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('searches every scope, or only the given scopes, and pages activity', async () => {
    const { mastra, support, eng } = await setup();
    const args = { mastra, knowledgeKey: 'main' };
    const all = await call(SEARCH_KNOWLEDGE_ROUTE, { ...args, q: 'roadmap' });
    expect(all.results.map((hit: { page: { name: string } }) => hit.page.name)).toContain('Roadmap');
    const narrowed = await call(SEARCH_KNOWLEDGE_ROUTE, { ...args, q: 'roadmap', scopeId: [eng.id] });
    expect(narrowed.results.every((hit: { page: { scopeId: string } }) => hit.page.scopeId === eng.id)).toBe(true);
    const supportOnly = await call(SEARCH_KNOWLEDGE_ROUTE, { ...args, q: 'refunds', scopeId: [support.id] });
    expect(supportOnly.results.length).toBeGreaterThan(0);

    const first = await call(GET_KNOWLEDGE_ACTIVITY_ROUTE, { ...args, limit: 2 });
    expect(first.events).toHaveLength(2);
    const next = await call(GET_KNOWLEDGE_ACTIVITY_ROUTE, { ...args, limit: 2, cursor: first.nextCursor });
    expect(next.events[0].id).not.toBe(first.events[0].id);
  });

  it('404s an unknown instance', async () => {
    const { mastra } = await setup();
    await expect(call(GET_KNOWLEDGE_TREE_ROUTE, { mastra, knowledgeKey: 'nope' })).rejects.toBeInstanceOf(
      HTTPException,
    );
  });

  it('filters instances and gates reads by FGA when configured', async () => {
    const { mastra } = await setup();
    const filterAccessible = vi.fn(async (_user: unknown, items: Array<{ key: string }>) =>
      items.filter(i => i.key !== 'main'),
    );
    (mastra as any).getServer = () => ({ fga: { filterAccessible, check: async () => false } });
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'u1' });
    expect(await call(LIST_KNOWLEDGE_ROUTE, { mastra, requestContext })).toEqual({ instances: [] });
    expect(filterAccessible.mock.calls[0]![2]).toBe('knowledge');
    expect(filterAccessible.mock.calls[0]![3]).toBe('knowledge:read');
    for (const route of [GET_KNOWLEDGE_TREE_ROUTE, GET_KNOWLEDGE_GRAPH_ROUTE, GET_KNOWLEDGE_ACTIVITY_ROUTE]) {
      await expect(call(route, { mastra, requestContext, knowledgeKey: 'main' })).rejects.toMatchObject({
        status: 404,
      });
    }

    const check = vi.fn(async () => true);
    (mastra as any).getServer = () => ({ fga: { filterAccessible, check } });
    expect(
      names((await call(GET_KNOWLEDGE_TREE_ROUTE, { mastra, requestContext, knowledgeKey: 'main' })).pages),
    ).toEqual(['Acme']);
    expect(check).toHaveBeenCalledWith(
      { id: 'u1' },
      { resource: { type: 'knowledge', id: 'kb' }, permission: 'knowledge:read' },
    );
  });

  it('parses repeated scopeId params and bounds query values', () => {
    expect(knowledgeSearchQuerySchema.parse({ q: 'x', scopeId: 'a' }).scopeId).toEqual(['a']);
    expect(knowledgeSearchQuerySchema.parse({ q: 'x', scopeId: ['a', 'b'] }).scopeId).toEqual(['a', 'b']);
    expect(knowledgeSearchQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(knowledgeActivityQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('is gated by knowledge:read, and only GET routes exist', () => {
    for (const route of [
      LIST_KNOWLEDGE_ROUTE,
      GET_KNOWLEDGE_TREE_ROUTE,
      GET_KNOWLEDGE_PAGE_ROUTE,
      GET_KNOWLEDGE_GRAPH_ROUTE,
      SEARCH_KNOWLEDGE_ROUTE,
      GET_KNOWLEDGE_ACTIVITY_ROUTE,
    ]) {
      expect(route.method).toBe('GET');
      expect(route.requiresAuth).toBe(true);
      expect(`${extractResource(route.path)}:${deriveAction(route.method, route.path)}`).toBe('knowledge:read');
    }
  });
});

describe('Knowledge read routes with app auth', () => {
  /**
   * Stubs `Knowledge.readScopeFor` so each principal reads the scope at its own address, and an
   * undeclared principal fails the way the real method does.
   */
  async function setupWithAuth() {
    const ctx = await setup();
    const knowledge = ctx.mastra.listKnowledge().main as unknown as Record<string, unknown>;
    knowledge.readScopeFor = vi.fn(async (principals: string[]) => {
      if (principals.includes('unknown:x')) {
        throw Object.assign(new Error('Knowledge run scope "unknown:x" does not match a declared scope type.'), {
          name: 'KnowledgeDeclarationError',
        });
      }
      return { addresses: principals, prefixes: [], children: [] };
    });
    (ctx.mastra as any).getServer = () => ({ auth: { authenticateToken: async () => ({ id: 'u1' }) } });
    return { ...ctx, readScopeFor: knowledge.readScopeFor as ReturnType<typeof vi.fn> };
  }

  const asCaller = (principals: unknown) => {
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'u1' });
    if (principals !== undefined) requestContext.set(MASTRA_KNOWLEDGE_PRINCIPALS_KEY, principals);
    return requestContext;
  };

  it('refuses a signed-in caller the app has not mapped to principals', async () => {
    const { mastra } = await setupWithAuth();
    for (const route of [
      GET_KNOWLEDGE_TREE_ROUTE,
      GET_KNOWLEDGE_GRAPH_ROUTE,
      SEARCH_KNOWLEDGE_ROUTE,
      GET_KNOWLEDGE_ACTIVITY_ROUTE,
    ]) {
      await expect(
        call(route, { mastra, requestContext: asCaller(undefined), knowledgeKey: 'main', q: 'refunds' }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it('refuses when auth is configured only for Studio', async () => {
    const { mastra } = await setup();
    (mastra as any).getStudio = () => ({ auth: {} });
    await expect(
      call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext: asCaller(undefined), knowledgeKey: 'main' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("reads only the pages the caller's principals can read", async () => {
    const { mastra, readScopeFor } = await setupWithAuth();
    const requestContext = asCaller(['team:acme:support']);
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext, knowledgeKey: 'main' });
    expect(names(graph.pages).sort()).toEqual(['Refunds', 'Support']);
    expect(graph.pinnedIds).toEqual([]);
    expect(readScopeFor).toHaveBeenCalledWith(['team:acme:support']);

    const search = await call(SEARCH_KNOWLEDGE_ROUTE, { mastra, requestContext, knowledgeKey: 'main', q: 'roadmap' });
    expect(search.results.map((hit: { page: { name: string } }) => hit.page.name)).not.toContain('Roadmap');
  });

  it('404s a page outside what the caller can read', async () => {
    const { mastra, roadmap } = await setupWithAuth();
    await expect(
      call(GET_KNOWLEDGE_PAGE_ROUTE, {
        mastra,
        requestContext: asCaller(['team:acme:support']),
        knowledgeKey: 'main',
        pageId: roadmap.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("reads everything for a caller the app maps to 'all'", async () => {
    const { mastra, readScopeFor } = await setupWithAuth();
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, {
      mastra,
      requestContext: asCaller('all'),
      knowledgeKey: 'main',
    });
    expect(names(graph.pages).sort()).toEqual(['Acme', 'Engineering', 'Refunds', 'Roadmap', 'Support']);
    expect(readScopeFor).not.toHaveBeenCalled();
  });

  it('reads nothing for a caller mapped to no principals', async () => {
    const { mastra } = await setupWithAuth();
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext: asCaller([]), knowledgeKey: 'main' });
    expect(graph.pages).toEqual([]);
  });

  it('reports a malformed mapping or an undeclared principal as a server misconfiguration', async () => {
    const { mastra } = await setupWithAuth();
    for (const principals of ['team:acme:support', [1], ['unknown:x']]) {
      await expect(
        call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext: asCaller(principals), knowledgeKey: 'main' }),
      ).rejects.toMatchObject({ status: 500 });
    }
  });
});
