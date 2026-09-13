import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { createKnowledgeTools, resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { KnowledgeSemanticIndexCoordinator } from '../subconscious/semantic-index';

function createFakes() {
  const embeddedTexts: string[] = [];
  const upserts: Array<{ ids: string[]; metadata: Array<Record<string, unknown>> }> = [];
  const embedder = {
    specificationVersion: 'v2',
    provider: 'test',
    modelId: 'test-embedder',
    maxEmbeddingsPerCall: 10,
    supportsParallelCalls: true,
    doEmbed: async ({ values }: { values: string[] }) => {
      embeddedTexts.push(...values);
      return { embeddings: values.map(() => [0.1, 0.2, 0.3]) };
    },
  } as any;
  const indexes = new Set<string>();
  const vector = {
    listIndexes: async () => [...indexes],
    createIndex: async ({ indexName }: { indexName: string }) => {
      indexes.add(indexName);
    },
    describeIndex: async () => ({ count: 1 }),
    deleteVectors: async () => {},
    upsert: async (input: { ids: string[]; metadata: Array<Record<string, unknown>> }) => {
      upserts.push({ ids: input.ids, metadata: input.metadata });
    },
    query: async () => [],
  } as any;
  return { embedder, vector, embeddedTexts, upserts };
}

async function fixture() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({ id: 'default', storage });
  const memory = new Memory({ storage, knowledge });
  const store = (await memory.storage.getStore('knowledge'))!;
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const scopeIds = await resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext,
  });
  const { embedder, vector, embeddedTexts, upserts } = createFakes();
  const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, storage: store, vector, embedder });
  return { knowledge, store, scopeIds, coordinator, vector, embeddedTexts, upserts };
}

