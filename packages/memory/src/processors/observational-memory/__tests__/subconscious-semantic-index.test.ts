import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
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
  const memory = new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }) });
  const store = (await memory.storage.getStore('knowledge'))!;
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const scopeIds = await resolveKnowledgeScopeIds(memory, {
    agent: { threadId: 'alpha', resourceId: 'user-42' },
    requestContext,
  });
  const { embedder, vector, embeddedTexts, upserts } = createFakes();
  const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge: store, vector, embedder });
  return { store, scopeIds, coordinator, embeddedTexts, upserts };
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

describe('knowledge semantic index claim timeout', () => {
  it('passes a configured claim timeout to the storage claim', async () => {
    const { store, scopeIds } = await fixture();
    const { embedder, vector } = createFakes();
    const claim = vi.spyOn(store, 'claimSemanticOutbox');
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector,
      embedder,
      claimTimeoutMs: 5_000,
    });
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    expect(claim).toHaveBeenCalledWith(expect.objectContaining({ claimTimeoutMs: 5_000 }));
  });

  it('leaves the adapter default in place when no timeout is configured', async () => {
    const { store, scopeIds, coordinator } = await fixture();
    const claim = vi.spyOn(store, 'claimSemanticOutbox');
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    expect(claim).toHaveBeenCalled();
    for (const [input] of claim.mock.calls) expect(input.claimTimeoutMs).toBeUndefined();
  });

  it('reclaims an abandoned claim once the configured timeout has passed', async () => {
    const { store, scopeIds, coordinator: defaultCoordinator } = await fixture();
    const { embedder, vector } = createFakes();
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    const abandoned = await store.claimSemanticOutbox({ workerId: 'crashed', scopeIds });
    expect(abandoned.length).toBeGreaterThan(0);
    await new Promise(resolve => setTimeout(resolve, 60));

    await expect(defaultCoordinator.drain(scopeIds)).rejects.toThrow('stale');
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector,
      embedder,
      claimTimeoutMs: 20,
    });
    await expect(coordinator.drain(scopeIds)).resolves.toBe(abandoned.length);
  });
});

describe('knowledge semantic index lost claims', () => {
  it('treats an adapter that reports no completions as still holding its claim', async () => {
    const { store, scopeIds, coordinator, embeddedTexts } = await fixture();
    // Store adapters published before completions were reported resolve to undefined.
    const complete = store.completeSemanticOutbox.bind(store);
    vi.spyOn(store, 'completeSemanticOutbox').mockImplementation(async input => {
      await complete(input);
      return undefined as unknown as string[];
    });
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await coordinator.drain(scopeIds);
    expect(embeddedTexts.filter(text => text === 'Project Atlas')).toHaveLength(1);
  });

  it('repairs the index when an expired claim writes stale content after another worker finished', async () => {
    const { store, scopeIds } = await fixture();
    const node = await store.createNode({ name: 'Version one', kind: 'project', scopeIds });
    const indexed = new Map<string, unknown>();
    const indexes = new Set<string>();
    let releaseSlow!: () => void;
    let slowEmbedding!: () => void;
    const slowStarted = new Promise<void>(resolve => (slowEmbedding = resolve));
    const slowGate = new Promise<void>(resolve => (releaseSlow = resolve));
    const makeEmbedder = (slow: boolean) =>
      ({
        specificationVersion: 'v2',
        provider: 'test',
        modelId: 'test-embedder',
        maxEmbeddingsPerCall: 10,
        supportsParallelCalls: true,
        doEmbed: async ({ values }: { values: string[] }) => {
          if (slow && values[0] === 'Version one') {
            slowEmbedding();
            await slowGate;
          }
          return { embeddings: values.map(() => [0.1, 0.2, 0.3]) };
        },
      }) as any;
    const vector = {
      listIndexes: async () => [...indexes],
      createIndex: async ({ indexName }: { indexName: string }) => void indexes.add(indexName),
      deleteVectors: async ({ ids }: { ids: string[] }) => ids.forEach(id => indexed.delete(id)),
      upsert: async (input: { ids: string[]; metadata: Array<Record<string, unknown>> }) =>
        input.ids.forEach((id, index) => indexed.set(id, input.metadata[index]!.name)),
      query: async () => [],
    } as any;
    const slow = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector,
      embedder: makeEmbedder(true),
      workerId: 'slow',
    });
    const expiringStore = new Proxy(store, {
      get: (target, property) => {
        if (property === 'claimSemanticOutbox')
          return (input: Parameters<typeof store.claimSemanticOutbox>[0]) =>
            target.claimSemanticOutbox({ ...input, claimTimeoutMs: 1 });
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const fast = new KnowledgeSemanticIndexCoordinator({
      knowledge: expiringStore,
      vector,
      embedder: makeEmbedder(false),
      workerId: 'fast',
    });

    const slowDrain = slow.drain(scopeIds);
    await slowStarted;
    await store.updateNode({ id: node.id, version: node.version, name: 'Version two' });
    await new Promise(resolve => setTimeout(resolve, 20));
    await fast.drain(scopeIds);
    expect(indexed.get(`knowledge:node:${node.id}`)).toBe('Version two');

    releaseSlow();
    await slowDrain.catch(() => {});
    await fast.drain(scopeIds).catch(() => {});
    expect(indexed.get(`knowledge:node:${node.id}`)).toBe('Version two');
  });
});

describe('knowledge semantic search hit shape', () => {
  it('returns hits joinable with lexical search results', async () => {
    const { store, scopeIds, coordinator, upserts } = await fixture();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds });
    await store.createRecord({ node, text: 'Atlas ships in March', scopeIds });
    await coordinator.drain(scopeIds);
    const indexed = upserts.flatMap(batch => batch.ids.map((id, index) => ({ id, metadata: batch.metadata[index]! })));
    const queryable = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector: {
        ...createFakes().vector,
        listIndexes: async () => ['knowledge_documents_dimension_3'],
        query: async () => indexed.map(hit => ({ ...hit, score: 0.5 })),
      },
      embedder: createFakes().embedder,
    });

    const semantic = await queryable.search('Atlas', scopeIds);
    const lexical = await store.search({ query: 'Atlas', scopeIds });

    expect(lexical.length).toBeGreaterThan(0);
    const joinKey = ({ type, id, recordId, name, scopeIds }: (typeof lexical)[number]) => ({
      type,
      id,
      recordId,
      name,
      scopeIds,
    });
    for (const hit of lexical) {
      expect(semantic.map(joinKey)).toContainEqual(joinKey(hit));
    }
    for (const hit of semantic) {
      expect(hit).toEqual({ ...joinKey(hit), text: expect.any(String), score: 0.5 });
    }
  });
});
