import { InMemoryDB, InMemoryKnowledgeStorage } from '@mastra/core/storage';
import type { KnowledgeEntity, KnowledgeScope, KnowledgeStorage } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { KnowledgeEntityPayload, KnowledgeGraphPayload, KnowledgeRouteLimits } from './knowledge.js';
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

async function entity(
  store: KnowledgeStorage,
  name: string,
  scope: KnowledgeScope,
  kind = 'concept',
): Promise<KnowledgeEntity> {
  return store.createEntity({ name, kind, scope });
}

async function fact(
  store: KnowledgeStorage,
  parent: KnowledgeEntity,
  text: string,
  scope: KnowledgeScope,
  sourceThreadId = 'thread-a',
  metadata?: Record<string, unknown>,
  options: {
    /**
     * Where `appendFact`'s mention pass auto-creates entities for unresolved
     * wikilinks. Tests that need a GENUINELY dangling name point this at a
     * thread scope invisible from the view under test (downward invisibility —
     * the only way a wikilink stays unresolved, since capture auto-creates).
     */
    autoCreateScope?: KnowledgeScope;
  } = {},
) {
  return store.appendFact({
    parentEntityId: parent.id,
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

async function entityDetail(
  h: Harness,
  entityId: string,
  query = '',
): Promise<{ status: number; body: KnowledgeEntityPayload }> {
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/entities/${entityId}${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeEntityPayload };
}

describe('KnowledgeRoutes', () => {
  // 1
  it('returns entities and derived wikilink/parent edges from seeded facts', async () => {
    const h = await createHarness();
    const service = await entity(h.knowledge, 'Payments Service', h.projectScope, 'service');
    const runbook = await entity(h.knowledge, 'Deploy Runbook', h.projectScope, 'doc');
    await fact(h.knowledge, service, 'Deploys follow the [[Deploy Runbook]] steps.', h.projectScope);

    const { status, body } = await graph(h);
    expect(status).toBe(200);
    expect(body.view).toBe('project');
    expect(body.nodes.map(node => node.id).sort()).toEqual([service.id, runbook.id].sort());
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: service.id, target: runbook.id, type: 'wikilink' });
    expect(body.nodes.find(node => node.id === service.id)?.factCount).toBe(1);
    expect(body.truncated).toBe(false);
  });

  // 2
  it('yields a real edge for a cross-rung mention (thread fact linking an org entity) in the thread view', async () => {
    const h = await createHarness();
    const orgEntity = await entity(h.knowledge, 'Org Concept', h.orgScope);
    const threadEntity = await entity(h.knowledge, 'Session Note', h.threadScope('t-1'));
    await fact(h.knowledge, threadEntity, 'Relates to [[Org Concept]].', h.threadScope('t-1'), 't-1');

    const { status, body } = await graph(h, '?threadId=t-1');
    expect(status).toBe(200);
    expect(body.view).toBe('thread');
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: threadEntity.id, target: orgEntity.id, type: 'wikilink' });
  });

  // 3
  it('resolves a case-mismatched wikilink', async () => {
    const h = await createHarness();
    const source = await entity(h.knowledge, 'Source Entity', h.projectScope);
    const target = await entity(h.knowledge, 'CamelCase Name', h.projectScope);
    await fact(h.knowledge, source, 'See [[camelcase name]].', h.projectScope);

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]).toMatchObject({ source: source.id, target: target.id });
  });

  // 4
  it('drops unresolvable and self links', async () => {
    const h = await createHarness();
    const solo = await entity(h.knowledge, 'Solo Entity', h.projectScope);
    await fact(
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
    const h = await createHarness({ limits: { maxEntities: 1 } });
    // Equal updatedAt → name-asc tiebreak keeps 'A window entity' in the window.
    const inWindow = await entity(h.knowledge, 'A window entity', h.projectScope);
    const outside = await entity(h.knowledge, 'Z outside entity', h.projectScope);
    await fact(h.knowledge, inWindow, 'Links [[Z outside entity]].', h.projectScope);

    const { body } = await graph(h);
    expect(body.nodes.map(node => node.id)).toEqual([inWindow.id]);
    expect(body.edges).toHaveLength(0);
    expect(body.outOfWindow).toEqual([{ id: outside.id, name: 'Z outside entity' }]);
    expect(body.unresolvedCapped.count).toBe(0);
  });

  // 6
  it('enforces the payload bound and sets the truncated flag', async () => {
    const h = await createHarness({ limits: { maxEntities: 2 } });
    await entity(h.knowledge, 'One', h.projectScope);
    await entity(h.knowledge, 'Two', h.projectScope);
    await entity(h.knowledge, 'Three', h.projectScope);

    const { body } = await graph(h);
    expect(body.nodes).toHaveLength(2);
    expect(body.truncated).toBe(true);
  });

  // 7
  it('excludes the reserved pinned entity from nodes while pinned-fact wikilinks drive the accent, per rung', async () => {
    const h = await createHarness();
    const accented = await entity(h.knowledge, 'Critical Service', h.projectScope, 'service');
    const threadAccented = await entity(h.knowledge, 'Session Focus', h.threadScope('t-pin'));
    const pinnedResource = await entity(h.knowledge, 'pinned', h.projectScope, 'system');
    const pinnedThread = await entity(h.knowledge, 'pinned', h.threadScope('t-pin'), 'system');
    await fact(h.knowledge, pinnedResource, 'Always check [[Critical Service]] health.', h.projectScope, 't-any');
    await fact(h.knowledge, pinnedThread, 'This session tracks [[Session Focus]].', h.threadScope('t-pin'), 't-pin');

    const defaultView = (await graph(h)).body;
    expect(defaultView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(defaultView.nodes.find(node => node.id === accented.id)?.pinned).toBe(true);
    expect(defaultView.pinCensus).toEqual({ resource: 1, thread: null });
    // The thread-scoped pin is invisible in the default view.
    expect(defaultView.nodes.some(node => node.id === threadAccented.id)).toBe(false);

    const threadView = (await graph(h, '?threadId=t-pin')).body;
    expect(threadView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(threadView.nodes.find(node => node.id === threadAccented.id)?.pinned).toBe(true);
    expect(threadView.nodes.find(node => node.id === accented.id)?.pinned).toBe(true);
    expect(threadView.pinCensus).toEqual({ resource: 1, thread: 1 });
  });

  // 8
  it('fails closed: a caller from another org cannot read the graph', async () => {
    const h = await createHarness();
    await entity(h.knowledge, 'Secret Entity', h.projectScope);
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
    const secret = await entity(victim.knowledge, 'Victim Entity', victim.projectScope);
    // Attacker has their own valid project in another org but shares the store.
    const attacker = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'intruder', organizationId: OTHER_ORG },
      knowledge: victim.knowledge,
    });
    const { status } = await entityDetail(attacker, secret.id);
    expect(status).toBe(404);
  });

  // 10
  it('merges factsAbout/factsTouching deduped and returns metadata.reason', async () => {
    const h = await createHarness();
    const target = await entity(h.knowledge, 'Target Entity', h.projectScope);
    const other = await entity(h.knowledge, 'Other Entity', h.projectScope);
    const owned = await fact(h.knowledge, target, 'Owned fact.', h.projectScope, 'thread-a', {
      reason: 'costly to rediscover',
    });
    const mention = await fact(h.knowledge, other, 'Mentions [[Target Entity]].', h.projectScope);

    const { status, body } = await entityDetail(h, target.id);
    expect(status).toBe(200);
    expect(body.facts.map(f => f.id)).toEqual([owned.id, mention.id]);
    expect(body.facts[0]).toMatchObject({ relation: 'owned', metadata: { reason: 'costly to rediscover' } });
    expect(body.facts[1]).toMatchObject({ relation: 'mentions' });
  });

  // 11
  it('excludes deleted facts', async () => {
    const h = await createHarness();
    const source = await entity(h.knowledge, 'Source', h.projectScope);
    await entity(h.knowledge, 'Linked', h.projectScope);
    const created = await fact(h.knowledge, source, 'Links [[Linked]].', h.projectScope);
    await h.knowledge.removeFact({ id: created.id, deletedBy: 'test' });

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(0);
    expect(body.nodes.find(node => node.id === source.id)?.factCount).toBe(0);
  });

  // 12
  it('moves the change cursor when a fact is appended', async () => {
    const h = await createHarness();
    const source = await entity(h.knowledge, 'Cursor Entity', h.projectScope);
    const before = (await graph(h)).body.version;
    await fact(h.knowledge, source, 'New fact.', h.projectScope);
    const after = (await graph(h)).body.version;
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  // 13
  it('dedupes the resolution fallback per unique name and scope', async () => {
    const h = await createHarness();
    const source = await entity(h.knowledge, 'Fallback Source', h.projectScope);
    const hidden = { autoCreateScope: h.threadScope('t-hidden') };
    await fact(h.knowledge, source, 'First [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await fact(h.knowledge, source, 'Second [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await fact(h.knowledge, source, 'Third [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    const spy = vi.spyOn(h.knowledge, 'resolveEntity');

    await graph(h);
    const mysteryLookups = spy.mock.calls.filter(([input]) => input.name.toLocaleLowerCase() === 'mystery');
    expect(mysteryLookups).toHaveLength(1);
  });

  // 14
  it('resolves a name identically whether or not its target is in the window', async () => {
    const db = new InMemoryDB();
    const store = new InMemoryKnowledgeStorage({ db });
    const wide = await createHarness({ knowledge: store, limits: { maxEntities: 10 } });
    const source = await entity(store, 'A source entity', wide.projectScope);
    const target = await entity(store, 'Z target entity', wide.projectScope);
    await fact(store, source, 'Links [[Z target entity]].', wide.projectScope);

    const wideBody = (await graph(wide)).body;
    expect(wideBody.edges).toEqual([
      expect.objectContaining({ source: source.id, target: target.id, type: 'wikilink' }),
    ]);
    expect(wideBody.outOfWindow).toHaveLength(0);

    // Same seeded fixture, narrow window: the target still RESOLVES (to the
    // same entity), it just falls out of the node window.
    const narrow = await createHarness({ knowledge: store, limits: { maxEntities: 1 } });
    // narrow harness has its own project — reseed under its scope.
    const narrowSource = await entity(store, 'A source entity', narrow.projectScope);
    const narrowTarget = await entity(store, 'Z target entity', narrow.projectScope);
    await fact(store, narrowSource, 'Links [[Z target entity]].', narrow.projectScope);
    const narrowBody = (await graph(narrow)).body;
    expect(narrowBody.nodes.map(node => node.id)).toEqual([narrowSource.id]);
    expect(narrowBody.edges).toHaveLength(0);
    expect(narrowBody.outOfWindow).toEqual([{ id: narrowTarget.id, name: 'Z target entity' }]);
    expect(narrowBody.unresolvedCapped.count).toBe(0);
  });

  // 15
  it('reports unique unknown names beyond the fallback cap as unresolvedCapped, not dangling', async () => {
    const h = await createHarness({ limits: { maxFallbackLookups: 1 } });
    const source = await entity(h.knowledge, 'Capped Source', h.projectScope);
    await fact(h.knowledge, source, 'Sees [[Ghost One]] then [[Ghost Two]].', h.projectScope, 'thread-a', undefined, {
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
    const baseline = await entity(h.knowledge, 'Baseline Entity', h.projectScope);
    const threadEntity = await entity(h.knowledge, 'Thread Entity', h.threadScope('t-16'));
    await fact(h.knowledge, threadEntity, 'Thread-scoped capture.', h.threadScope('t-16'), 't-16');

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
    await entity(h.knowledge, 'Some Entity', h.projectScope);
    expect((await graph(h, '?threadId=no-such-thread')).status).toBe(404);

    // The cross-org thread's facts EXIST and are scoped project-level-or-narrower
    // under the OTHER org — proving the scope guard, not an empty-fixture accident.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledge: h.knowledge,
    });
    const foreignEntity = await entity(h.knowledge, 'Foreign Entity', foreign.projectScope);
    await fact(h.knowledge, foreignEntity, 'Foreign capture.', foreign.threadScope('t-foreign'), 't-foreign');
    // Sanity: the fixture is non-empty in its own org.
    expect((await graph(foreign, '?threadId=t-foreign')).status).toBe(200);

    const { status, body } = await graph(h, '?threadId=t-foreign');
    expect(status).toBe(404);
    expect((body as unknown as { view?: string }).view).toBeUndefined(); // never a silent default-view fallback
  });

  // 18
  it('validates a thread whose ONLY facts are thread-scoped (pins the candidate-scope lookup)', async () => {
    const h = await createHarness();
    const threadEntity = await entity(h.knowledge, 'Solo Thread Entity', h.threadScope('t-solo'));
    const created = await fact(h.knowledge, threadEntity, 'Thread-only capture.', h.threadScope('t-solo'), 't-solo');

    const { status, body } = await graph(h, '?threadId=t-solo');
    expect(status).toBe(200);
    expect(body.view).toBe('thread');
    expect(body.nodes.map(node => node.id)).toContain(threadEntity.id);
    expect(body.nodes.find(node => node.id === threadEntity.id)?.factCount).toBe(1);
    expect(created.scope).toEqual(h.threadScope('t-solo'));
  });

  // 19
  it('entity endpoint: thread-scoped entity 404s without threadId, 200 with it, 404 with a cross-org threadId', async () => {
    const h = await createHarness();
    const threadEntity = await entity(h.knowledge, 'Drilled Entity', h.threadScope('t-19'));
    await fact(h.knowledge, threadEntity, 'Thread-scoped fact.', h.threadScope('t-19'), 't-19');

    expect((await entityDetail(h, threadEntity.id)).status).toBe(404);

    const withThread = await entityDetail(h, threadEntity.id, '?threadId=t-19');
    expect(withThread.status).toBe(200);
    expect(withThread.body.facts).toHaveLength(1);
    expect(withThread.body.facts[0]).toMatchObject({ rung: 'thread', sourceThreadId: 't-19' });

    // Cross-org thread: seeded under the other org, requested from ours.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledge: h.knowledge,
    });
    const foreignEntity = await entity(h.knowledge, 'Foreign Holder', foreign.projectScope);
    await fact(h.knowledge, foreignEntity, 'Foreign fact.', foreign.threadScope('t-x19'), 't-x19');
    expect((await entityDetail(h, threadEntity.id, '?threadId=t-x19')).status).toBe(404);
  });
});