describe('knowledge semantic index descriptions', () => {
  it('indexes the node name when no description exists', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await store.createNode({ name: 'Bare Node', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas');
    expect(embeddedTexts).toContain('Bare Node');
  });

  it('includes the description in the indexed document when present', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      metadata: { description: 'Flagship migration project.' },
      scopeIds,
    });
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas\nFlagship migration project.');
  });

  it('does not drain hidden semantic operations during visible search', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    const hiddenScopeId = crypto.randomUUID();
    await store.createNode({ id: hiddenScopeId, name: 'Hidden scope', isScope: true, scopeIds: [] });
    await store.createNode({ name: 'Visible pending document', scopeIds });
    await store.createNode({ name: 'Hidden pending document', scopeIds: [hiddenScopeId] });

    await expect(coordinator.search('visible', scopeIds, 1)).resolves.toEqual([]);
    expect(embeddedTexts).toContain('Visible pending document');
    expect(embeddedTexts).not.toContain('Hidden pending document');
  });

  it('filters stale node vectors against current storage visibility before ranking', async () => {
    const { store, scopeIds, coordinator, vector } = await fixture();
    const hiddenScopeId = crypto.randomUUID();
    await store.createNode({ id: hiddenScopeId, name: 'Hidden scope', isScope: true, scopeIds: [] });
    await store.createNode({ name: 'Visible index seed', scopeIds });
    const hidden = await store.createNode({ name: 'Hidden stale vector', scopeIds: [hiddenScopeId] });
    await coordinator.drain(scopeIds);
    vector.query = async () => [
      {
        id: `knowledge:node:${hidden.id}`,
        score: 1,
        metadata: { document_type: 'node', scope_ids: scopeIds },
      },
    ];

    await expect(coordinator.search('hidden', scopeIds, 10)).resolves.toEqual([]);
  });

  it('bounds iterative semantic over-fetch while filling the visible result limit', async () => {
    const { store, scopeIds, coordinator, vector } = await fixture();
    const visible = await store.createNode({ name: 'Visible semantic result', scopeIds });
    await coordinator.drain(scopeIds);
    const candidates = [
      ...Array.from({ length: 75 }, (_, index) => ({
        id: `knowledge:node:${crypto.randomUUID()}`,
        score: 1 - index / 100,
        metadata: { document_type: 'node' },
      })),
      {
        id: `knowledge:node:${visible.id}`,
        score: 0.2,
        metadata: { document_type: 'node' },
      },
    ];
    const query = vi.fn(async ({ topK }: { topK: number }) => candidates.slice(0, topK));
    vector.query = query;

    await expect(coordinator.search('visible', scopeIds, 1)).resolves.toEqual([
      expect.objectContaining({ id: `knowledge:node:${visible.id}` }),
    ]);
    expect(query.mock.calls.map(([input]) => input.topK)).toEqual([50, 100]);
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { scope_ids: { $in: expect.arrayContaining(scopeIds) } },
      }),
    );
  });

  it('evaluates chained grants for semantic search and observes revocation', async () => {
    const storage = new InMemoryStore();
    const knowledge = new Knowledge({ id: 'semantic-frontier', storage });
    const store = (await storage.getStore('knowledge'))!;
    const structure = await store.reconcileStructure({
      scopes: [
        { address: 'principal:semantic', name: 'Semantic reader' },
        { address: 'principal:hidden', name: 'Hidden reader' },
        {
          address: 'team:semantic',
          name: 'Semantic team',
          grants: [{ scopeRefAddress: 'principal:semantic', role: 'readonly' }],
        },
        {
          address: 'scope:semantic',
          name: 'Semantic content',
          grants: [{ scopeRefAddress: 'team:semantic', role: 'readonly' }],
        },
        {
          address: 'scope:hidden',
          name: 'Hidden content',
          grants: [{ scopeRefAddress: 'principal:hidden', role: 'readonly' }],
        },
      ],
    });
    const principalScopeIds = [structure.scopes['principal:semantic']!];
    await store.createNode({
      name: 'Semantic handbook',
      scopeIds: [structure.scopes['scope:semantic']!, structure.scopes['scope:hidden']!],
    });
    const { embedder, vector, upserts } = createFakes();
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, storage: store, vector, embedder });

    await coordinator.drain();
    vector.query = async () =>
      upserts.flatMap(upsert => upsert.ids.map((id, index) => ({ id, score: 1, metadata: upsert.metadata[index] })));
    const [semanticResult] = await coordinator.search('handbook', principalScopeIds, 1);
    expect(semanticResult).toMatchObject({ metadata: expect.objectContaining({ name: 'Semantic handbook' }) });
    expect(semanticResult?.metadata).not.toHaveProperty('scope_ids');
    expect(semanticResult?.metadata).not.toHaveProperty('scope_key');

    await store.reconcileStructure({
      scopes: [
        { address: 'principal:semantic', name: 'Semantic reader' },
        { address: 'principal:hidden', name: 'Hidden reader' },
        { address: 'team:semantic', name: 'Semantic team' },
        { address: 'scope:semantic', name: 'Semantic content' },
        {
          address: 'scope:hidden',
          name: 'Hidden content',
          grants: [{ scopeRefAddress: 'principal:hidden', role: 'readonly' }],
        },
      ],
    });
    await expect(coordinator.search('handbook', principalScopeIds, 1)).resolves.toEqual([]);
  });

  it('routes agent tools through chained grants and observes revocation', async () => {
    const storage = new InMemoryStore();
    const knowledge = new Knowledge({ id: 'tool-frontier', storage });
    const store = (await storage.getStore('knowledge'))!;
    const structure = await store.reconcileStructure({
      scopes: [
        { address: 'principal:reader', name: 'Reader' },
        { address: 'principal:private', name: 'Private reader' },
        {
          address: 'team:readers',
          name: 'Readers',
          grants: [{ scopeRefAddress: 'principal:reader', role: 'readonly' }],
        },
        {
          address: 'scope:shared',
          name: 'Shared',
          grants: [{ scopeRefAddress: 'team:readers', role: 'readonly' }],
        },
        {
          address: 'scope:private',
          name: 'Private',
          grants: [{ scopeRefAddress: 'principal:private', role: 'readonly' }],
        },
      ],
    });
    const principalScopeId = structure.scopes['principal:reader']!;
    const sharedScopeId = structure.scopes['scope:shared']!;
    const privateScopeId = structure.scopes['scope:private']!;
    const node = await store.createNode({ name: 'Granted handbook', scopeIds: [sharedScopeId, privateScopeId] });
    const record = await store.createRecord({
      node,
      text: 'Classified handbook procedure.',
      scopeIds: [sharedScopeId, privateScopeId],
      source: 'test',
    });
    const tools = createKnowledgeTools(
      {
        getKnowledgeInstance: () => knowledge,
        getKnowledgeStore: async () => store,
        getKnowledgeSemanticIndex: async () => undefined,
      },
      [principalScopeId],
    );

    await expect(tools.knowledge_search!.execute?.({ query: 'handbook' }, {} as never)).resolves.toMatchObject({
      results: [
        expect.objectContaining({ name: 'Granted handbook', scopeIds: [sharedScopeId] }),
        expect.objectContaining({ id: record.id, scopeIds: [sharedScopeId] }),
      ],
    });
    await expect(tools.knowledge_search!.execute?.({ query: 'classified' }, {} as never)).resolves.toMatchObject({
      results: [expect.objectContaining({ id: record.id, scopeIds: [sharedScopeId] })],
    });
    await expect(tools.knowledge_read!.execute?.({ id: node.id }, {} as never)).resolves.toMatchObject({
      found: true,
      node: { name: 'Granted handbook', scopeIds: [sharedScopeId] },
      records: [expect.objectContaining({ id: record.id, scopeIds: [sharedScopeId] })],
    });
    await expect(tools.knowledge_browse!.execute?.({ namePrefix: 'Granted' }, {} as never)).resolves.toMatchObject({
      nodes: [expect.objectContaining({ name: 'Granted handbook', scopeIds: [sharedScopeId] })],
    });
    await expect(tools.knowledge_browse!.execute?.({ node: node.id }, {} as never)).resolves.toMatchObject({
      records: [expect.objectContaining({ id: record.id, scopeIds: [sharedScopeId] })],
    });

    await store.reconcileStructure({
      scopes: [
        { address: 'principal:reader', name: 'Reader' },
        { address: 'principal:private', name: 'Private reader' },
        { address: 'team:readers', name: 'Readers' },
        { address: 'scope:shared', name: 'Shared' },
        {
          address: 'scope:private',
          name: 'Private',
          grants: [{ scopeRefAddress: 'principal:private', role: 'readonly' }],
        },
      ],
    });
    await expect(tools.knowledge_search!.execute?.({ query: 'handbook' }, {} as never)).resolves.toEqual({
      query: 'handbook',
      results: [],
    });
    await expect(tools.knowledge_read!.execute?.({ id: node.id }, {} as never)).resolves.toEqual({ found: false });
    await expect(tools.knowledge_browse!.execute?.({ namePrefix: 'Granted' }, {} as never)).resolves.toEqual({
      nodes: [],
      nextCursor: undefined,
    });
  });

  it('re-enqueues and re-embeds the whole document on a description-only update', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    const updated = await store.updateNode({
      id: node.id,
      version: node.version,
      metadata: { description: 'New synopsis.' },
    });
    expect(updated.version).toBe(node.version + 1);
    const pending = await store.listSemanticOutbox({ status: 'pending', scopeIds, limit: 10 });
    expect(pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: `knowledge:node:${node.id}`, operation: 'upsert' }),
      ]),
    );
    await coordinator.drain(scopeIds);
    expect(embeddedTexts).toContain('Project Atlas\nNew synopsis.');
  });
});
