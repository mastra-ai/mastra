import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import {
  KnowledgeSemanticIndexCoordinator,
  StaleKnowledgeSemanticIndexError,
  SubconsciousCaptureExtractor,
} from '../subconscious';
import type { SubconsciousCaptureHook, SubconsciousCaptureOutput } from '../subconscious';

function createContext(memory: Memory, current: SubconsciousCaptureOutput) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return {
    source: 'observer' as const,
    threadId: 'alpha',
    resourceId: 'user-42',
    memory,
    requestContext,
    current,
  };
}

describe('Subconscious capture', () => {
  it('deterministically writes scoped nodes, records, mentions, provenance, and ceilings', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'org',
      maxScope: 'resource',
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [
        {
          name: 'Project Atlas',
          kind: 'project',
          records: [
            {
              text: '[[Maya Chen]] owns [[Project Atlas]].',
              scope: 'org',
              when: '2030-01-15',
            },
            { text: 'The staging region is cobalt.' },
          ],
        },
      ],
    });

    await extractor.onExtracted?.({ ...context, extractor });

    const store = (await memory.storage.getStore('knowledge'))!;
    const resourceScope = ['org:acme', 'resource:user-42'];
    const threadScope = [...resourceScope, 'thread:alpha'];
    const atlas = await store.getNodeByName({ name: 'Project Atlas', scope: resourceScope });
    const maya = await store.resolveNode({ name: 'Maya Chen', scope: threadScope });
    expect(atlas).toMatchObject({ kind: 'project', scope: resourceScope });
    expect(maya).toMatchObject({ scope: resourceScope });

    const records = await store.knowledgeAbout({ node: atlas!.id, scope: threadScope });
    expect(records.records).toHaveLength(2);
    expect(records.records[0]).toMatchObject({
      sourceThreadId: 'alpha',
      maxScope: 'resource',
    });
    expect(records.records.map(record => record.scope)).toEqual(expect.arrayContaining([resourceScope, threadScope]));
    expect(records.records.find(record => record.when)?.when?.toISOString()).toBe('2030-01-15T00:00:00.000Z');
    expect(records.records.every(record => record.capturedAt instanceof Date)).toBe(true);

    const touchingMaya = await store.knowledgeRelatedTo({ node: maya!.id, scope: threadScope });
    expect(touchingMaya.records.map(record => record.text)).toContain('[[Maya Chen]] owns [[Project Atlas]].');
  });

  it('loads bounded learned guidance after user instructions', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    await store.createNode({
      name: 'capture-guidance',
      kind: 'document',
      content: `Treat Atlas as a project.\n${'x'.repeat(5_000)}`,
      scope: ['org:acme', 'resource:user-42'],
    });
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', instructions: 'Record pricing amounts verbatim.' },
      defaultScope: 'resource',
      learnedGuidance: true,
    });

    const resolved = await extractor.resolve(createContext(memory, { nodes: [] }));
    expect(resolved.instructions).toContain('Record pricing amounts verbatim.');
    expect(resolved.instructions).toContain('Learned guidance');
    expect(resolved.instructions.indexOf('Record pricing')).toBeLessThan(
      resolved.instructions.indexOf('Learned guidance'),
    );
    expect(resolved.instructions.length).toBeLessThan(6_500);
  });

  it('lets a configured capture hook replace or augment default routing', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const routeImpl: SubconsciousCaptureHook = async context => {
      await context.defaultImplementation(context);
    };
    const route = vi.fn(routeImpl);
    const extractor = new SubconsciousCaptureExtractor({
      config: { name: 'capture', onExtracted: route },
      defaultScope: 'resource',
      learnedGuidance: false,
    });
    const context = createContext(memory, {
      nodes: [{ name: 'Atlas', kind: 'project', records: [] }],
    });

    await extractor.onExtracted?.({ ...context, extractor });
    expect(route).toHaveBeenCalledOnce();
    const store = (await memory.storage.getStore('knowledge'))!;
    expect(
      await store.resolveNode({ name: 'Atlas', scope: ['org:acme', 'resource:user-42', 'thread:alpha'] }),
    ).not.toBeNull();
  });

  it('fails explicitly when required conversation scope context is unavailable', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      learnedGuidance: false,
    });

    await expect(
      extractor.onExtracted?.({
        source: 'observer',
        threadId: 'alpha',
        resourceId: 'user-42',
        memory,
        current: { nodes: [] },
        extractor,
      }),
    ).rejects.toThrow(/organizationId/);
  });
});

