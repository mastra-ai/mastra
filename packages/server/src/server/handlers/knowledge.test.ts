import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { MASTRA_KNOWLEDGE_SCOPE_KEY, isReservedRequestContextKey } from '../constants';
import { HTTPException } from '../http-exception';
import { knowledgeActivityQuerySchema, knowledgeViewQuerySchema } from '../schemas/knowledge';
import {
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_NODE_ROUTE,
  LIST_KNOWLEDGE_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
} from './knowledge';
import { deriveAction, extractResource } from '../server-adapter/routes/permissions';

const org = ['org:acme'];
const team = ['org:acme', 'team:acme:x'];

async function setup() {
  const knowledge = new Knowledge({ id: 'kb', storage: new InMemoryStore({ id: 'kb' }) });
  const store = await knowledge.getStorage();
  const payments = await store.createNode({ name: 'Payments', kind: 'service', scope: org });
  const secret = await store.createNode({ name: 'Secret', kind: 'doc', scope: team });
  await store.appendKnowledge({
    node: payments.id,
    text: 'Payments is documented.',
    scope: org,
    sourceThreadId: 't1',
    resolutionScope: org,
    defaultScope: org,
  });
  await store.appendKnowledge({
    node: secret.id,
    text: 'Team-only note.',
    scope: team,
    sourceThreadId: 't2',
    resolutionScope: team,
    defaultScope: team,
  });
  const mastra = new Mastra({ logger: false, knowledge: { main: knowledge } });
  return { mastra, payments, secret };
}

const call = (route: { handler: (args: any) => Promise<any> }, args: Record<string, unknown>) => route.handler(args);

