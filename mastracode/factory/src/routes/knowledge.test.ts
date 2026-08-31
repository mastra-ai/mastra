import { Knowledge } from '@mastra/core/knowledge';
import {
  InMemoryDB,
  InMemoryKnowledgeStorage,
  InMemoryStore,
  KnowledgeUnsupportedError,
  knowledgeImporterBindingKey,
} from '@mastra/core/storage';
import type { KnowledgeNode, KnowledgeStorage } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type {
  KnowledgeNodePayload,
  KnowledgeGraphPayload,
  KnowledgeRouteLimits,
  KnowledgeScopeTreePayload,
} from './knowledge.js';
import { KnowledgeRoutes } from './knowledge.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
type KnowledgeAddressScope = string[];

interface Harness {
  app: Hono;
  knowledge: KnowledgeStorage;
  instance: Knowledge;
  projectId: string;
  orgScope: KnowledgeAddressScope;
  projectScope: KnowledgeAddressScope;
  threadScope: (threadId: string) => KnowledgeAddressScope;
}

/** Wrap a bare domain in the Knowledge-instance shape the route resolves. */
function instanceOver(store: KnowledgeStorage): Knowledge {
  return {
    getStorage: async () => store,
    materializeScope: async input => {
      await store.reconcileStructure({
        scopes: [
          ...(input.parentAddresses ?? []).map(address => ({ address, name: address.split(':').at(-1)! })),
          {
            address: input.address,
            name: input.name ?? input.address.split(':').at(-1)!,
            ...(input.parentAddresses ? { parentAddresses: input.parentAddresses } : {}),
          },
        ],
      });
      const resolved = await store.getScopeAddress(input.address);
      if (!resolved) throw new Error(`Missing materialized test scope: ${input.address}`);
      return { scopes: { [input.address]: resolved.scopeNodeId }, createdScopeIds: [], changed: false, accessEpoch: 0 };
    },
  } as Knowledge;
}

async function createHarness(
  options: {
    limits?: Partial<KnowledgeRouteLimits>;
    user?: { workosId: string; organizationId?: string };
    orgId?: string;
    knowledge?: KnowledgeStorage;
    knowledgeRuntime?: Knowledge;
    knowledgeResolver?: (key: string) => Promise<Knowledge | undefined>;
    defaultKnowledgeKey?: string;
    isOrganizationAdmin?: (organizationId: string, userId: string) => Promise<boolean>;
  } = {},
): Promise<Harness> {
  const orgId = options.orgId ?? ORG;
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId, userId: 'user-1', input: { name: 'Graph project' } });
  const realInstance = options.knowledgeRuntime ?? new Knowledge({ id: 'knowledge', storage: new InMemoryStore() });
  const knowledge = options.knowledge ?? (await realInstance.getStorageInternal());
  const instance = options.knowledge ? instanceOver(knowledge) : realInstance;
  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth(options.isOrganizationAdmin ? { isOrganizationAdmin: options.isOrganizationAdmin } : {}),
    projects: seed.projects,
    knowledge: options.knowledgeResolver ?? (async () => instance),
    ...(options.defaultKnowledgeKey ? { defaultKnowledgeKey: options.defaultKnowledgeKey } : {}),
    ...(options.limits ? { limits: options.limits } : {}),
  }).routes();
  const app = new Hono();
  const user = options.user ?? { workosId: 'user-1', organizationId: orgId };
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, routes);
  const projectScope: KnowledgeAddressScope = [`org:${orgId}`, `resource:${project.id}`];
  return {
    app,
    knowledge,
    instance,
    projectId: project.id,
    orgScope: [`org:${orgId}`],
    projectScope,
    threadScope: threadId => [...projectScope, `resource:${project.id}:thread:${threadId}`],
  };
}

async function scopePathIds(store: KnowledgeStorage, scope: KnowledgeAddressScope): Promise<string[]> {
  await store.reconcileStructure({
    scopes: scope.map((address, index) => ({
      address,
      name: address.split(':').at(-1)!,
      ...(index > 0 ? { parentAddresses: [scope[index - 1]!] } : {}),
    })),
  });
  return Promise.all(
    scope.map(async address => {
      const resolved = await store.getScopeAddress(address);
      if (!resolved) throw new Error(`Missing test scope: ${address}`);
      return resolved.scopeNodeId;
    }),
  );
}

async function node(
  store: KnowledgeStorage,
  name: string,
  scope: KnowledgeAddressScope,
  kind = 'concept',
  description?: string,
): Promise<KnowledgeNode> {
  const resolvedScopeIds = await scopePathIds(store, scope);
  return store.createNode({
    name,
    kind,
    scopeIds: [resolvedScopeIds.at(-1)!],
    contextScopeId: resolvedScopeIds.at(-1),
    ...(description !== undefined ? { metadata: { description } } : {}),
  });
}

async function record(
  store: KnowledgeStorage,
  parent: KnowledgeNode,
  text: string,
  scope: KnowledgeAddressScope,
  sourceThreadId = 'thread-a',
  metadata?: Record<string, unknown>,
  options: {
    /** Where unresolved wikilinks are auto-created. */
    autoCreateScope?: KnowledgeAddressScope;
  } = {},
) {
  const recordScopePath = await scopePathIds(store, scope);
  const resolutionScopeIds = await scopePathIds(store, options.autoCreateScope ?? scope);
  if (options.autoCreateScope) {
    for (const name of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const targetName = name[1]?.trim();
      if (!targetName || (await store.resolveNode({ name: targetName, scopeIds: resolutionScopeIds }))) continue;
      await store.createNode({ name: targetName, kind: 'node', scopeIds: [resolutionScopeIds.at(-1)!] });
    }
  }
  return store.createRecord({
    node: parent,
    text,
    scopeIds: [recordScopePath.at(-1)!],
    resolutionScopeIds,
    contextScopeId: recordScopePath.at(-1),
    source: sourceThreadId,
    metadata: { ...metadata, sourceThreadId },
  });
}

