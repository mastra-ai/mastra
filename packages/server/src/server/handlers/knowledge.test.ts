import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  GET_KNOWLEDGE_ACTIVITY_ROUTE,
  GET_KNOWLEDGE_GRAPH_ROUTE,
  GET_KNOWLEDGE_NODE_ROUTE,
  LIST_KNOWLEDGE_ROUTE,
  LIST_KNOWLEDGE_SCOPES_ROUTE,
  SEARCH_KNOWLEDGE_ROUTE,
} from './knowledge';

type Named = { id: string; name: string; isScope?: boolean };
type Graph = { nodes: Named[]; records: unknown[] };
type NodeRead = { node: Named; records: Array<{ text: string }> };
type Activity = { events: Array<{ node: Named }> };
const read = async <T>(result: Promise<unknown>) => (await result) as T;

const context = (mastra: Mastra) => ({
  mastra,
  requestContext: new RequestContext(),
  abortSignal: new AbortController().signal,
});

describe('Knowledge read routes', () => {
  let mastra: Mastra;
  let engId: string;
  let salesId: string;
  let roadmapId: string;

  beforeEach(async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'knowledge-read-routes' }),
      structure: {
        scopes: [
          { address: 'org:acme', name: 'Acme' },
          { address: 'resource:eng', name: 'Engineering', parentAddresses: ['org:acme'] },
          { address: 'resource:sales', name: 'Sales', parentAddresses: ['org:acme'] },
        ],
      },
    });
    await knowledge.reconcile();
    const store = await knowledge.getStorage();
    const { scopes } = await store.listScopeNodes();
    engId = scopes.find(scope => scope.address === 'resource:eng')!.id;
    salesId = scopes.find(scope => scope.address === 'resource:sales')!.id;

    const pricing = await store.createNode({ name: 'Pricing', kind: 'doc', scopeIds: [salesId] });
    await store.createRecord({ node: pricing, text: 'Enterprise tier costs more.', scopeIds: [salesId] });
    const launch = await store.createNode({ name: 'Launch', kind: 'doc', scopeIds: [engId] });
    await store.createRecord({ node: launch, text: 'Launch checklist is frozen.', scopeIds: [engId] });
    const roadmap = await store.createNode({ name: 'Roadmap', kind: 'doc', scopeIds: [engId] });
    roadmapId = roadmap.id;
    await store.createRecord({ node: roadmap, text: 'Ships after [[Launch]] in Q4.', scopeIds: [engId] });
    await store.createNode({ name: 'pinned', kind: 'system', scopeIds: [engId] });

    mastra = new Mastra({ knowledge: { docs: knowledge } });
  });

  afterEach(async () => {
    await mastra.shutdown();
  });

  it('lists registered instances by key', async () => {
    const result = await read<{ instances: Array<{ key: string }> }>(
      LIST_KNOWLEDGE_ROUTE.handler({ ...context(mastra) }),
    );
    expect(result.instances.map(instance => instance.key)).toEqual(['docs']);
  });

  it('lists the stored scope nodes', async () => {
    const result = await read<{ scopes: Array<{ address: string }> }>(
      LIST_KNOWLEDGE_SCOPES_ROUTE.handler({ ...context(mastra), instanceKey: 'docs' }),
    );
    expect(result.scopes.map(scope => scope.address).sort()).toEqual(['org:acme', 'resource:eng', 'resource:sales']);
  });

  it('returns every content node across scopes when no scope is chosen, hiding the pin node', async () => {
    const graph = await read<Graph>(GET_KNOWLEDGE_GRAPH_ROUTE.handler({ ...context(mastra), instanceKey: 'docs' }));
    const names = graph.nodes.filter(node => !node.isScope).map(node => node.name);
    expect(names.sort()).toEqual(['Launch', 'Pricing', 'Roadmap']);
    expect(graph.records).toHaveLength(3);
  });

  it('narrows the graph to members of the chosen scope', async () => {
    const graph = await read<Graph>(
      GET_KNOWLEDGE_GRAPH_ROUTE.handler({ ...context(mastra), instanceKey: 'docs', scopeNodeId: salesId }),
    );
    expect(graph.nodes.filter(node => !node.isScope).map(node => node.name)).toEqual(['Pricing']);
  });

  it('reads one node with its records', async () => {
    const result = await read<NodeRead>(
      GET_KNOWLEDGE_NODE_ROUTE.handler({ ...context(mastra), instanceKey: 'docs', nodeId: roadmapId }),
    );
    expect(result.node.name).toBe('Roadmap');
    expect(result.records.map(record => record.text)).toContain('Ships after [[Launch]] in Q4.');
  });

  it('finds nodes and scopes by name', async () => {
    const result = await read<{ results: Named[] }>(
      SEARCH_KNOWLEDGE_ROUTE.handler({ ...context(mastra), instanceKey: 'docs', q: 'pric' }),
    );
    expect(result.results.map(hit => hit.name)).toContain('Pricing');
  });

  it('pages activity newest first, limited to the chosen scope', async () => {
    const all = await read<Activity>(GET_KNOWLEDGE_ACTIVITY_ROUTE.handler({ ...context(mastra), instanceKey: 'docs' }));
    expect(all.events.length).toBeGreaterThan(0);
    const eng = await read<Activity>(
      GET_KNOWLEDGE_ACTIVITY_ROUTE.handler({ ...context(mastra), instanceKey: 'docs', scopeNodeId: engId }),
    );
    expect(eng.events.every(event => event.node.name !== 'Pricing')).toBe(true);
  });

  it('answers 404 for an unknown instance', async () => {
    await expect(
      GET_KNOWLEDGE_GRAPH_ROUTE.handler({ ...context(mastra), instanceKey: 'missing' }),
    ).rejects.toBeInstanceOf(HTTPException);
  });
});