describe('Knowledge read routes', () => {
  it('lists registered instances by key', async () => {
    const { mastra } = await setup();
    expect(await call(LIST_KNOWLEDGE_ROUTE, { mastra })).toEqual({ instances: [{ key: 'main', id: 'kb' }] });
  });

  it('shows only what the given scope tags can see', async () => {
    const { mastra, payments, secret } = await setup();
    const orgView = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'main', scope: org });
    expect(orgView.nodes.map((n: { name: string }) => n.name)).toEqual(['Payments']);
    const teamView = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'main', scope: team });
    expect(teamView.nodes.map((n: { name: string }) => n.name).sort()).toEqual(['Payments', 'Secret']);

    const node = await call(GET_KNOWLEDGE_NODE_ROUTE, {
      mastra,
      knowledgeKey: 'main',
      nodeId: payments.id,
      scope: org,
    });
    expect(node.node.name).toBe('Payments');
    // A node id from a wider scope is a 404 from a narrower view, not a read.
    await expect(
      call(GET_KNOWLEDGE_NODE_ROUTE, { mastra, knowledgeKey: 'main', nodeId: secret.id, scope: org }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('searches and pages activity inside the view only', async () => {
    const { mastra } = await setup();
    const found = await call(SEARCH_KNOWLEDGE_ROUTE, { mastra, knowledgeKey: 'main', scope: org, q: 'sec' });
    expect(found.results).toEqual([]);
    const wide = await call(SEARCH_KNOWLEDGE_ROUTE, { mastra, knowledgeKey: 'main', scope: team, q: 'sec' });
    expect(wide.results.map((r: { name: string }) => r.name)).toEqual(['Secret']);
    const activity = await call(GET_KNOWLEDGE_ACTIVITY_ROUTE, { mastra, knowledgeKey: 'main', scope: org });
    expect(activity.events.length).toBeGreaterThan(0);
    expect(activity.events.every((e: { scope: string[] }) => e.scope.every(tag => org.includes(tag)))).toBe(true);
  });

  it('404s an unknown instance and 400s an invalid scope', async () => {
    const { mastra } = await setup();
    await expect(call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, knowledgeKey: 'nope', scope: org })).rejects.toBeInstanceOf(
      HTTPException,
    );
    await expect(
      call(GET_KNOWLEDGE_GRAPH_ROUTE, {
        mastra,
        knowledgeKey: 'main',
        scope: Array.from({ length: 9 }, (_, i) => `t${i}:x`),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('keeps a request inside the scope the app set for the caller', async () => {
    const { mastra } = await setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_KNOWLEDGE_SCOPE_KEY, org);
    const args = { mastra, requestContext, knowledgeKey: 'main' };
    expect((await call(GET_KNOWLEDGE_GRAPH_ROUTE, { ...args, scope: org })).nodes).toHaveLength(1);
    await expect(call(GET_KNOWLEDGE_GRAPH_ROUTE, { ...args, scope: team })).rejects.toMatchObject({ status: 403 });
    await expect(call(SEARCH_KNOWLEDGE_ROUTE, { ...args, scope: team, q: 'sec' })).rejects.toMatchObject({
      status: 403,
    });
    await expect(call(GET_KNOWLEDGE_GRAPH_ROUTE, { ...args, scope: ['org:acme', 'org:other'] })).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('org:other'),
    });
    // An empty allowed set means no tags: nothing can be requested.
    requestContext.set(MASTRA_KNOWLEDGE_SCOPE_KEY, []);
    await expect(call(GET_KNOWLEDGE_GRAPH_ROUTE, { ...args, scope: org })).rejects.toMatchObject({ status: 403 });
  });

  it('treats a malformed established scope as a 400 and reserves the key from request bodies', async () => {
    const { mastra } = await setup();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_KNOWLEDGE_SCOPE_KEY, 'org:acme');
    await expect(
      call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext, knowledgeKey: 'main', scope: org }),
    ).rejects.toMatchObject({ status: 400 });
    expect(isReservedRequestContextKey(MASTRA_KNOWLEDGE_SCOPE_KEY)).toBe(true);
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
    await expect(
      call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext, knowledgeKey: 'main', scope: org }),
    ).rejects.toMatchObject({ status: 404 });

    // A provider that allows the instance reads it (check, the real IFGAProvider method).
    const check = vi.fn(async () => true);
    (mastra as any).getServer = () => ({ fga: { filterAccessible, check } });
    const graph = await call(GET_KNOWLEDGE_GRAPH_ROUTE, { mastra, requestContext, knowledgeKey: 'main', scope: org });
    expect(graph).toBeDefined();
    expect(check).toHaveBeenCalledWith(
      { id: 'u1' },
      { resource: { type: 'knowledge', id: expect.any(String) }, permission: 'knowledge:read' },
    );
  });

  it('parses one or many scope params and bounds them', () => {
    expect(knowledgeViewQuerySchema.parse({ scope: 'org:a' }).scope).toEqual(['org:a']);
    expect(knowledgeViewQuerySchema.parse({ scope: ['org:a', 'p:b'] }).scope).toEqual(['org:a', 'p:b']);
    expect(knowledgeViewQuerySchema.safeParse({}).success).toBe(false);
    expect(knowledgeViewQuerySchema.safeParse({ scope: [] }).success).toBe(false);
    expect(knowledgeActivityQuerySchema.safeParse({ scope: 'org:a', limit: '1000' }).success).toBe(false);
  });

  it('is gated by knowledge:read, and only GET routes exist', () => {
    for (const route of [
      LIST_KNOWLEDGE_ROUTE,
      GET_KNOWLEDGE_GRAPH_ROUTE,
      GET_KNOWLEDGE_NODE_ROUTE,
      SEARCH_KNOWLEDGE_ROUTE,
      GET_KNOWLEDGE_ACTIVITY_ROUTE,
    ]) {
      expect(route.method).toBe('GET');
      expect(route.requiresAuth).toBe(true);
      expect(`${extractResource(route.path)}:${deriveAction(route.method, route.path)}`).toBe('knowledge:read');
    }
  });
});
