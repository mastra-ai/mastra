import { Knowledge } from '@mastra/core/knowledge';
import type { MaterializeKnowledgeScopeInput } from '@mastra/core/knowledge';
import { InMemoryStore, knowledgeImporterBindingKey } from '@mastra/core/storage';
import type { KnowledgeNode, KnowledgeScopeIds, KnowledgeStorage } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type {
  KnowledgeNodePayload,
  KnowledgeAccessProfileResolver,
  KnowledgeGraphPayload,
  KnowledgeRouteLimits,
  KnowledgeScopeTreePayload,
} from './knowledge.js';
import { KnowledgeRoutes } from './knowledge.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

interface Harness {
  app: Hono;
  knowledge: KnowledgeStorage;
  runtime: Knowledge;
  projectId: string;
  orgScope: KnowledgeScopeIds;
  projectScope: KnowledgeScopeIds;
  allScopeIds: string[];
  threadScope: (threadId: string) => Promise<KnowledgeScopeIds>;
}

async function createHarness(
  options: {
    limits?: Partial<KnowledgeRouteLimits>;
    user?: { workosId: string; organizationId?: string };
    orgId?: string;
    knowledgeRuntime?: Knowledge;
    knowledgeResolver?: () => Promise<Knowledge | undefined>;
    accessProfile?: KnowledgeAccessProfileResolver;
    curatorProfileId?: string;
    isOrganizationAdmin?: (organizationId: string, userId: string) => Promise<boolean>;
  } = {},
): Promise<Harness> {
  const orgId = options.orgId ?? ORG;
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId, userId: 'user-1', input: { name: 'Graph project' } });
  const runtime = options.knowledgeRuntime ?? new Knowledge({ id: 'mastra', storage: new InMemoryStore() });
  const knowledge = await runtime.getStorageInternal();
  const routes = new KnowledgeRoutes({
    auth: fakeRouteAuth(options.isOrganizationAdmin ? { isOrganizationAdmin: options.isOrganizationAdmin } : {}),
    projects: seed.projects,
    knowledge: options.knowledgeResolver ?? (async () => runtime),
    accessProfile:
      options.accessProfile ??
      (async ({ builtInScopes, threadId }) => {
        const companion = {
          address: `${builtInScopes.resource.address}:uncurated`,
          parentAddresses: [builtInScopes.resource.address],
          contextualScopeAddress: builtInScopes.resource.address,
        };
        return {
          id: threadId ? `thread:${threadId}` : 'project',
          rootScopeAddress: builtInScopes.thread?.address ?? builtInScopes.resource.address,
          baselineScopes: [builtInScopes.org, builtInScopes.resource],
          intakeScopes: [
            ...(builtInScopes.thread ? [builtInScopes.thread] : []),
            ...(options.curatorProfileId ? [companion] : []),
          ],
          vouchedScopeAddresses: options.curatorProfileId
            ? [builtInScopes.org.address]
            : [builtInScopes.org.address, builtInScopes.resource.address],
          curationScopeAddresses: options.curatorProfileId ? [companion.address] : [],
          curatorProfileId: options.curatorProfileId,
        };
      }),
    ...(options.limits ? { limits: options.limits } : {}),
  }).routes();
  const app = new Hono();
  const user = options.user ?? { workosId: 'user-1', organizationId: orgId };
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, routes);
  const orgAddress = `org:${orgId}`;
  const resourceAddress = `resource:${project.id}`;
  const org = await runtime.materializeScope({ address: orgAddress, contextualScopeAddress: orgAddress });
  const resource = await runtime.materializeScope({
    address: resourceAddress,
    parentAddresses: [orgAddress],
    contextualScopeAddress: orgAddress,
  });
  const orgScope = [org.scopes[orgAddress]!];
  const projectScope = [...orgScope, resource.scopes[resourceAddress]!];
  const allScopeIds = [...projectScope];
  return {
    app,
    knowledge,
    runtime,
    projectId: project.id,
    orgScope,
    projectScope,
    allScopeIds,
    threadScope: async threadId => {
      const address = `resource:${project.id}:thread:${threadId}`;
      const thread = await runtime.materializeScope({
        address,
        parentAddresses: [resourceAddress],
        contextualScopeAddress: resourceAddress,
      });
      const threadScopeId = thread.scopes[address]!;
      if (!allScopeIds.includes(threadScopeId)) allScopeIds.push(threadScopeId);
      return [...projectScope, threadScopeId];
    },
  };
}

async function node(
  store: KnowledgeStorage,
  name: string,
  scopeIds: KnowledgeScopeIds,
  kind = 'concept',
  description?: string,
): Promise<KnowledgeNode> {
  return store.createNode({
    name,
    kind,
    scopeIds: [scopeIds.at(-1)!],
    ...(description !== undefined ? { metadata: { description } } : {}),
  });
}

async function record(
  store: KnowledgeStorage,
  parent: KnowledgeNode,
  text: string,
  scopeIds: KnowledgeScopeIds,
  sourceThreadId = 'thread-a',
  metadata?: Record<string, unknown>,
  options: {
    /**
     * Where record mention resolution auto-creates nodes for unresolved
     * wikilinks. Tests that need a genuinely dangling name point this at a
     * thread scope invisible from the view under test (downward invisibility —
     * the only way a wikilink stays unresolved, since capture auto-creates).
     */
    autoCreateScope?: KnowledgeScopeIds;
  } = {},
) {
  return store.createRecord({
    node: parent,
    text,
    scopeIds: [scopeIds.at(-1)!],
    source: sourceThreadId,
    metadata: { sourceThreadId, ...metadata },
    contextScopeId: scopeIds.at(-1),
    resolutionScopeIds: options.autoCreateScope ?? scopeIds,
  });
}

async function rawGraph(h: Harness, query = ''): Promise<{ status: number; body: KnowledgeGraphPayload }> {
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeGraphPayload };
}