describe('Knowledge semantic indexing', () => {
  function createVector() {
    const indexes = new Set<string>();
    const vectors = new Map<string, { metadata: Record<string, unknown>; vector: number[] }>();
    const deleteVectors = vi.fn(async ({ ids }: { ids?: string[] }) => {
      for (const id of ids ?? []) vectors.delete(id);
    });
    const vector = {
      indexSeparator: '_',
      listIndexes: vi.fn(async () => [...indexes]),
      createIndex: vi.fn(async ({ indexName }: { indexName: string }) => {
        indexes.add(indexName);
      }),
      upsert: vi.fn(
        async ({
          ids,
          metadata,
          vectors: values,
        }: {
          ids?: string[];
          metadata?: Record<string, unknown>[];
          vectors: number[][];
        }) => {
          values.forEach((value, index) => {
            vectors.set(ids![index]!, { vector: value, metadata: metadata![index]! });
          });
          return ids ?? [];
        },
      ),
      deleteVectors,
    } as unknown as MastraVector;
    return { vector, vectors, deleteVectors };
  }

  it('drains durable outbox rows idempotently and deletes stale vectors', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    const node = await knowledge.createNode({
      name: 'Project Atlas',
      kind: 'project',
      content: 'Launch plan',
      scope: ['org:acme', 'resource:user-42'],
    });
    const record = await knowledge.appendKnowledge({
      node: node.id,
      text: '[[Maya Chen]] owns Atlas.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'alpha',
      maxScope: 'resource',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    const { vector, vectors, deleteVectors } = createVector();
    const embedder = {
      doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({
        embeddings: values.map(() => [0.1, 0.2, 0.3]),
      })),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'test' });

    expect(await coordinator.drain(['org:acme', 'resource:user-42'])).toBeGreaterThanOrEqual(2);
    expect(await coordinator.drain(['org:acme', 'resource:user-42'])).toBe(0);
    expect(embedder.doEmbed).toHaveBeenCalledWith(expect.objectContaining({ values: ['Project Atlas\nLaunch plan'] }));
    expect(vectors.get(`knowledge:record:${record.id}`)?.metadata).toMatchObject({
      document_type: 'record',
      scope_org: 'acme',
      scope_resource: 'user-42',
    });

    await knowledge.removeKnowledge({ id: record.id, deletedBy: 'curator' });
    await coordinator.drain(['org:acme', 'resource:user-42']);
    expect(vectors.has(`knowledge:record:${record.id}`)).toBe(false);
    expect(deleteVectors).toHaveBeenCalled();
  });

  it('keeps concurrent drains isolated by visible scope', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scope: ['org:acme'] });
    await knowledge.createNode({ name: 'Beacon', kind: 'project', scope: ['org:beta'] });
    const { vector } = createVector();
    const embedder = {
      doEmbed: vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return { embeddings: [[0.1, 0.2]] };
      }),
    } as unknown as MastraEmbeddingModel<string>;
    const coordinator = new KnowledgeSemanticIndexCoordinator({ knowledge, vector, embedder, workerId: 'scoped' });

    await Promise.all([coordinator.drain(['org:acme']), coordinator.drain(['org:beta'])]);
    expect(await knowledge.listSemanticOutbox({ status: 'completed' })).toHaveLength(2);
  });

  it('releases failed rows and resumes them idempotently after a crash-like failure', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const knowledge = (await memory.storage.getStore('knowledge'))!;
    await knowledge.createNode({ name: 'Atlas', kind: 'project', scope: ['org:acme'] });
    const { vector } = createVector();
    const doEmbed = vi
      .fn<({ values }: { values: string[] }) => Promise<{ embeddings: number[][] }>>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValue({ embeddings: [[0.1, 0.2]] });
    const coordinator = new KnowledgeSemanticIndexCoordinator({
      knowledge,
      vector,
      embedder: { doEmbed } as unknown as MastraEmbeddingModel<string>,
      workerId: 'retry-test',
    });

    await expect(coordinator.drain(['org:acme'])).rejects.toBeInstanceOf(StaleKnowledgeSemanticIndexError);
    expect(await knowledge.listSemanticOutbox({ status: 'pending' })).toHaveLength(1);
    expect(await coordinator.drain(['org:acme'])).toBe(1);
    expect((await knowledge.listSemanticOutbox({ status: 'completed' }))[0]).toMatchObject({ attempts: 2 });
  });
});