function selectedQuery(query: string): string {
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  if (!params.has('scopeLevel')) params.set('scopeLevel', params.has('threadId') ? 'thread' : 'resource');
  return `?${params}`;
}

async function graph(h: Harness, query = ''): Promise<{ status: number; body: KnowledgeGraphPayload }> {
  const response = await h.app.request(
    `/web/factory/projects/${h.projectId}/knowledge/subgraph${selectedQuery(query)}`,
  );
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeGraphPayload };
}

async function activity(h: Harness, query = ''): Promise<{ status: number; body: { events: unknown[] } }> {
  const response = await h.app.request(
    `/web/factory/projects/${h.projectId}/knowledge/activity${selectedQuery(query)}`,
  );
  return { status: response.status, body: (await response.json().catch(() => ({}))) as { events: unknown[] } };
}

async function nodeDetail(
  h: Harness,
  entityId: string,
  query = '',
): Promise<{ status: number; body: KnowledgeNodePayload }> {
  const response = await h.app.request(
    `/web/factory/projects/${h.projectId}/knowledge/nodes/${entityId}${selectedQuery(query)}`,
  );
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeNodePayload };
}

describe('KnowledgeRoutes', () => {
  it('ignores request-supplied knowledge keys and reads only the host-selected runtime', async () => {
    const first = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const second = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const resolve = vi.fn(async (key: string) =>
      key === 'default' ? instanceOver(first) : key === 'second' ? instanceOver(second) : undefined,
    );
    const h = await createHarness({ knowledgeResolver: resolve });
    const a = await node(first, 'First runtime', h.projectScope);
    const b = await node(second, 'Second runtime', h.projectScope);
    await record(first, a, 'First evidence', h.projectScope);
    await record(second, b, 'Second evidence', h.projectScope);

    // The untrusted query parameter never switches runtimes: every read stays
    // on the host-selected ('default') store, and content in other registered
    // runtimes is unreachable.
    expect((await graph(h, '?knowledgeKey=second')).body.nodes.map(node => node.name)).toEqual(['First runtime']);
    expect((await graph(h, '?knowledgeKey=missing')).body.nodes.map(node => node.name)).toEqual(['First runtime']);
    expect((await nodeDetail(h, b.id, '?knowledgeKey=second')).status).toBe(404);
    expect((await activity(h, '?knowledgeKey=second')).status).toBe(200);
    expect(new Set(resolve.mock.calls.map(([key]) => key))).toEqual(new Set(['default']));
  });

  it('fails closed on every endpoint when the host-selected key does not resolve', async () => {
    const h = await createHarness({
      knowledgeResolver: async () => undefined,
      defaultKnowledgeKey: 'mastra',
    });
    const a = await node(new InMemoryKnowledgeStorage({ db: new InMemoryDB() }), 'Unreachable', h.projectScope);
    for (const endpoint of [
      'scopes',
      'subgraph?scopeLevel=resource',
      'activity?scopeLevel=resource',
      `nodes/${a.id}?scopeLevel=resource`,
    ]) {
      const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/${endpoint}`);
      expect(response.status).toBe(503);
    }
  });

  it('uses the host-selected key when the request omits knowledgeKey', async () => {
    const store = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const resolve = vi.fn(async (key: string) => (key === 'mastra' ? instanceOver(store) : undefined));
    const h = await createHarness({ knowledge: store, knowledgeResolver: resolve, defaultKnowledgeKey: 'mastra' });
    await node(store, 'Host runtime', h.projectScope);

    expect((await graph(h)).body.nodes.map(item => item.name)).toEqual(['Host runtime']);
    expect(resolve).toHaveBeenCalledWith('mastra');
  });

  it('exposes bounded scope-tree and selected-subgraph reads without a whole-graph endpoint', async () => {
    const h = await createHarness();
    const scopes = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    expect(scopes.status).toBe(200);
    const body = (await scopes.json()) as KnowledgeScopeTreePayload;
    // The host-vouched identity chain exists as membership-linked scope nodes —
    // the tree is built from scopes that exist, not from the rung config.
    const orgNode = body.scopeNodes?.find(node => node.address === `org:${ORG}`);
    const resourceNode = body.scopeNodes?.find(node => node.address === `resource:${h.projectId}`);
    expect(body.scopeNodes).toHaveLength(2);
    expect(orgNode).toMatchObject({ name: ORG, parentIds: [] });
    expect(resourceNode).toMatchObject({ name: 'Graph project', parentIds: [orgNode!.id] });
    expect(body.roots).toEqual([
      { level: 'org', id: ORG, available: true, scopeNodeId: orgNode!.id, name: ORG },
      { level: 'resource', id: h.projectId, available: true, scopeNodeId: resourceNode!.id, name: 'Graph project' },
    ]);
    expect(body.defaultLevel).toBe('resource');
    // Materialization is create-only and deduped — a repeat read is stable.
    const again = (await (
      await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`)
    ).json()) as KnowledgeScopeTreePayload;
    expect(again.scopeNodes).toEqual(body.scopeNodes);
    expect((await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph`)).status).toBe(404);
    expect((await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/graph`)).status).toBe(404);
  });

  it('materializes the session rung as a scope node under the project when a thread is selected', async () => {
    const h = await createHarness();
    const anchor = await node(h.knowledge, 'Session anchor', h.threadScope('thread-1'));
    await record(h.knowledge, anchor, 'Session evidence', h.threadScope('thread-1'), 'thread-1');

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes?threadId=thread-1`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as KnowledgeScopeTreePayload;
    const orgNode = body.scopeNodes?.find(node => node.address === `org:${ORG}`);
    const resourceNode = body.scopeNodes?.find(node => node.address === `resource:${h.projectId}`);
    const threadNode = body.scopeNodes?.find(node => node.address === `resource:${h.projectId}:thread:thread-1`);
    expect(threadNode).toMatchObject({ name: 'thread-1', parentIds: [resourceNode!.id] });
    expect(resourceNode).toMatchObject({ name: 'Graph project', parentIds: [orgNode!.id] });
    expect(body.roots).toEqual([
      { level: 'org', id: ORG, available: true, scopeNodeId: orgNode!.id, name: ORG },
      { level: 'resource', id: h.projectId, available: true, scopeNodeId: resourceNode!.id, name: 'Graph project' },
      { level: 'thread', id: 'thread-1', available: true, scopeNodeId: threadNode!.id, name: 'thread-1' },
    ]);
  });

  it('serves the reconciled structural scope tree and its selected members', async () => {
    const h = await createHarness();
    const { scopes: ids } = await h.knowledge.reconcileStructure({
      scopes: [
        { address: `org:${ORG}`, name: 'mastra' },
        {
          address: `resource:${h.projectId}`,
          name: h.projectId,
          parentAddresses: [`org:${ORG}`],
        },
        { address: 'features', name: 'features', kind: 'domain', parentAddresses: [`org:${ORG}`] },
        {
          address: 'features:memory',
          name: 'memory',
          metadata: { description: 'Memory scope' },
          parentAddresses: ['features'],
        },
        { address: 'repo:mastra', name: 'repo:mastra', parentAddresses: [`org:${ORG}`] },
        { address: 'repo:mastra:issues', name: 'issues', parentAddresses: ['repo:mastra'] },
      ],
    });

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as KnowledgeScopeTreePayload;
    const byName = new Map((body.scopeNodes ?? []).map(scopeNode => [scopeNode.name, scopeNode]));
    // The host-vouched project rung materialized as a scope node under the
    // declared org node, keeping the declared name ('mastra') untouched.
    const resourceNode = byName.get('Graph project');
    expect(resourceNode).toMatchObject({ address: `resource:${h.projectId}`, parentIds: [ids[`org:${ORG}`]] });
    expect([...byName.keys()].sort()).toEqual(
      ['features', 'Graph project', 'issues', 'mastra', 'memory', 'repo:mastra'].sort(),
    );
    // Identity rungs whose addresses are owned by scope nodes carry the
    // structural match, so the client renders one merged entry per rung.
    expect(body.roots).toEqual([
      { level: 'org', id: ORG, available: true, scopeNodeId: ids[`org:${ORG}`], name: 'mastra' },
      { level: 'resource', id: h.projectId, available: true, scopeNodeId: resourceNode!.id, name: 'Graph project' },
    ]);
    expect(byName.get('features')).toMatchObject({
      address: 'features',
      kind: 'domain',
      parentIds: [ids[`org:${ORG}`]],
    });
    expect(byName.get('mastra')).toMatchObject({ address: `org:${ORG}`, parentIds: [] });
    expect(byName.get('memory')).toMatchObject({ description: 'Memory scope', parentIds: [ids['features']] });
    expect(byName.get('issues')?.parentIds).toEqual([ids['repo:mastra']]);

    const projectLens = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeNodeId=${ids[`resource:${h.projectId}`]}`,
    );
    expect(projectLens.status).toBe(200);
    expect(((await projectLens.json()) as KnowledgeGraphPayload).nodes[0]).toMatchObject({
      id: ids[`resource:${h.projectId}`],
      name: 'Graph project',
      isScope: true,
    });

    // Structural lens: the clicked scope node renders as its own graph root.
    const subgraph = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeNodeId=${ids[`org:${ORG}`]}`,
    );
    expect(subgraph.status).toBe(200);
    const subgraphBody = (await subgraph.json()) as KnowledgeGraphPayload;
    expect(subgraphBody.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids[`org:${ORG}`], name: 'mastra', isScope: true, scope: null, rung: null }),
        expect.objectContaining({ id: ids[`resource:${h.projectId}`], isScope: true }),
        expect.objectContaining({ id: ids['features'], isScope: true }),
        expect.objectContaining({ id: ids['repo:mastra'], isScope: true }),
      ]),
    );
    expect(subgraphBody.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'contains', source: ids[`org:${ORG}`], target: ids['features'] }),
        expect.objectContaining({ type: 'contains', source: ids[`org:${ORG}`], target: ids['repo:mastra'] }),
      ]),
    );
    expect(subgraphBody.records).toEqual([]);
    // Unknown or malformed scope nodes fail closed.
    expect(
      (await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeNodeId=not-a-uuid`)).status,
    ).toBe(404);
    expect(
      (
        await h.app.request(
          `/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeNodeId=${crypto.randomUUID()}`,
        )
      ).status,
    ).toBe(404);
  });

  it('scopes structural member content to the project boundary and derives edges from member records', async () => {
    const h = await createHarness();
    const { scopes: ids } = await h.knowledge.reconcileStructure({
      scopes: [
        { address: 'org:acme', name: 'mastra' },
        { address: 'features', name: 'features', kind: 'domain', parentAddresses: ['org:acme'] },
        { address: 'features:child', name: 'child', kind: 'domain', parentAddresses: ['features'] },
      ],
    });

    const projectScopeIds = await scopePathIds(h.knowledge, h.projectScope);
    const alpha = await h.knowledge.createNode({
      name: 'Alpha',
      kind: 'concept',
      scopeIds: [projectScopeIds.at(-1)!, ids['features']!],
    });
    const beta = await h.knowledge.createNode({
      name: 'Beta',
      kind: 'concept',
      scopeIds: [projectScopeIds.at(-1)!, ids['features']!],
    });
    await h.knowledge.createRecord({
      node: alpha,
      text: 'see [[Beta]] for the follow-up',
      scopeIds: [projectScopeIds.at(-1)!, ids['features']!],
      resolutionScopeIds: [...projectScopeIds, ids['features']!],
      contextScopeId: ids['features'],
    });

    // Same structural scope, but stamped at a sibling resource of the same
    // org — an org-wide roll-up would include it, a project view must not.
    const siblingScopeIds = await scopePathIds(h.knowledge, [...h.orgScope, 'resource:someone-else']);
    const sibling = await h.knowledge.createNode({
      name: 'Other project',
      kind: 'concept',
      scopeIds: [siblingScopeIds.at(-1)!, ids['features']!],
    });

    const response = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeNodeId=${ids['features']}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as KnowledgeGraphPayload;

    const nodeIds = body.nodes.map(item => item.id);
    expect(nodeIds).toContain(ids['features']);
    expect(nodeIds).toContain(ids['features:child']);
    expect(nodeIds).toContain(alpha.id);
    expect(nodeIds).toContain(beta.id);
    expect(nodeIds).not.toContain(sibling.id);
    expect(body.nodes.find(item => item.id === ids['features'])).toMatchObject({ isScope: true, rung: null });
    expect(body.nodes.find(item => item.id === ids['features:child'])).toMatchObject({ isScope: true, scope: null });

    expect(body.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'contains', source: ids['features'], target: ids['features:child'] }),
        expect.objectContaining({ type: 'contains', source: ids['features'], target: alpha.id }),
        expect.objectContaining({ type: 'contains', source: ids['features'], target: beta.id }),
        expect.objectContaining({ type: 'wikilink', source: alpha.id, target: beta.id }),
      ]),
    );
    expect(body.records).toHaveLength(1);
    expect(body.records[0]).toMatchObject({ nodeIds: [alpha.id, beta.id] });
    expect(body.nodes.find(item => item.id === alpha.id)?.recordCount).toBe(1);

    const scopeActivity = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/activity?scopeNodeId=${ids['features']}`,
    );
    expect(scopeActivity.status).toBe(200);
    expect(((await scopeActivity.json()) as { events: unknown[] }).events.length).toBeGreaterThanOrEqual(3);
  });

  it('omits the structural tree only for adapters without the capability, never for storage failures', async () => {
    const unsupported = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    unsupported.listScopeAddresses = async () => {
      throw new KnowledgeUnsupportedError();
    };
    const h1 = await createHarness({ knowledge: unsupported });
    const ok = await h1.app.request(`/web/factory/projects/${h1.projectId}/knowledge/scopes`);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as KnowledgeScopeTreePayload).scopeNodes).toBeUndefined();

    const broken = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    broken.listScopeAddresses = async () => {
      throw new Error('db connection lost');
    };
    const h2 = await createHarness({ knowledge: broken });
    const failed = await h2.app.request(`/web/factory/projects/${h2.projectId}/knowledge/scopes`);
    expect(failed.status).toBe(500);
  });

  it('excludes structural scope nodes from the default subgraph window', async () => {
    const store = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const h = await createHarness({ knowledge: store });
    const parent = await node(store, 'Content', h.projectScope);
    await record(store, parent, 'keeps the graph alive', h.projectScope);

    // SQL adapters return global scope nodes (scope: null) from identity-scope
    // listNodes reads; the route must exclude them instead of crashing in the
    // wikilink resolver, which iterates every node's scope.
    const listNodes = store.listNodes.bind(store);
    store.listNodes = async query => [
      ...(await listNodes(query)),
      {
        id: crypto.randomUUID(),
        name: 'mastra',
        kind: 'scope',
        scope: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as KnowledgeNode,
    ];

    const { status, body } = await graph(h);
    expect(status).toBe(200);
    expect(body.nodes.map(item => item.name)).toEqual(['Content']);
  });

  it('fails closed when the selected keyed Knowledge runtime is unavailable', async () => {
    const absent = await createHarness({ knowledgeResolver: async () => undefined });
    const failed = await createHarness({
      knowledgeResolver: async () => {
        throw new Error('schema reset required');
      },
    });

    for (const harness of [absent, failed]) {
      const response = await graph(harness);
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ error: 'knowledge_unavailable' });
      expect(JSON.stringify(response.body)).not.toContain('schema reset required');
    }
  });

  // 1
  it('returns entities and wikilink edges (owner entity → mentioned entity) from seeded facts', async () => {
    const h = await createHarness();
    const service = await node(h.knowledge, 'Payments Service', h.projectScope, 'service');
    const runbook = await node(h.knowledge, 'Deploy Runbook', h.projectScope, 'doc');
    await record(h.knowledge, service, 'Deploys follow the [[Deploy Runbook]] steps.', h.projectScope);

    const { status, body } = await graph(h);
    expect(status).toBe(200);
    expect(body.view).toBe('project');
    expect(body.nodes.map(node => node.id).sort()).toEqual([service.id, runbook.id].sort());
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: service.id, target: runbook.id, type: 'wikilink' });
    expect(body.nodes.find(node => node.id === service.id)?.recordCount).toBe(1);
    expect(body.truncated).toBe(false);
  });

  it('projects the bounded description into graph snapshots and never leaks content', async () => {
    const h = await createHarness();
    const synopsis =
      'Payments coordinates settlement and reconciliation. Repository: https://github.com/mastra-ai/mastra/tree/main/mastracode/factory';
    const described = await node(h.knowledge, 'Described', h.projectScope, 'service', synopsis);
    const absent = await node(h.knowledge, 'Absent', h.projectScope);
    const empty = await node(h.knowledge, 'Empty', h.projectScope, 'concept', '');
    // A node with long-form content but no description must not fall back to content.
    const contentScopeIds = await scopePathIds(h.knowledge, h.projectScope);
    const contentful = await h.knowledge.createNode({
      name: 'Contentful',
      kind: 'doc',
      scopeIds: [contentScopeIds.at(-1)!],
      metadata: { content: 'Long-form body that must never appear in the graph payload. '.repeat(20) },
    });

    const { status, body } = await graph(h);
    expect(status).toBe(200);
    expect(body.nodes.find(node => node.id === described.id)?.description).toBe(synopsis);
    expect(body.nodes.find(node => node.id === absent.id)).not.toHaveProperty('description');
    // '' is a curator clear — projected as omitted, same as absent.
    expect(body.nodes.find(node => node.id === empty.id)).not.toHaveProperty('description');
    expect(body.nodes.find(node => node.id === contentful.id)).not.toHaveProperty('description');
    for (const graphNode of body.nodes) {
      expect(graphNode).not.toHaveProperty('content');
    }
    expect(body.nodes).toHaveLength(4);
    expect(body.records).toHaveLength(0);
    expect(body.truncated).toBe(false);
  });

  // 2
  it('yields a real edge for a cross-rung mention (thread fact linking an org entity) in the thread view', async () => {
    const h = await createHarness();
    const orgEntity = await node(h.knowledge, 'Org Concept', h.orgScope);
    const threadEntity = await node(h.knowledge, 'Session Note', h.threadScope('t-1'));
    await record(h.knowledge, threadEntity, 'Relates to [[Org Concept]].', h.threadScope('t-1'), 't-1');

    const { status, body } = await graph(h, '?threadId=t-1');
    expect(status).toBe(200);
    expect(body.view).toBe('thread');
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: threadEntity.id, target: orgEntity.id, type: 'wikilink' });
  });

  // 3
  it('resolves a case-mismatched wikilink', async () => {
    const h = await createHarness();
    const source = await node(h.knowledge, 'Source Entity', h.projectScope);
    const target = await node(h.knowledge, 'CamelCase Name', h.projectScope);
    await record(h.knowledge, source, 'See [[camelcase name]].', h.projectScope);

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: source.id, target: target.id });
  });

  // 4
  it('drops unresolvable and self links', async () => {
    const h = await createHarness();
    const solo = await node(h.knowledge, 'Solo Entity', h.projectScope);
    await record(
      h.knowledge,
      solo,
      'Mentions [[No Such Thing]] and itself [[Solo Entity]].',
      h.projectScope,
      'thread-a',
      undefined,
      {
        autoCreateScope: h.threadScope('t-hidden'),
      },
    );

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(0);
    expect(body.outOfWindow).toHaveLength(0);
    expect(body.unresolvedCapped.count).toBe(0);
  });

  // 5
  it('reports a resolvable out-of-window target in outOfWindow, not as dangling', async () => {
    const h = await createHarness({ limits: { maxNodes: 1 } });
    // Equal updatedAt → name-asc tiebreak keeps 'A window entity' in the window.
    const inWindow = await node(h.knowledge, 'A window entity', h.projectScope);
    const outside = await node(h.knowledge, 'Z outside entity', h.projectScope);
    await record(h.knowledge, inWindow, 'Links [[Z outside entity]].', h.projectScope);

    const { body } = await graph(h);
    expect(body.nodes.map(node => node.id)).toEqual([inWindow.id]);
    expect(body.edges).toHaveLength(0);
    expect(body.outOfWindow).toEqual([
      { id: outside.id, name: 'Z outside entity', scope: h.projectScope, rung: 'resource' },
    ]);
    expect(body.unresolvedCapped.count).toBe(0);
  });

  // 6
  it('enforces the payload bound and sets the truncated flag', async () => {
    const h = await createHarness({ limits: { maxNodes: 2 } });
    await node(h.knowledge, 'One', h.projectScope);
    await node(h.knowledge, 'Two', h.projectScope);
    await node(h.knowledge, 'Three', h.projectScope);

    const { body } = await graph(h);
    expect(body.nodes).toHaveLength(2);
    expect(body.truncated).toBe(true);
  });

  // 7 (A9: multi-target pins mark their EDGES; single-target pins keep the node accent)
  it('excludes the reserved pinned entity from nodes while pinned facts accent edges (multi-target) or nodes (single-target), per rung', async () => {
    const h = await createHarness();
    const accented = await node(h.knowledge, 'Critical Service', h.projectScope, 'service');
    const relA = await node(h.knowledge, 'Deploy Runbook', h.projectScope, 'doc');
    const relB = await node(h.knowledge, 'Release Train', h.projectScope, 'process');
    const threadAccented = await node(h.knowledge, 'Session Focus', h.threadScope('t-pin'));
    const pinnedResource = await node(h.knowledge, 'pinned', h.projectScope, 'system');
    const pinnedThread = await node(h.knowledge, 'pinned', h.threadScope('t-pin'), 'system');
    // Single-target pin → node accent stays.
    await record(h.knowledge, pinnedResource, 'Always check [[Critical Service]] health.', h.projectScope, 't-any');
    // Multi-target pin → a pinned edge between the two mentioned entities, NO node accent.
    const relPin = await record(
      h.knowledge,
      pinnedResource,
      'Ship via [[Deploy Runbook]] on the [[Release Train]].',
      h.projectScope,
      't-any',
    );
    await record(h.knowledge, pinnedThread, 'This session tracks [[Session Focus]].', h.threadScope('t-pin'), 't-pin');

    const defaultView = (await graph(h)).body;
    expect(defaultView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(defaultView.nodes.find(node => node.id === accented.id)?.pinned).toBe(true);
    const pinnedEdge = defaultView.edges.find(edge => edge.pinned);
    expect(pinnedEdge).toMatchObject({ source: relA.id, target: relB.id, recordId: relPin.id, pinned: true });
    expect(defaultView.nodes.find(node => node.id === relA.id)?.pinned).toBe(false);
    expect(defaultView.nodes.find(node => node.id === relB.id)?.pinned).toBe(false);
    expect(defaultView.pinCensus).toEqual({ resource: 2, thread: null });
    // The thread-scoped pin is invisible in the default view.
    expect(defaultView.nodes.some(node => node.id === threadAccented.id)).toBe(false);

    const threadView = (await graph(h, '?threadId=t-pin')).body;
    expect(threadView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(threadView.nodes.find(node => node.id === threadAccented.id)?.pinned).toBe(true);
    expect(threadView.nodes.find(node => node.id === accented.id)?.pinned).toBe(true);
    expect(threadView.pinCensus).toEqual({ resource: 2, thread: 1 });
  });

  // 7b (A11): knowledge records are first-class payload elements with per-record node sets
  it('emits every windowed record with its in-window nodes, owner first; pins omit the reserved owner', async () => {
    const h = await createHarness();
    const owner = await node(h.knowledge, 'Deploy Runbook', h.projectScope, 'doc');
    const other = await node(h.knowledge, 'Release Train', h.projectScope, 'process');
    const third = await node(h.knowledge, 'Rollback Plan', h.projectScope, 'doc');
    const pinnedResource = await node(h.knowledge, 'pinned', h.projectScope, 'system');
    const solo = await record(h.knowledge, owner, 'Runbook owner is the release captain.', h.projectScope, 't-1');
    const pair = await record(h.knowledge, owner, 'Ships on the [[Release Train]].', h.projectScope, 't-1');
    const trio = await record(
      h.knowledge,
      owner,
      'Coordinates [[Release Train]] with [[Rollback Plan]].',
      h.projectScope,
      't-1',
    );
    const pin = await record(h.knowledge, pinnedResource, 'Always run [[Rollback Plan]] first.', h.projectScope, 't-1');

    const { body } = await graph(h);
    expect(body.records).toEqual([]);
    expect(body.edges).toHaveLength(1);

    const detail = await nodeDetail(h, owner.id);
    expect(detail.status).toBe(200);
    expect(detail.body.records.map(item => item.id).sort()).toEqual([solo.id, pair.id].sort());
  });

  it('does not reveal a selected scope node through its own identity', async () => {
    const h = await createHarness();
    const scopeId = h.projectScope.at(-1)!;
    const scopeNode = await h.knowledge.getNode(scopeId);
    await record(h.knowledge, scopeNode!, 'This project scope owns the selected policy.', h.projectScope);

    const detail = await nodeDetail(h, scopeId, `?scopeId=${scopeId}`);

    expect(detail.status).toBe(404);
    expect(detail.body).toEqual({ error: 'node_not_found' });
  });

  // 8
  it('fails closed: a caller from another org cannot read the graph', async () => {
    const h = await createHarness();
    await node(h.knowledge, 'Secret Entity', h.projectScope);
    const outsider = new Hono();
    outsider.use('*', async (context, next) => {
      context.set('factoryAuthUser' as never, { workosId: 'intruder', organizationId: OTHER_ORG } as never);
      await next();
    });
    // Same route module + storage, different caller org: the project lookup 404s.
    const seed = await createFactoryStorageForTests();
    mountApiRoutes(
      outsider as never,
      new KnowledgeRoutes({
        auth: fakeRouteAuth(),
        projects: seed.projects,
        knowledge: async () => instanceOver(h.knowledge),
      }).routes(),
    );
    const response = await outsider.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    expect(response.status).toBe(404);
  });

  // 9
  it('404s the entity endpoint for an out-of-scope entityId (IDOR)', async () => {
    const victim = await createHarness();
    const secret = await node(victim.knowledge, 'Victim Entity', victim.projectScope);
    // Attacker has their own valid project in another org but shares the store.
    const attacker = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'intruder', organizationId: OTHER_ORG },
      knowledge: victim.knowledge,
    });
    const { status } = await nodeDetail(attacker, secret.id);
    expect(status).toBe(404);
  });

  // 10
  it('merges listKnowledgeAbout/listKnowledgeMentioning deduped and returns metadata.reason', async () => {
    const h = await createHarness();
    const target = await node(h.knowledge, 'Target Entity', h.projectScope);
    const other = await node(h.knowledge, 'Other Entity', h.projectScope);
    const owned = await record(h.knowledge, target, 'Owned fact.', h.projectScope, 'thread-a', {
      reason: 'costly to rediscover',
    });
    const mention = await record(h.knowledge, other, 'Mentions [[Target Entity]].', h.projectScope);

    const { status, body } = await nodeDetail(h, target.id);
    expect(status).toBe(200);
    expect(body.records.map(f => f.id)).toEqual([owned.id, mention.id]);
    expect(body.records[0]).toMatchObject({ relation: 'owned', metadata: { reason: 'costly to rediscover' } });
    expect(body.records[1]).toMatchObject({ relation: 'mentions' });
  });

  // 11
  it('excludes deleted facts', async () => {
    const h = await createHarness();
    const source = await node(h.knowledge, 'Source', h.projectScope);
    await node(h.knowledge, 'Linked', h.projectScope);
    const created = await record(h.knowledge, source, 'Links [[Linked]].', h.projectScope);
    await h.knowledge.deleteRecord({ id: created.id, deletedBy: 'test' });

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(0);
    expect(body.nodes.find(node => node.id === source.id)?.recordCount).toBe(0);
  });

  // 12
  it('moves the change cursor when a fact is appended', async () => {
    const h = await createHarness();
    const source = await node(h.knowledge, 'Cursor Entity', h.projectScope);
    const before = (await graph(h)).body.version;
    await record(h.knowledge, source, 'New fact.', h.projectScope);
    const after = (await graph(h)).body.version;
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  // 13
  it('dedupes the resolution fallback per unique name and scope', async () => {
    const h = await createHarness();
    const source = await node(h.knowledge, 'Fallback Source', h.projectScope);
    const seeded = await Promise.all([
      record(h.knowledge, source, 'First fact.', h.projectScope),
      record(h.knowledge, source, 'Second fact.', h.projectScope),
      record(h.knowledge, source, 'Third fact.', h.projectScope),
    ]);
    const seededIds = new Set(seeded.map(item => item.id));
    const listRecords = h.knowledge.listRecords.bind(h.knowledge);
    vi.spyOn(h.knowledge, 'listRecords').mockImplementation(async input => {
      const result = await listRecords(input);
      return {
        ...result,
        records: result.records.map(item => (seededIds.has(item.id) ? { ...item, text: 'See [[Mystery]].' } : item)),
      };
    });
    const spy = vi.spyOn(h.knowledge, 'resolveNode').mockResolvedValue(null);

    await graph(h);
    const mysteryLookups = spy.mock.calls.filter(([input]) => input.name.toLocaleLowerCase() === 'mystery');
    expect(mysteryLookups).toHaveLength(1);
  });

  // 14
  it('resolves a name identically whether or not its target is in the window', async () => {
    const db = new InMemoryDB();
    const store = new InMemoryKnowledgeStorage({ db });
    const wide = await createHarness({ knowledge: store, limits: { maxNodes: 10 } });
    const source = await node(store, 'A source entity', wide.projectScope);
    const target = await node(store, 'Z target entity', wide.projectScope);
    await record(store, source, 'Links [[Z target entity]].', wide.projectScope);

    const wideBody = (await graph(wide)).body;
    expect(wideBody.edges).toEqual([
      expect.objectContaining({ source: source.id, target: target.id, type: 'wikilink' }),
    ]);
    expect(wideBody.outOfWindow).toHaveLength(0);

    // Same seeded fixture, narrow window: the target still RESOLVES (to the
    // same entity), it just falls out of the node window.
    const narrow = await createHarness({ knowledge: store, limits: { maxNodes: 1 } });
    // narrow harness has its own project — reseed under its scope.
    const narrowSource = await node(store, 'A source entity', narrow.projectScope);
    const narrowTarget = await node(store, 'Z target entity', narrow.projectScope);
    await record(store, narrowSource, 'Links [[Z target entity]].', narrow.projectScope);
    const narrowBody = (await graph(narrow)).body;
    expect(narrowBody.nodes.map(node => node.id)).toEqual([narrowSource.id]);
    expect(narrowBody.edges).toHaveLength(0);
    expect(narrowBody.outOfWindow).toEqual([
      { id: narrowTarget.id, name: 'Z target entity', scope: narrow.projectScope, rung: 'resource' },
    ]);
    expect(narrowBody.unresolvedCapped.count).toBe(0);
  });

  // 15
  it('reports unique unknown names beyond the fallback cap as unresolvedCapped, not dangling', async () => {
    const h = await createHarness({ limits: { maxFallbackLookups: 1 } });
    const source = await node(h.knowledge, 'Capped Source', h.projectScope);
    const seeded = await record(h.knowledge, source, 'Capped fact.', h.projectScope);
    const listRecords = h.knowledge.listRecords.bind(h.knowledge);
    vi.spyOn(h.knowledge, 'listRecords').mockImplementation(async input => {
      const result = await listRecords(input);
      return {
        ...result,
        records: result.records.map(item =>
          item.id === seeded.id ? { ...item, text: 'Sees [[Ghost One]] then [[Ghost Two]].' } : item,
        ),
      };
    });
    vi.spyOn(h.knowledge, 'resolveNode').mockResolvedValue(null);

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(0);
    expect(body.unresolvedCapped.count).toBe(1);
    expect(body.unresolvedCapped.names).toEqual(['Ghost Two']);
  });

  // 16
  it('thread view ADDS the thread rung without swapping the project baseline; the default view omits thread facts', async () => {
    const h = await createHarness();
    const baseline = await node(h.knowledge, 'Baseline Entity', h.projectScope);
    const threadEntity = await node(h.knowledge, 'Thread Entity', h.threadScope('t-16'));
    await record(h.knowledge, threadEntity, 'Thread-scoped capture.', h.threadScope('t-16'), 't-16');

    const defaultView = (await graph(h)).body;
    expect(defaultView.nodes.map(node => node.id)).toEqual([baseline.id]);

    const threadView = (await graph(h, '?threadId=t-16')).body;
    expect(threadView.nodes.map(node => node.id).sort()).toEqual([baseline.id, threadEntity.id].sort());
    const baselineNode = threadView.nodes.find(node => node.id === baseline.id);
    expect(baselineNode).toMatchObject({ name: 'Baseline Entity', rung: 'resource' });
  });

  // 17
  it('404s an unknown threadId and a cross-org threadId with existing narrow-scoped facts', async () => {
    const h = await createHarness();
    await node(h.knowledge, 'Some Entity', h.projectScope);
    expect((await graph(h, '?threadId=no-such-thread')).status).toBe(404);

    // The cross-org thread's facts EXIST and are scoped project-level-or-narrower
    // under the OTHER org — proving the scope guard, not an empty-fixture accident.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledge: h.knowledge,
    });
    const foreignEntity = await node(h.knowledge, 'Foreign Entity', foreign.projectScope);
    await record(h.knowledge, foreignEntity, 'Foreign capture.', foreign.threadScope('t-foreign'), 't-foreign');
    // Sanity: the fixture is non-empty in its own org.
    expect((await graph(foreign, '?threadId=t-foreign')).status).toBe(200);

    const { status, body } = await graph(h, '?threadId=t-foreign');
    expect(status).toBe(404);
    expect((body as unknown as { view?: string }).view).toBeUndefined(); // never a silent default-view fallback
  });

  // 18
  it('validates a thread whose ONLY facts are thread-scoped (pins the candidate-scope lookup)', async () => {
    const h = await createHarness();
    const threadEntity = await node(h.knowledge, 'Solo Thread Entity', h.threadScope('t-solo'));
    const created = await record(h.knowledge, threadEntity, 'Thread-only capture.', h.threadScope('t-solo'), 't-solo');

    const { status, body } = await graph(h, '?threadId=t-solo');
    expect(status).toBe(200);
    expect(body.view).toBe('thread');
    expect(body.nodes.map(node => node.id)).toContain(threadEntity.id);
    expect(body.nodes.find(node => node.id === threadEntity.id)?.recordCount).toBe(1);
    const detail = await nodeDetail(h, threadEntity.id, '?threadId=t-solo');
    expect(detail.body.records.find(item => item.id === created.id)?.scope).toEqual(h.threadScope('t-solo'));
  });

  // 19
  it('entity endpoint: thread-scoped entity 404s without threadId, 200 with it, 404 with a cross-org threadId', async () => {
    const h = await createHarness();
    const threadEntity = await node(h.knowledge, 'Drilled Entity', h.threadScope('t-19'));
    await record(h.knowledge, threadEntity, 'Thread-scoped fact.', h.threadScope('t-19'), 't-19');

    expect((await nodeDetail(h, threadEntity.id)).status).toBe(404);

    const withThread = await nodeDetail(h, threadEntity.id, '?threadId=t-19');
    expect(withThread.status).toBe(200);
    expect(withThread.body.records).toHaveLength(1);
    expect(withThread.body.records[0]).toMatchObject({ rung: 'thread', sourceThreadId: 't-19' });

    // Cross-org thread: seeded under the other org, requested from ours.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledge: h.knowledge,
    });
    const foreignEntity = await node(h.knowledge, 'Foreign Holder', foreign.projectScope);
    await record(h.knowledge, foreignEntity, 'Foreign fact.', foreign.threadScope('t-x19'), 't-x19');
    expect((await nodeDetail(h, threadEntity.id, '?threadId=t-x19')).status).toBe(404);
  });

  it('does not expose storage record or source-thread identifiers in activity projections', async () => {
    const h = await createHarness();
    const entity = await node(h.knowledge, 'Activity Entity', h.projectScope);
    const created = await record(h.knowledge, entity, 'Activity fact.', h.projectScope, 'private-thread-id');
    await h.knowledge.deleteRecord({ id: created.id, deletedBy: 'test' });

    const response = await activity(h);
    expect(response.status).toBe(200);
    expect(response.body.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain(created.id);
    expect(JSON.stringify(response.body)).not.toContain('private-thread-id');
    // Events targeting the deleted record are excluded entirely — never
    // returned with a blanked scope.
    expect(response.body.events).not.toContainEqual(expect.objectContaining({ scope: [] }));
  });

  it('authorizes activity targets before window shaping so a hidden backlog cannot displace visible events', async () => {
    const h = await createHarness();
    const visible = await node(h.knowledge, 'Visible Service', h.projectScope);
    await record(h.knowledge, visible, 'Visible evidence', h.projectScope);

    // Flood the newest end of the activity log with events whose targets are
    // invisible from the project view: records appended in-view, then rescoped
    // into an unrelated thread. The append EVENT stays in the activity window,
    // so only authorize-before-limit keeps them from blanking or displacing.
    const flood = await node(h.knowledge, 'Flood Node', h.projectScope);
    for (let i = 0; i < 120; i++) {
      const flooded = await record(h.knowledge, flood, `Flood ${i}`, h.projectScope);
      const hiddenScopeIds = await scopePathIds(h.knowledge, h.threadScope('other-thread'));
      await h.knowledge.setRecordScopes({
        id: flooded.id,
        version: flooded.version,
        scopeIds: [hiddenScopeIds.at(-1)!],
        contextScopeId: hiddenScopeIds.at(-1),
      });
    }

    const response = await activity(h);
    expect(response.status).toBe(200);
    // Only the visible node/record events remain — hidden-target events are
    // excluded BEFORE the window fills, so they cannot push visible events out.
    expect(response.body.events.length).toBeGreaterThan(0);
    expect(response.body.events.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(response.body)).not.toContain('other-thread');
    for (const event of response.body.events as Array<{ scope: unknown[] }>) {
      expect(event.scope.length).toBeGreaterThan(0);
    }
  });

  it('lists registered importers and returns project-filtered run details to organization administrators', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [{ id: 'calendar', handler: async () => {} }],
    });
    const h = await createHarness({ knowledgeRuntime: runtime });
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: `resource:${h.projectId}` });
    const run = await runtime.createImportRun({
      id: 'run-failed',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await runtime.updateImportRun({ id: run.id, status: 'running' });
    await runtime.updateImportRun({ id: run.id, status: 'failed', error: 'private\u0000 failure' });
    const foreignRun = await runtime.createImportRun({
      id: 'run-foreign',
      importerId: 'calendar',
      binding: knowledgeImporterBindingKey({
        source: 'calendar:foreign',
        scope: 'resource:00000000-0000-4000-8000-000000000099',
      }),
      importKind: 'static',
      triggerKind: 'programmatic',
    });

    const importers = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/importers`);
    expect(importers.status).toBe(200);
    await expect(importers.json()).resolves.toMatchObject({
      importers: [
        {
          id: 'calendar',
          importKind: 'static',
          triggers: ['programmatic'],
          lastRun: {
            id: run.id,
            source: 'calendar:primary',
            scope: `resource:${h.projectId}`,
            status: 'failed',
            error: 'private  failure',
          },
        },
      ],
    });

    const runs = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs?status=failed&trigger=programmatic`,
    );
    expect(runs.status).toBe(200);
    const runsBody = await runs.json();
    expect(runsBody).toMatchObject({ runs: [{ id: run.id, status: 'failed' }] });
    expect(JSON.stringify(runsBody)).not.toContain(foreignRun.id);

    const detail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${run.id}`,
    );
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ run: { id: run.id }, activity: [] });
    const foreignDetail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${foreignRun.id}`,
    );
    expect(foreignDetail.status).toBe(404);
  });

  it('applies trigger filters before run pagination', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [
        {
          id: 'calendar',
          triggers: {
            cron: { schedule: '* * * * *', bindings: [{ source: 'calendar:primary', scope: 'resource:any' }] },
          },
          handler: async () => {},
        },
      ],
    });
    const h = await createHarness({ knowledgeRuntime: runtime });
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: `resource:${h.projectId}` });
    const expected = await runtime.createImportRun({
      id: 'programmatic-run',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    for (let index = 0; index < 101; index += 1) {
      await runtime.createImportRun({
        id: `cron-run-${String(index).padStart(3, '0')}`,
        importerId: 'calendar',
        binding,
        importKind: 'static',
        triggerKind: 'cron',
      });
    }

    const response = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs?trigger=programmatic`,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ runs: [{ id: expected.id }] });
  });

  it('gates importer run metadata at organization-admin trust', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [{ id: 'calendar', handler: async () => {} }],
    });
    const h = await createHarness({ knowledgeRuntime: runtime, isOrganizationAdmin: async () => false });

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/importers`);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
  });
});