async function graph(h: Harness, query = ''): Promise<{ status: number; body: KnowledgeGraphPayload }> {
  const result = await rawGraph(h, query);
  const ids = new Map<string, string>();
  for (const item of [...(result.body.nodes ?? []), ...(result.body.outOfWindow ?? [])]) {
    const resolved = await h.knowledge.resolveNode({ name: item.name, scopeIds: h.allScopeIds });
    if (resolved) ids.set(item.id, resolved.id);
  }
  return {
    ...result,
    body: {
      ...result.body,
      nodes: result.body.nodes?.map(item => ({ ...item, id: ids.get(item.id) ?? item.id })),
      edges: result.body.edges?.map(edge => ({
        ...edge,
        source: ids.get(edge.source) ?? edge.source,
        target: ids.get(edge.target) ?? edge.target,
      })),
      outOfWindow: result.body.outOfWindow?.map(item => ({ ...item, id: ids.get(item.id) ?? item.id })),
    },
  };
}

async function scopes(h: Harness, query = ''): Promise<{ status: number; body: KnowledgeScopeTreePayload }> {
  let requestQuery = query;
  const rawScopeId = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query).get('scopeId');
  if (rawScopeId) {
    const selected = await h.knowledge.getNode(rawScopeId);
    const rootResponse = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    const root = (await rootResponse.json()) as KnowledgeScopeTreePayload;
    const handle = [root.scope, ...root.children].find(scope => scope.name === selected?.name)?.id;
    if (handle) requestQuery = `?scopeId=${handle}`;
  }
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes${requestQuery}`);
  const body = (await response.json().catch(() => ({}))) as KnowledgeScopeTreePayload;
  for (const item of [body.scope, ...(body.children ?? [])]) {
    if (!item) continue;
    const resolved = await h.knowledge.resolveNode({ name: item.name, scopeIds: h.allScopeIds });
    if (resolved) item.id = resolved.id;
  }
  return { status: response.status, body };
}

async function activity(h: Harness, query = ''): Promise<{ status: number; body: { events: unknown[] } }> {
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/activity${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as { events: unknown[] } };
}

async function nodeDetail(
  h: Harness,
  entityId: string,
  query = '',
): Promise<{ status: number; body: KnowledgeNodePayload }> {
  const internal = await h.knowledge.getNode(entityId);
  let handle = entityId;
  if (internal) {
    const subgraph = await rawGraph(h, query);
    const surfaced = subgraph.body.nodes?.find(item => item.name === internal.name);
    handle = surfaced?.id ?? entityId;
  }
  const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/nodes/${handle}${query}`);
  return { status: response.status, body: (await response.json().catch(() => ({}))) as KnowledgeNodePayload };
}

