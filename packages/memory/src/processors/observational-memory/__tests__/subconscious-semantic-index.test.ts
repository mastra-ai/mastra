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

describe('knowledge semantic search result shape', () => {
  it('returns hits that join lexical results on type and id with the same recordId', async () => {
    const { store, scopeIds } = await fixture();
    const { embedder, vector } = createFakes();
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge: store, vector, embedder });
    const node = await store.createNode({ name: 'Atlas joinable', kind: 'project', scopeIds });
    const record = await store.createRecord({ node: { id: node.id }, text: 'Atlas joinable launch note', scopeIds });
    await coordinator.drain(scopeIds);
    vector.query = async () => [
      { id: `knowledge:node:${node.id}`, score: 0.9, metadata: { document_type: 'node' } },
      { id: `knowledge:record:${record.id}`, score: 0.8, metadata: { document_type: 'record' } },
    ];

    const semantic = await coordinator.search('atlas joinable', scopeIds);
    const lexical = await store.search({ query: 'atlas joinable', scopeIds });
    const key = (hit: { type: string; id: string }) => `${hit.type}:${hit.id}`;
    const lexicalByKey = new Map(lexical.map(hit => [key(hit), hit]));

    expect(semantic.map(key).sort()).toEqual([`node:${node.id}`, `record:${record.id}`].sort());
    for (const hit of semantic) {
      const match = lexicalByKey.get(key(hit));
      expect(match).toBeDefined();
      expect(hit.recordId).toBe(match!.recordId);
      expect(hit.name).toBe(match!.name);
      expect(hit.scopeIds).toEqual(match!.scopeIds);
      expect(typeof hit.score).toBe('number');
    }
    expect(semantic.find(hit => hit.type === 'record')!.recordId).toBe(node.id);
  });
});

describe('knowledge semantic search when this caller cannot fully drain', () => {
  function searchable(store: any, apply?: () => Promise<void>) {
    const { embedder, vector } = createFakes();
    const warnings: Array<{ message: string; meta: unknown }> = [];
    const logger = { warn: (message: string, meta: unknown) => warnings.push({ message, meta }) } as any;
    const upsert = vector.upsert;
    vector.upsert = async (input: any) => {
      await apply?.();
      return upsert(input);
    };
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge: store,
      vector,
      embedder,
      batchSize: 1,
      getLogger: () => logger,
    });
    return { coordinator, warnings, vector };
  }

  it('serves the current index with one warning while another worker holds the visible rows', async () => {
    const { store, scopeIds } = await fixture();
    const indexed = await store.createNode({ name: 'Indexed', kind: 'project', scopeIds });
    const { coordinator, warnings, vector } = searchable(store);
    await coordinator.drain(scopeIds);
    vector.query = async () => [{ id: `knowledge:node:${indexed.id}`, score: 1, metadata: {} }];

    await store.createNode({ name: 'Held by worker A', kind: 'project', scopeIds });
    const held = await store.claimSemanticOutbox({ workerId: 'worker-a', scopeIds });
    expect(held.length).toBeGreaterThan(0);

    const hits = await coordinator.search('indexed', scopeIds);
    expect(hits.map(hit => hit.id)).toEqual([`knowledge:node:${indexed.id}`]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toMatch(/stale/i);
  });

  it('still throws when this caller fails to apply its own claimed operation', async () => {
    const { store, scopeIds } = await fixture();
    await store.createNode({ name: 'Indexed', kind: 'project', scopeIds });
    const { coordinator, warnings } = searchable(store, async () => {
      throw new Error('vector store down');
    });
    await expect(coordinator.search('indexed', scopeIds)).rejects.toThrow('could not be applied');
    expect(warnings).toHaveLength(0);
  });

  it('serves the current index with one warning when the backlog outlasts the drain budget', async () => {
    const { store, scopeIds } = await fixture();
    const indexed = await store.createNode({ name: 'Indexed', kind: 'project', scopeIds });
    // Every apply enqueues one more operation, so the backlog never empties within the batch budget.
    let more = 0;
    const { coordinator, warnings, vector } = searchable(store, async () => {
      await store.createNode({ name: `Backlog ${more++}`, kind: 'project', scopeIds });
    });
    vector.query = async () => [{ id: `knowledge:node:${indexed.id}`, score: 1, metadata: {} }];

    const hits = await coordinator.search('indexed', scopeIds);
    expect(hits.map(hit => hit.id)).toEqual([`knowledge:node:${indexed.id}`]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toMatch(/stale/i);
  });
});
