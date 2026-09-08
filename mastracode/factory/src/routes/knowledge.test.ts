import { InMemoryDB, InMemoryKnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgeNode, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { KnowledgeNodePayload, KnowledgeGraphPayload, KnowledgeRouteLimits } from './knowledge.js';
import { KnowledgeRoutes } from './knowledge.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

interface Harness {
  app: Hono;
  knowledge: KnowledgeStorage;
  projectId: string;
  orgScope: KnowledgeScope;
  projectScope: KnowledgeScope;
  threadScope: (threadId: string) => KnowledgeScope;
}

async function createHarness(
  options: {
    limits?: Partial<KnowledgeRouteLimits>;
    user?: { workosId: string; organizationId?: string };
    orgId?: string;
    knowledge?: KnowledgeStorage;
  } = {},
): Promise<Harness> {
  const orgId = options.orgId ?? ORG;
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId, userId: 'user-1', input: { name: 'Graph project' } });
  const knowledge = options.knowledge ?? new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth(),
    projects: seed.projects,
    knowledge: async () => knowledge,
    ...(options.limits ? { limits: options.limits } : {}),
  }).routes();
  const app = new Hono();
  const user = options.user ?? { workosId: 'user-1', organizationId: orgId };
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, routes);
  const projectScope: KnowledgeScope = [`org:${orgId}`, `resource:${project.id}`];
  return {
    app,
    knowledge,
    projectId: project.id,
    orgScope: [`org:${orgId}`],
    projectScope,
    threadScope: threadId => [...projectScope, `thread:${threadId}`],
  };
}

async function node(
  store: KnowledgeStorage,
  name: string,
  scope: KnowledgeScope,
  kind = 'concept',
  description?: string,
): Promise<KnowledgeNode> {
  return store.createNode({ name, kind, scope, ...(description !== undefined ? { description } : {}) });
}

async function record(
  store: KnowledgeStorage,
  parent: KnowledgeNode,
  text: string,
  scope: KnowledgeScope,
  sourceThreadId = 'thread-a',
  metadata?: Record<string, unknown>,
  options: {
    /**
     * Where `appendKnowledge`'s mention pass auto-creates nodes for unresolved
     * wikilinks. Tests that need a genuinely dangling name point this at a
     * thread scope invisible from the view under test (downward invisibility —
     * the only way a wikilink stays unresolved, since capture auto-creates).
     */
    autoCreateScope?: KnowledgeScope;
  } = {},
) {
  return store.appendKnowledge({
    node: parent,
    text,
    scope,
    sourceThreadId,
    metadata,
    resolutionScope: options.autoCreateScope ?? scope,
    defaultScope: options.autoCreateScope ?? scope,
  });
}

async function graph(h: Harness, query = ''): Promise<{ status: number; body: KnowledgeGraphPayload }> {
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/graph${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeGraphPayload };
}

async function nodeDetail(
  h: Harness,
  entityId: string,
  query = '',
): Promise<{ status: number; body: KnowledgeNodePayload }> {
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/nodes/${entityId}${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeNodePayload };
}

describe('KnowledgeRoutes', () => {
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
    const contentful = await h.knowledge.createNode({
      name: 'Contentful',
      kind: 'doc',
      scope: h.projectScope,
      content: 'Long-form body that must never appear in the graph payload. '.repeat(20),
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
    expect(body.outOfWindow).toEqual([{ id: outside.id, name: 'Z outside entity' }]);
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
    const byId = new Map(body.records.map(memory => [memory.id, memory]));
    // Arity 1: dot material — just the owner.
    expect(byId.get(solo.id)).toMatchObject({ nodeIds: [owner.id], pinned: false });
    // Arity 2: line material — owner first, then the wikilink target.
    expect(byId.get(pair.id)).toMatchObject({ nodeIds: [owner.id, other.id], pinned: false });
    // Arity 3: junction material.
    expect(byId.get(trio.id)).toMatchObject({ nodeIds: [owner.id, other.id, third.id] });
    // Pins omit the hidden reserved owner — arity from wikilink targets only.
    expect(byId.get(pin.id)).toMatchObject({ nodeIds: [third.id], pinned: true });
    expect(byId.get(pin.id)?.text).toContain('Rollback Plan');
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
        knowledge: async () => h.knowledge,
      }).routes(),
    );
    const response = await outsider.request(`/web/factory/projects/${h.projectId}/knowledge/graph`);
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
    await h.knowledge.removeKnowledge({ id: created.id, deletedBy: 'test' });

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
    const hidden = { autoCreateScope: h.threadScope('t-hidden') };
    await record(h.knowledge, source, 'First [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await record(h.knowledge, source, 'Second [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await record(h.knowledge, source, 'Third [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    const spy = vi.spyOn(h.knowledge, 'resolveNode');

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
    expect(narrowBody.outOfWindow).toEqual([{ id: narrowTarget.id, name: 'Z target entity' }]);
    expect(narrowBody.unresolvedCapped.count).toBe(0);
  });

  // 15
  it('reports unique unknown names beyond the fallback cap as unresolvedCapped, not dangling', async () => {
    const h = await createHarness({ limits: { maxFallbackLookups: 1 } });
    const source = await node(h.knowledge, 'Capped Source', h.projectScope);
    await record(h.knowledge, source, 'Sees [[Ghost One]] then [[Ghost Two]].', h.projectScope, 'thread-a', undefined, {
      autoCreateScope: h.threadScope('t-hidden'),
    });

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
    expect(created.scope).toEqual(h.threadScope('t-solo'));
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
});