describe('KnowledgeRoutes', () => {
  it('fails closed when the host has not configured a curation scope', async () => {
    const h = await createHarness();
    const treeResponse = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    const tree = (await treeResponse.json()) as KnowledgeScopeTreePayload;
    const response = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/curation/worklist?scopeId=${tree.scope.id}`,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'scope_not_found' });
  });

  it('keeps human curation reads and actions within the request principal authority', async () => {
    const h = await createHarness({ curatorProfileId: 'factory-curator' });
    const resourceAddress = `resource:${h.projectId}`;
    const companionAddress = `${resourceAddress}:uncurated`;
    const companion = await h.runtime.materializeScope({
      address: companionAddress,
      parentAddresses: [resourceAddress],
      contextualScopeAddress: resourceAddress,
    });
    const curatorPrivateAddress = `${resourceAddress}:curator-private`;
    const curatorPrivate = await h.runtime.materializeScope({
      address: curatorPrivateAddress,
      contextualScopeAddress: curatorPrivateAddress,
    });
    await h.runtime.registerCuratorProfile({
      id: 'factory-curator',
      identityScope: { address: `curator:${h.projectId}`, contextualScopeAddress: `curator:${h.projectId}` },
      grants: [
        { scopeAddress: companionAddress, role: 'readonly', canSuggest: true },
        { scopeAddress: resourceAddress, role: 'readonly', canSuggest: true },
        { scopeAddress: curatorPrivateAddress, role: 'edit' },
      ],
    });
    const companionScopeId = companion.scopes[companionAddress]!;
    const curatorPrivateScopeId = curatorPrivate.scopes[curatorPrivateAddress]!;
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: h.projectScope.at(-1)!,
      scopeRefId: h.orgScope[0]!,
      role: 'readonly',
    });
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: companionScopeId,
      scopeRefId: h.orgScope[0]!,
      role: 'readonly',
    });
    const companionNode = await h.knowledge.getNode(companionScopeId);
    h.allScopeIds.push(companionScopeId);
    const provisional = await h.knowledge.createNode({
      name: 'Provisional finding',
      kind: 'finding',
      scopeIds: [companionScopeId],
    });
    const provisionalRecord = await h.knowledge.createRecord({
      node: provisional,
      text: 'Observed in an import.',
      scopeIds: [curatorPrivateScopeId],
      source: 'github',
      metadata: { provenance: 'import:github' },
    });
    const sharedRecord = await h.knowledge.createRecord({
      node: provisional,
      text: 'Reported by support.',
      scopeIds: [companionScopeId],
      source: 'support',
      metadata: { provenance: 'subconscious:capture' },
    });
    for (let index = 0; index < 14; index += 1) {
      await h.knowledge.createRecord({
        node: provisional,
        text: `Additional report ${index}`,
        scopeIds: [companionScopeId],
        source: `support:${index}`,
        metadata: { provenance: index % 2 === 0 ? 'trusted' : 'untrusted' },
      });
    }
    const operatorOnly = await h.knowledge.createNode({
      name: 'Operator-only finding',
      kind: 'finding',
      scopeIds: [companionScopeId],
    });
    const curatorOnlyTarget = await h.knowledge.createNode({
      name: 'Curator-only canonical finding',
      kind: 'finding',
      scopeIds: [curatorPrivateScopeId],
    });
    const curator = h.runtime.createCurator({
      profileId: 'factory-curator',
      companionScopeId,
      contextScopeId: h.projectScope.at(-1)!,
    });
    const autonomousEvidence = await curator.listItemRecords({ nodeId: provisional.id, limit: 100 });
    expect(autonomousEvidence.records).toEqual(expect.arrayContaining([provisionalRecord, sharedRecord]));
    expect(await curator.listMergeTargets({ namePrefix: 'Curator', limit: 20 })).toEqual([curatorOnlyTarget]);

    const treeResponse = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    const tree = (await treeResponse.json()) as KnowledgeScopeTreePayload;
    const identity = await h.knowledge.getScopeAddress(`curator:${h.projectId}`);
    const curatorFrontier = await h.runtime.evaluateAccess([identity!.scopeNodeId]);
    expect(curatorFrontier.scopes[companionScopeId]?.read).toBe(true);
    const companionHandle = tree.children.find(item => item.name === companionNode?.name)?.id;
    expect(companionHandle).toBeDefined();
    const selectedTreeResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/scopes?scopeId=${companionHandle}`,
    );
    const selectedTree = (await selectedTreeResponse.json()) as KnowledgeScopeTreePayload;
    expect(selectedTree.scope).toMatchObject({ id: companionHandle, needsCuration: true });
    expect(selectedTree.curationDestination).toMatchObject({ id: tree.scope.id });
    const worklistResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/curation/worklist?scopeId=${companionHandle}`,
    );
    const worklist = (await worklistResponse.json()) as {
      items: Array<{
        id: string;
        name: string;
        version: number;
        actions: { merge: boolean; discard: boolean };
        evidence: Array<{ source?: string; provenance?: string }>;
        evidenceCursor?: string;
      }>;
    };
    expect(worklistResponse.status).toBe(200);
    expect(worklist.items).toHaveLength(2);
    expect(worklist.items.map(item => item.name).sort()).toEqual(['Operator-only finding', 'Provisional finding']);
    const provisionalItem = worklist.items.find(item => item.name === 'Provisional finding');
    expect(provisionalItem?.actions).toEqual({ merge: false, discard: false });
    expect(provisionalItem?.evidence).toHaveLength(10);
    expect(provisionalItem?.evidence.some(entry => entry.source === 'github')).toBe(false);
    expect(provisionalItem?.evidenceCursor).toBeDefined();
    expect(worklist.items.find(item => item.name === 'Operator-only finding')?.evidence).toEqual([]);
    const evidenceResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/curation/items/${provisionalItem?.id}/evidence?scopeId=${companionHandle}&cursor=${provisionalItem?.evidenceCursor}`,
    );
    expect(evidenceResponse.status).toBe(200);
    const evidencePage = (await evidenceResponse.json()) as {
      evidence: Array<{ source?: string; provenance?: string }>;
      nextCursor?: string;
    };
    expect(evidencePage.evidence).toHaveLength(5);
    expect(evidencePage.evidence.some(entry => entry.source === 'github')).toBe(false);
    expect(evidencePage.nextCursor).toBeUndefined();
    expect(await h.runtime.getNode({ id: operatorOnly.id, scopeIds: h.allScopeIds })).not.toBeNull();

    const targetsResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/curation/merge-targets?scopeId=${companionHandle}&query=Curator`,
    );
    const targets = (await targetsResponse.json()) as { targets: Array<{ id: string; version: number; name: string }> };
    expect(targetsResponse.status).toBe(200);
    expect(targets.targets).toEqual([]);

    expect(provisionalItem).toBeDefined();
    if (!provisionalItem) throw new Error('Expected the visible provisional worklist item.');
    const promoteResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/curation/actions/promote`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scopeId: companionHandle,
          nodeId: provisionalItem.id,
          version: provisionalItem.version,
          destinationScopeId: tree.scope.id,
          curatorProfileId: 'forged-client-profile',
        }),
      },
    );
    expect(promoteResponse.status).toBe(404);
    expect(await promoteResponse.json()).toEqual({ error: 'curation_not_found' });
    expect((await h.runtime.listProposals({ vouchedScopeIds: h.allScopeIds })).proposals).toEqual([]);
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

  it('returns one authorized scope-tree level without exposing private descendants', async () => {
    const h = await createHarness();
    const projectScopeId = h.projectScope.at(-1)!;
    const child = await h.knowledge.createNode({
      name: 'Payments scope',
      kind: 'feature',
      isScope: true,
      scopeIds: [projectScopeId],
    });
    await h.knowledge.createNode({ name: 'Nested scope', isScope: true, scopeIds: [child.id] });

    const rootResponse = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    const root = (await rootResponse.json()) as KnowledgeScopeTreePayload;
    expect(rootResponse.status).toBe(200);
    expect(root.scope.id).toMatch(/^kh_/);
    expect(root.scope.id).not.toBe(projectScopeId);
    expect(root.children).toHaveLength(1);
    expect(root.children[0]?.id).not.toBe(child.id);

    const nestedResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/scopes?scopeId=${root.children[0]!.id}`,
    );
    const nested = (await nestedResponse.json()) as KnowledgeScopeTreePayload;
    expect(nested.scope.name).toBe(child.name);
    expect(nested.children).toEqual([]);
  });

  it('continues scope pagination when the selected scope consumes an over-fetched slot', async () => {
    const h = await createHarness({ limits: { maxNodes: 1 } });
    const projectScopeId = h.projectScope.at(-1)!;
    const selected = await h.knowledge.getNode(projectScopeId);
    const firstChild = await h.knowledge.createNode({
      name: 'First child',
      isScope: true,
      scopeIds: [projectScopeId],
    });
    const secondChild = await h.knowledge.createNode({
      name: 'Second child',
      isScope: true,
      scopeIds: [projectScopeId],
    });
    vi.spyOn(h.runtime, 'listNodes').mockImplementationOnce(async input =>
      [selected!, firstChild, secondChild].slice(0, input.limit),
    );

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes`);
    const body = (await response.json()) as KnowledgeScopeTreePayload;

    expect(response.status).toBe(200);
    expect(body.children).toHaveLength(1);
    expect(body.nextCursor).toMatch(/^kh_/);
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
    const contentful = await h.knowledge.createNode({
      name: 'Contentful',
      kind: 'doc',
      scopeIds: [h.projectScope.at(-1)!],
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
    const threadEntity = await node(h.knowledge, 'Session Note', await h.threadScope('t-1'));
    await record(h.knowledge, threadEntity, 'Relates to [[Org Concept]].', await h.threadScope('t-1'), 't-1');

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
  it('materializes unresolved wikilinks and drops self links', async () => {
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
        autoCreateScope: await h.threadScope('t-hidden'),
      },
    );

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0]?.source).toBe(solo.id);
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
      expect.objectContaining({ id: outside.id, name: 'Z outside entity', reference: expect.stringMatching(/^kr_/) }),
    ]);
    expect(body.unresolvedCapped.count).toBe(0);
  });

  it('resolves an authorized node handle outside the current graph window', async () => {
    const h = await createHarness({ limits: { maxNodes: 1 } });
    const inWindow = await node(h.knowledge, 'A window entity', h.projectScope);
    const outside = await node(h.knowledge, 'Z outside entity', h.projectScope);
    await record(h.knowledge, inWindow, 'Links [[Z outside entity]].', h.projectScope);

    const { body } = await rawGraph(h);
    const outsideHandle = body.outOfWindow?.find(item => item.name === outside.name)?.id;
    expect(outsideHandle).toMatch(/^kh_/);

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/nodes/${outsideHandle}`);
    expect(response.status).toBe(200);
    expect((await response.json()) as KnowledgeNodePayload).toMatchObject({ node: { name: outside.name } });
  });

  it('lazily materializes host-vouched intake addresses for distinct issue, pull request, Slack, and thread views', async () => {
    const profiles = new Map<string, MaterializeKnowledgeScopeInput>();
    const h = await createHarness({
      accessProfile: async ({ request }) => {
        const intake = request.headers.get('x-knowledge-intake') ?? '';
        const scope = profiles.get(intake);
        return scope ? { id: intake, rootScopeAddress: scope.address, baselineScopes: [scope] } : undefined;
      },
    });
    for (const intake of ['issue', 'pull-request', 'slack', 'thread']) {
      profiles.set(intake, {
        address: `resource:${h.projectId}:thread:${intake}`,
        contextualScopeAddress: `resource:${h.projectId}`,
        parameters: { resourceId: h.projectId, threadId: intake },
      });
      const firstTouch = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph`, {
        headers: { 'x-knowledge-intake': intake },
      });
      expect(firstTouch.status).toBe(200);
      const root = await h.knowledge.getScopeAddress(`resource:${h.projectId}:thread:${intake}`);
      expect(root).not.toBeNull();
      await h.knowledge.upsertScopeGrant({
        scopeNodeId: root!.scopeNodeId,
        scopeRefId: root!.scopeNodeId,
        role: 'readonly',
        canSuggest: false,
      });
      await node(h.knowledge, `${intake} knowledge`, [root!.scopeNodeId]);
    }

    for (const intake of profiles.keys()) {
      const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph`, {
        headers: { 'x-knowledge-intake': intake },
      });
      const text = await response.text();
      expect(response.status, text).toBe(200);
      const payload = JSON.parse(text) as KnowledgeGraphPayload;
      expect(payload.nodes.map(value => value.name)).toEqual([`${intake} knowledge`]);
    }
  });

  it('rejects an opaque node handle outside its host-vouched thread perspective', async () => {
    const h = await createHarness();
    const scopeIds = await h.threadScope('thread-a');
    const privateNode = await node(h.knowledge, 'Thread-private entity', scopeIds);
    await record(h.knowledge, privateNode, 'Thread-private fact.', scopeIds, 'thread-a');

    const otherScopeIds = await h.threadScope('thread-b');
    const otherNode = await node(h.knowledge, 'Other thread entity', otherScopeIds);
    await record(h.knowledge, otherNode, 'Other thread fact.', otherScopeIds, 'thread-b');

    const threadGraph = await rawGraph(h, '?threadId=thread-a');
    expect(threadGraph.status).toBe(200);
    const handle = threadGraph.body.nodes.find(item => item.name === 'Thread-private entity')?.id;
    expect(handle).toMatch(/^kh_/);

    const response = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/nodes/${handle}?threadId=thread-b`,
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'node_not_found' });
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
    const threadAccented = await node(h.knowledge, 'Session Focus', await h.threadScope('t-pin'));
    const pinnedResource = await node(h.knowledge, 'pinned', h.projectScope, 'system');
    const pinnedThread = await node(h.knowledge, 'pinned', await h.threadScope('t-pin'), 'system');
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
    await record(
      h.knowledge,
      pinnedThread,
      'This session tracks [[Session Focus]].',
      await h.threadScope('t-pin'),
      't-pin',
    );

    const defaultView = (await graph(h)).body;
    expect(defaultView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(defaultView.nodes.find(node => node.id === accented.id)?.pinned).toBe(true);
    const pinnedEdge = defaultView.edges.find(edge => edge.pinned);
    expect(pinnedEdge).toMatchObject({ source: relA.id, target: relB.id, pinned: true });
    expect(pinnedEdge?.recordId).toMatch(/^kh_/);
    expect(pinnedEdge?.recordId).not.toBe(relPin.id);
    expect(defaultView.nodes.find(node => node.id === relA.id)?.pinned).toBe(false);
    expect(defaultView.nodes.find(node => node.id === relB.id)?.pinned).toBe(false);
    expect(defaultView.pinCensus).toEqual({ resource: 2, thread: null });
    // The thread-scoped pin is invisible in the default view.
    expect(defaultView.nodes.some(node => node.id === threadAccented.id)).toBe(false);

    const threadView = (await graph(h, '?threadId=t-pin')).body;
    expect(threadView.nodes.some(node => node.name === 'pinned')).toBe(false);
    expect(threadView.nodes.find(node => node.id === threadAccented.id)?.pinned).toBe(true);
    expect(threadView.nodes.some(node => node.id === accented.id)).toBe(false);
    expect(threadView.pinCensus).toEqual({ resource: 0, thread: 1 });
  });

  // 7b
  it('keeps records out of the bounded subgraph and loads them on demand for node detail', async () => {
    const h = await createHarness();
    const owner = await node(h.knowledge, 'Deploy Runbook', h.projectScope, 'doc');
    await node(h.knowledge, 'Release Train', h.projectScope, 'process');
    const solo = await record(h.knowledge, owner, 'Runbook owner is the release captain.', h.projectScope, 't-1');
    const pair = await record(h.knowledge, owner, 'Ships on the [[Release Train]].', h.projectScope, 't-1');

    const { body } = await graph(h);
    expect(body.records).toEqual([]);
    expect(body.edges).toHaveLength(1);

    const detail = await nodeDetail(h, owner.id);
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    expect(detail.body.records).toHaveLength(2);
    expect(detail.body.records.map(item => item.id)).toEqual([
      expect.stringMatching(/^kh_/),
      expect.stringMatching(/^kh_/),
    ]);
    expect(detail.body.records.map(item => item.id)).not.toContain(solo.id);
    expect(detail.body.records.map(item => item.id)).not.toContain(pair.id);
  });

  it('does not reveal a selected scope node through its own identity', async () => {
    const h = await createHarness();
    const scopeId = h.projectScope.at(-1)!;
    const scopeNode = await h.knowledge.getNode(scopeId);
    await record(h.knowledge, scopeNode!, 'This project scope owns the selected policy.', h.projectScope);

    const detail = await nodeDetail(h, scopeId, `?scopeId=${scopeId}`);

    expect(detail.status).toBe(404);
    expect(detail.body).toMatchObject({ error: expect.stringMatching(/not_found$/) });
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
        accessProfile: async ({ builtInScopes }) => ({
          id: 'project',
          rootScopeAddress: builtInScopes.resource.address,
          baselineScopes: [builtInScopes.org, builtInScopes.resource],
        }),
      }).routes(),
    );
    const response = await outsider.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph`);
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
      knowledgeRuntime: victim.runtime,
    });
    const { status } = await nodeDetail(attacker, secret.id);
    expect(status).toBe(404);
  });

  // 10
  it('merges direct and mentioning records, dedupes them, and exposes filtered reasoning', async () => {
    const h = await createHarness();
    const target = await node(h.knowledge, 'Target Entity', h.projectScope);
    const other = await node(h.knowledge, 'Other Entity', h.projectScope);
    const owned = await record(h.knowledge, target, 'Owned fact.', h.projectScope, 'thread-a', {
      reason: 'costly to rediscover',
    });
    const mention = await record(h.knowledge, other, 'Mentions [[Target Entity]].', h.projectScope);

    const { status, body } = await nodeDetail(h, target.id);
    expect(status).toBe(200);
    expect(body.records.map(f => f.id)).toEqual([expect.stringMatching(/^kh_/), expect.stringMatching(/^kh_/)]);
    expect(body.records.map(f => f.id)).not.toContain(owned.id);
    expect(body.records.map(f => f.id)).not.toContain(mention.id);
    expect(body.records[0]).toMatchObject({ relation: 'owned', reason: 'costly to rediscover' });
    expect(body.records[0]).not.toHaveProperty('metadata');
    expect(body.records[0]).not.toHaveProperty('scopeIds');
    expect(body.records[1]).toMatchObject({ relation: 'mentions' });
  });

  // 11
  it('excludes deleted facts', async () => {
    const h = await createHarness();
    const source = await node(h.knowledge, 'Source', h.projectScope);
    await node(h.knowledge, 'Linked', h.projectScope);
    const created = await record(h.knowledge, source, 'Links [[Linked]].', h.projectScope);
    await h.knowledge.deleteRecord({ id: created.id, version: created.version, deletedBy: 'test' });

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
    const hidden = { autoCreateScope: await h.threadScope('t-hidden') };
    await record(h.knowledge, source, 'First [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await record(h.knowledge, source, 'Second [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    await record(h.knowledge, source, 'Third [[Mystery]].', h.projectScope, 'thread-a', undefined, hidden);
    const spy = vi.spyOn(h.knowledge, 'resolveNode');

    await rawGraph(h);
    const mysteryLookups = spy.mock.calls.filter(([input]) => input.name.toLocaleLowerCase() === 'mystery');
    expect(mysteryLookups).toHaveLength(1);
  });

  // 14
  it('resolves a name identically whether or not its target is in the window', async () => {
    const runtime = new Knowledge({ id: 'mastra', storage: new InMemoryStore() });
    const wide = await createHarness({ knowledgeRuntime: runtime, limits: { maxNodes: 10 } });
    const store = wide.knowledge;
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
    const narrow = await createHarness({ knowledgeRuntime: runtime, limits: { maxNodes: 1 } });
    // narrow harness has its own project — reseed under its scope.
    const narrowSource = await node(store, 'A source entity', narrow.projectScope);
    const narrowTarget = await node(store, 'Z target entity', narrow.projectScope);
    await record(store, narrowSource, 'Links [[Z target entity]].', narrow.projectScope);
    const narrowBody = (await graph(narrow)).body;
    expect(narrowBody.nodes.map(node => node.id)).toEqual([narrowSource.id]);
    expect(narrowBody.edges).toHaveLength(0);
    expect(narrowBody.outOfWindow).toEqual([
      expect.objectContaining({
        id: narrowTarget.id,
        name: 'Z target entity',
        reference: expect.stringMatching(/^kr_/),
      }),
    ]);
    expect(narrowBody.unresolvedCapped.count).toBe(0);
  });

  // 15
  it('reports unique unknown names beyond the fallback cap', async () => {
    const h = await createHarness({ limits: { maxFallbackLookups: 1 } });
    const source = await node(h.knowledge, 'Capped Source', h.projectScope);
    await record(h.knowledge, source, 'Sees [[Ghost One]] then [[Ghost Two]].', h.projectScope, 'thread-a', undefined, {
      autoCreateScope: await h.threadScope('t-hidden'),
    });

    const { body } = await graph(h);
    expect(body.edges).toHaveLength(1);
    expect(body.unresolvedCapped.count).toBe(1);
    expect(body.unresolvedCapped.names).toEqual(['Ghost Two']);
  });

  // 16
  it('bounds the default and thread subgraphs to their selected scopes', async () => {
    const h = await createHarness();
    const baseline = await node(h.knowledge, 'Baseline Entity', h.projectScope);
    const threadEntity = await node(h.knowledge, 'Thread Entity', await h.threadScope('t-16'));
    await record(h.knowledge, threadEntity, 'Thread-scoped capture.', await h.threadScope('t-16'), 't-16');

    const defaultView = (await graph(h)).body;
    expect(defaultView.nodes.map(node => node.id)).toEqual([baseline.id]);

    const threadView = (await graph(h, '?threadId=t-16')).body;
    expect(threadView.nodes.map(node => node.id)).toEqual([threadEntity.id]);
    expect(threadView.nodes.some(node => node.id === baseline.id)).toBe(false);
  });

  // 17
  it('404s an unknown threadId and a cross-org threadId with existing narrow-scoped facts', async () => {
    const h = await createHarness();
    await node(h.knowledge, 'Some Entity', h.projectScope);
    expect((await graph(h, '?threadId=no-such-thread')).status).toBe(404);
    expect(await h.knowledge.getScopeAddress(`resource:${h.projectId}:thread:no-such-thread`)).toBeNull();

    // The cross-org thread's facts EXIST and are scoped project-level-or-narrower
    // under the OTHER org — proving the scope guard, not an empty-fixture accident.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledgeRuntime: h.runtime,
    });
    const foreignEntity = await node(h.knowledge, 'Foreign Entity', foreign.projectScope);
    await record(h.knowledge, foreignEntity, 'Foreign capture.', await foreign.threadScope('t-foreign'), 't-foreign');
    // Sanity: the fixture is non-empty in its own org.
    expect((await graph(foreign, '?threadId=t-foreign')).status).toBe(200);

    const { status, body } = await graph(h, '?threadId=t-foreign');
    expect(status).toBe(404);
    expect((body as unknown as { view?: string }).view).toBeUndefined(); // never a silent default-view fallback
  });

  it('does not materialize scopes for failed selected-scope or node reads', async () => {
    const h = await createHarness();
    const orgOnly = await node(h.knowledge, 'Org only', h.orgScope);
    const materialize = vi.spyOn(h.runtime, 'materializeScope');
    const missingScopeId = '10000000-0000-4000-8000-000000000099';
    const missingNodeId = '10000000-0000-4000-8000-000000000098';

    expect(
      (await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/scopes?scopeId=${missingScopeId}`)).status,
    ).toBe(404);
    expect(
      (await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/subgraph?scopeId=${missingScopeId}`)).status,
    ).toBe(404);
    expect((await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/nodes/${missingNodeId}`)).status).toBe(
      404,
    );
    expect((await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/nodes/${orgOnly.id}`)).status).toBe(
      404,
    );
    expect(materialize).not.toHaveBeenCalled();
  });

  // 18
  it('validates a thread whose ONLY facts are thread-scoped (pins the candidate-scope lookup)', async () => {
    const h = await createHarness();
    const threadEntity = await node(h.knowledge, 'Solo Thread Entity', await h.threadScope('t-solo'));
    const created = await record(
      h.knowledge,
      threadEntity,
      'Thread-only capture.',
      await h.threadScope('t-solo'),
      't-solo',
    );

    const { status, body } = await graph(h, '?threadId=t-solo');
    expect(status).toBe(200);
    expect(body.view).toBe('thread');
    expect(body.nodes.map(node => node.id)).toContain(threadEntity.id);
    expect(body.nodes.find(node => node.id === threadEntity.id)?.recordCount).toBe(1);
    expect(await h.knowledge.getRecordScopeIds(created.id)).toEqual([(await h.threadScope('t-solo')).at(-1)]);
  });

  // 19
  it('entity endpoint: thread-scoped entity 404s without threadId, 200 with it, 404 with a cross-org threadId', async () => {
    const h = await createHarness();
    const threadEntity = await node(h.knowledge, 'Drilled Entity', await h.threadScope('t-19'));
    await record(h.knowledge, threadEntity, 'Thread-scoped fact.', await h.threadScope('t-19'), 't-19');

    expect((await nodeDetail(h, threadEntity.id)).status).toBe(404);

    const threadGraph = await rawGraph(h, '?threadId=t-19');
    const nodeHandle = threadGraph.body.nodes.find(item => item.name === threadEntity.name)!.id;
    const withThreadResponse = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/nodes/${nodeHandle}?threadId=t-19`,
    );
    const withThread = {
      status: withThreadResponse.status,
      body: (await withThreadResponse.json()) as KnowledgeNodePayload,
    };
    expect(withThread.status).toBe(200);
    expect(withThread.body.records).toHaveLength(1);
    expect(withThread.body.records[0]).toMatchObject({ createdAt: expect.any(String) });
    expect(withThread.body.records[0]).not.toHaveProperty('sourceThreadId');
    expect(withThread.body.records[0]).not.toHaveProperty('metadata');

    // Cross-org thread: seeded under the other org, requested from ours.
    const foreign = await createHarness({
      orgId: OTHER_ORG,
      user: { workosId: 'other', organizationId: OTHER_ORG },
      knowledgeRuntime: h.runtime,
    });
    const foreignEntity = await node(h.knowledge, 'Foreign Holder', foreign.projectScope);
    await record(h.knowledge, foreignEntity, 'Foreign fact.', await foreign.threadScope('t-x19'), 't-x19');
    expect((await nodeDetail(h, threadEntity.id, '?threadId=t-x19')).status).toBe(404);
  });

  it('derives activity visibility from targets rather than attribution scopes', async () => {
    const h = await createHarness();
    const before = await activity(h, '?action=create&sourceType=system');
    const hiddenScope = await h.knowledge.createNode({
      name: 'Hidden attribution scope',
      isScope: true,
      scopeIds: h.orgScope,
    });
    await h.knowledge.createNode({
      name: 'Visible target with hidden actor context',
      scopeIds: h.projectScope,
      contextScopeId: hiddenScope.id,
    });
    await h.knowledge.createNode({
      name: 'Hidden target with visible actor context',
      scopeIds: [hiddenScope.id],
      contextScopeId: h.projectScope[1]!,
    });

    const response = await activity(h, '?action=create&sourceType=system');
    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(before.body.events.length + 1);
    expect(response.body.events).toContainEqual(expect.not.objectContaining({ scopeId: expect.any(String) }));
  });

  it('does not expose storage record or source-thread identifiers in activity projections', async () => {
    const h = await createHarness();
    const entity = await node(h.knowledge, 'Activity Entity', h.projectScope);
    const created = await record(h.knowledge, entity, 'Activity fact.', h.projectScope, 'private-thread-id');
    await h.knowledge.deleteRecord({ id: created.id, version: created.version, deletedBy: 'test' });

    const response = await activity(h);
    expect(response.status).toBe(200);
    expect(response.body.events.length).toBeGreaterThan(0);
    expect(JSON.stringify(response.body)).not.toContain(created.id);
    expect(JSON.stringify(response.body)).not.toContain('private-thread-id');
    expect(response.body.events).toContainEqual(expect.objectContaining({ targetType: 'record' }));
    expect(response.body.events.every(event => !('targetId' in (event as object)))).toBe(true);
  });

  it('lists registered importers and returns filtered run details to organization administrators', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [{ id: 'calendar', handler: async () => {} }],
    });
    const h = await createHarness({ knowledgeRuntime: runtime });
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: `resource:${h.projectId}` });
    const run = await runtime.createImportRunInternal({
      id: 'run-failed',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    await runtime.updateImportRunInternal({ id: run.id, status: 'running' });
    await runtime.updateImportRunInternal({ id: run.id, status: 'failed', error: 'private\u0000 failure' });
    const foreignRun = await runtime.createImportRunInternal({
      id: 'run-foreign',
      importerId: 'calendar',
      binding: knowledgeImporterBindingKey({
        source: 'calendar:foreign',
        scope: 'resource:00000000-0000-4000-8000-000000000099',
      }),
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    const unsupportedDescendantRun = await runtime.createImportRunInternal({
      id: 'run-uncurated',
      importerId: 'calendar',
      binding: knowledgeImporterBindingKey({
        source: 'calendar:uncurated',
        scope: `resource:${h.projectId}:uncurated`,
      }),
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    const threadScope = await h.threadScope('t-import');
    const threadNode = await node(h.knowledge, 'Thread import context', threadScope);
    await record(h.knowledge, threadNode, 'Thread import context.', threadScope, 't-import');
    const threadRun = await runtime.createImportRunInternal({
      id: 'run-thread',
      importerId: 'calendar',
      binding: knowledgeImporterBindingKey({
        source: 'calendar:thread',
        scope: `resource:${h.projectId}:thread:t-import`,
      }),
      importKind: 'static',
      triggerKind: 'programmatic',
    });

    const importers = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/importers`);
    expect(importers.status).toBe(200);
    const importersBody = await importers.json();
    expect(importersBody).toMatchObject({
      importers: [
        {
          id: 'calendar',
          importKind: 'static',
          triggers: ['programmatic'],
          lastRun: {
            id: expect.stringMatching(/^kh_/),
            source: 'calendar:primary',
            status: 'failed',
            error: 'private  failure',
          },
        },
      ],
    });
    expect(JSON.stringify(importersBody)).not.toContain(`resource:${h.projectId}`);

    const runs = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs?status=failed&trigger=programmatic`,
    );
    expect(runs.status).toBe(200);
    const runsBody = await runs.json();
    expect(runsBody).toMatchObject({ runs: [{ id: expect.stringMatching(/^kh_/), status: 'failed' }] });
    expect(JSON.stringify(runsBody)).not.toContain(run.id);

    const runHandle = runsBody.runs[0].id;
    const detail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${runHandle}`,
    );
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ run: { id: runHandle }, activity: [] });

    const foreignDetail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${foreignRun.id}`,
    );
    expect(foreignDetail.status).toBe(404);
    const unsupportedDescendantDetail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${unsupportedDescendantRun.id}`,
    );
    expect(unsupportedDescendantDetail.status).toBe(404);
    expect(JSON.stringify(runsBody)).not.toContain(foreignRun.id);
    expect(JSON.stringify(runsBody)).not.toContain(unsupportedDescendantRun.id);
    expect(JSON.stringify(runsBody)).not.toContain(threadRun.id);

    const threadRuns = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs?threadId=t-import`,
    );
    expect(threadRuns.status).toBe(200);
    const threadRunsBody = await threadRuns.json();
    const visibleThreadRun = threadRunsBody.runs.find(
      (candidate: { source?: string }) => candidate.source === 'calendar:thread',
    );
    expect(visibleThreadRun).toMatchObject({ id: expect.stringMatching(/^kh_/) });
    const threadDetail = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/importers/calendar/runs/${visibleThreadRun.id}?threadId=t-import`,
    );
    expect(threadDetail.status).toBe(200);
    await expect(threadDetail.json()).resolves.toMatchObject({ run: { source: 'calendar:thread' } });
  });

  it('applies trigger filters before run pagination', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [
        {
          id: 'calendar',
          triggers: {
            cron: {
              schedule: '0 * * * *',
              bindings: [{ source: 'calendar:primary', scope: 'resource:placeholder' }],
            },
          },
          handler: async () => {},
        },
      ],
    });
    const h = await createHarness({ knowledgeRuntime: runtime });
    const binding = knowledgeImporterBindingKey({ source: 'calendar:primary', scope: `resource:${h.projectId}` });
    const expected = await runtime.createImportRunInternal({
      id: 'programmatic-run',
      importerId: 'calendar',
      binding,
      importKind: 'static',
      triggerKind: 'programmatic',
    });
    for (let index = 0; index < 101; index += 1) {
      await runtime.createImportRunInternal({
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
    const body = await response.json();
    expect(body).toMatchObject({ runs: [{ id: expect.stringMatching(/^kh_/) }] });
    expect(JSON.stringify(body)).not.toContain(expected.id);
  });

  it('filters proposals by the project perspective and applies admin review actions', async () => {
    const h = await createHarness();
    const projectScopeId = h.projectScope.at(-1)!;
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: projectScopeId,
      scopeRefId: projectScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const target = await node(h.knowledge, 'Proposal target', h.projectScope);
    const proposal = await h.runtime.proposeNodeUpdate({
      mutation: { id: target.id, version: target.version, name: 'Reviewed target' },
      proposerContextScopeId: projectScopeId,
      vouchedScopeIds: [projectScopeId],
      reason: 'The current name is stale',
    });

    const list = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/proposals?status=pending`);
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody).toMatchObject({
      proposals: [
        {
          id: expect.stringMatching(/^kh_/),
          status: 'pending',
          reason: 'The current name is stale',
          actions: ['approve', 'reject'],
          targets: [{ id: expect.stringMatching(/^kh_/), name: 'Proposal target', currentVersion: target.version }],
        },
      ],
    });
    expect(JSON.stringify(listBody)).not.toContain(proposal.id);
    expect(JSON.stringify(listBody)).not.toContain(target.id);

    let proposalHandle = listBody.proposals[0].id;
    const proposalReference = listBody.proposals[0].reference;
    expect(proposalReference).toMatch(/^kr_/);
    const detail = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}`);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: proposalHandle, status: 'pending' });

    await h.knowledge.upsertScopeGrant({
      scopeNodeId: projectScopeId,
      scopeRefId: projectScopeId,
      role: 'readonly',
      canSuggest: true,
    });
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: projectScopeId,
      scopeRefId: projectScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const staleHandle = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}`,
    );
    expect(staleHandle.status).toBe(404);
    const stableReference = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalReference}`,
    );
    expect(stableReference.status).toBe(200);
    expect(await stableReference.json()).toMatchObject({ reference: proposalReference, status: 'pending' });
    const refreshedList = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals?status=pending`,
    );
    proposalHandle = (await refreshedList.json()).proposals[0].id;

    const hidden = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/proposals/${proposal.id}`);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual({ error: 'proposal_not_found' });

    const approved = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}/approve`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Verified' }) },
    );
    const approvedBody = await approved.json();
    expect(approved.status, JSON.stringify(approvedBody)).toBe(200);
    expect(approvedBody).toMatchObject({ id: proposalHandle, status: 'approved' });
    await expect(h.runtime.getNode({ id: target.id, scopeIds: [projectScopeId] })).resolves.toMatchObject({
      name: 'Reviewed target',
    });
  });

  it('binds thread proposal handles and actions to the current access epoch', async () => {
    const h = await createHarness();
    const threadId = 'proposal-thread';
    const threadScope = await h.threadScope(threadId);
    const threadScopeId = threadScope.at(-1)!;
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: threadScopeId,
      scopeRefId: threadScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const target = await node(h.knowledge, 'Thread proposal target', threadScope);
    await record(h.knowledge, target, 'Thread proposal fact.', threadScope, threadId);
    await h.runtime.proposeNodeUpdate({
      mutation: { id: target.id, version: target.version, name: 'Reviewed thread target' },
      proposerContextScopeId: threadScopeId,
      vouchedScopeIds: [threadScopeId],
    });

    const listUrl = `/web/factory/projects/${h.projectId}/knowledge/proposals?status=pending&threadId=${threadId}`;
    const listed = await h.app.request(listUrl);
    expect(listed.status).toBe(200);
    const proposalHandle = (await listed.json()).proposals[0].id;

    await h.knowledge.upsertScopeGrant({
      scopeNodeId: threadScopeId,
      scopeRefId: threadScopeId,
      role: 'readonly',
      canSuggest: true,
    });
    const stale = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}?threadId=${threadId}`,
    );
    expect(stale.status).toBe(404);
    const staleAction = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}/approve?threadId=${threadId}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    expect(staleAction.status).toBe(404);

    await h.knowledge.upsertScopeGrant({
      scopeNodeId: threadScopeId,
      scopeRefId: threadScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const refreshed = await h.app.request(listUrl);
    const refreshedHandle = (await refreshed.json()).proposals[0].id;
    const approved = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${refreshedHandle}/approve?threadId=${threadId}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    expect(approved.status, await approved.text()).toBe(200);
  });

  it('does not advertise proposal review actions to non-admin callers', async () => {
    const h = await createHarness({ isOrganizationAdmin: async () => false });
    const projectScopeId = h.projectScope.at(-1)!;
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: projectScopeId,
      scopeRefId: projectScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const target = await node(h.knowledge, 'Non-admin proposal target', h.projectScope);
    await h.runtime.proposeNodeUpdate({
      mutation: { id: target.id, version: target.version, name: 'Reviewed target' },
      proposerContextScopeId: projectScopeId,
      vouchedScopeIds: [projectScopeId],
    });

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/proposals?status=pending`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ proposals: [{ actions: [] }] });
  });

  it('creates a replacement proposal for conflicted work through an admin route', async () => {
    const h = await createHarness();
    const projectScopeId = h.projectScope.at(-1)!;
    await h.knowledge.upsertScopeGrant({
      scopeNodeId: projectScopeId,
      scopeRefId: projectScopeId,
      role: 'owner',
      canSuggest: true,
    });
    const target = await node(h.knowledge, 'Conflicted target', h.projectScope);
    const proposal = await h.runtime.proposeNodeUpdate({
      mutation: { id: target.id, version: target.version, name: 'Replacement target' },
      proposerContextScopeId: projectScopeId,
      vouchedScopeIds: [projectScopeId],
    });
    await h.runtime.updateNode({
      id: target.id,
      version: target.version,
      name: 'Concurrent target',
      vouchedScopeIds: [projectScopeId],
    });
    await expect(
      h.runtime.approveProposal({
        id: proposal.id,
        reviewerContextScopeId: projectScopeId,
        vouchedScopeIds: [projectScopeId],
      }),
    ).rejects.toThrow();

    const list = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/proposals?status=conflicted`);
    const listBody = await list.json();
    const proposalHandle = listBody.proposals[0].id;
    const response = await h.app.request(
      `/web/factory/projects/${h.projectId}/knowledge/proposals/${proposalHandle}/re-review`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ status: 'pending' });
  });

  it('filters importer metadata through the host-vouched perspective without requiring organization admin', async () => {
    const runtime = new Knowledge({
      id: 'mastra',
      storage: new InMemoryStore(),
      importers: [{ id: 'calendar', handler: async () => {} }],
    });
    const h = await createHarness({ knowledgeRuntime: runtime, isOrganizationAdmin: async () => false });

    const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/importers`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ importers: [] });
  });
});
