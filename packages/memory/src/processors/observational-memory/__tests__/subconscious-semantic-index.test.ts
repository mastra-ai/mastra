import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { Memory } from '../../..';
import { KnowledgeSemanticIndexCoordinator } from '../subconscious/semantic-index';

const scope = ['org:acme', 'resource:user-42', 'thread:alpha'];

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
  const memory = new Memory({ storage: new InMemoryStore() });
  const store = (await memory.storage.getStore('knowledge'))!;
  const { embedder, vector, embeddedTexts, upserts } = createFakes();
  const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge: store, vector, embedder });
  return { store, coordinator, embeddedTexts, upserts };
}

describe('knowledge semantic index descriptions', () => {
  it('keeps the indexed document byte-identical for description-less nodes', async () => {
    const { store, coordinator, embeddedTexts } = await fixture();
    await store.createNode({ name: 'Project Atlas', kind: 'project', content: 'Long-form body.', scope });
    await store.createNode({ name: 'Bare Node', kind: 'project', scope });
    await coordinator.drain(scope);
    expect(embeddedTexts).toContain('Project Atlas\nLong-form body.');
    expect(embeddedTexts).toContain('Bare Node\n');
  });

  it('includes the description in the indexed document when present', async () => {
    const { store, coordinator, embeddedTexts } = await fixture();
    await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      content: 'Long-form body.',
      description: 'Flagship migration project.',
      scope,
    });
    await coordinator.drain(scope);
    expect(embeddedTexts).toContain('Project Atlas\nFlagship migration project.\nLong-form body.');
  });

  it('re-enqueues and re-embeds the whole document on a description-only update', async () => {
    const { store, coordinator, embeddedTexts } = await fixture();
    const node = await store.createNode({ name: 'Project Atlas', kind: 'project', content: 'Long-form body.', scope });
    await coordinator.drain(scope);
    const updated = await store.updateNode({ id: node.id, version: node.version, description: 'New synopsis.' });
    expect(updated.version).toBe(node.version + 1);
    const pending = await store.listSemanticOutbox({ status: 'pending', scope, limit: 10 });
    expect(pending).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentId: `knowledge:node:${node.id}`, operation: 'upsert' }),
      ]),
    );
    await coordinator.drain(scope);
    expect(embeddedTexts).toContain('Project Atlas\nNew synopsis.\nLong-form body.');
  });
});
