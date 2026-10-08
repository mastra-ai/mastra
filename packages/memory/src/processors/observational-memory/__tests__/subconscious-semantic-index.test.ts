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
