import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { Subconscious } from '../subconscious';

function createSemanticDependencies(ignoreFilters = false) {
  const indexes = new Set<string>();
  const documents = new Map<string, { vector: number[]; metadata: Record<string, unknown> }>();
  const vector = {
    indexSeparator: '_',
    listIndexes: vi.fn(async () => [...indexes]),
    createIndex: vi.fn(async ({ indexName }: { indexName: string }) => {
      indexes.add(indexName);
    }),
    upsert: vi.fn(async ({ ids, vectors, metadata }: any) => {
      ids.forEach((id: string, index: number) =>
        documents.set(id, { vector: vectors[index], metadata: metadata[index] }),
      );
      return ids;
    }),
    deleteVectors: vi.fn(async ({ ids }: { ids?: string[] }) => {
      ids?.forEach(id => documents.delete(id));
    }),
    query: vi.fn(async ({ topK, filter }: any) =>
      [...documents.entries()]
        .filter(([, document]) => ignoreFilters || document.metadata.scope_key === filter.scope_key)
        .map(([id, document], index) => ({ id, score: 1 - index / 100, metadata: document.metadata }))
        .slice(0, topK),
    ),
  } as unknown as MastraVector;
  const embedder = {
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2, 0.3]) })),
  } as unknown as MastraEmbeddingModel<string>;
  return { vector, embedder };
}

function toolContext(threadId = 'alpha') {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  return { agent: { threadId, resourceId: 'user-42' }, requestContext } as any;
}

async function createMemory(tools = true, ignoreFilters = false) {
  const { vector, embedder } = createSemanticDependencies(ignoreFilters);
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector,
    embedder,
    options: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        subconscious: new Subconscious({ tools }),
      },
    },
  });
  return memory;
}

describe('Subconscious knowledge read tools', () => {
  it('registers all three tools by default and honors tools: false', async () => {
    expect(Object.keys((await createMemory()).listTools())).toEqual(
      expect.arrayContaining(['knowledge_search', 'knowledge_read', 'knowledge_browse']),
    );
    expect((await createMemory(false)).listTools()).not.toHaveProperty('knowledge_search');
  });

  it('reads and browses visible records without exposing a sibling thread', async () => {
    const memory = await createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const shared = await store.createEntity({
      name: 'Project Atlas',
      kind: 'project',
      scope: ['org:acme', 'resource:user-42'],
    });
    await store.createEntity({
      name: 'Shared Brief',
      kind: 'note',
      scope: ['org:acme', 'resource:user-42'],
    });
    const secret = await store.createEntity({
      name: 'Beta Secret',
      kind: 'secret',
      scope: ['org:acme', 'resource:user-42', 'thread:beta'],
    });
    await store.appendFact({
      parentEntityId: shared.id,
      text: '[[Maya Chen]] owns Atlas.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'alpha',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:alpha'],
      defaultScope: ['org:acme', 'resource:user-42'],
    });
    await store.appendFact({
      parentEntityId: secret.id,
      text: 'Sibling-only information.',
      scope: ['org:acme', 'resource:user-42', 'thread:beta'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42', 'thread:beta'],
    });

    const tools = memory.listTools();
    const read = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Project Atlas' }, toolContext());
    expect(read).toMatchObject({ found: true, entity: { name: 'Project Atlas' } });
    expect((read as any).facts[0].text).toContain('Maya Chen');
    const hidden = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Beta Secret' }, toolContext());
    expect(hidden).toEqual({ found: false });
    const firstPage = await tools.knowledge_browse!.execute?.({ limit: 1 }, toolContext());
    expect((firstPage as any).records).toHaveLength(1);
    expect((firstPage as any).nextCursor).toBeTruthy();
    const cursorRecord = await store.getEntity((firstPage as any).records[0].id);
    await store.updateEntity({
      id: cursorRecord!.id,
      version: cursorRecord!.version,
      name: `${cursorRecord!.name} renamed`,
    });
    const secondPage = await tools.knowledge_browse!.execute?.(
      { limit: 1, cursor: (firstPage as any).nextCursor },
      toolContext(),
    );
    expect((secondPage as any).records).toHaveLength(1);
    expect((secondPage as any).records[0].id).not.toBe((firstPage as any).records[0].id);
    expect(
      [...(firstPage as any).records, ...(secondPage as any).records].map((record: any) => record.name),
    ).not.toContain('Beta Secret');
  });

  it('combines lexical and semantic results while filtering sibling-private vectors even when the adapter ignores filters', async () => {
    const memory = await createMemory(true, true);
    const store = (await memory.storage.getStore('knowledge'))!;
    await store.createEntity({ name: 'Project Atlas', kind: 'project', scope: ['org:acme', 'resource:user-42'] });
    await store.createPage({
      name: 'Deployment runbook',
      body: 'The cobalt rollout procedure.',
      scope: ['org:acme', 'resource:user-42'],
    });
    const privateParent = await store.createEntity({
      name: 'Beta Secret',
      kind: 'secret',
      scope: ['org:acme', 'resource:user-42', 'thread:beta'],
    });
    await store.appendFact({
      parentEntityId: privateParent.id,
      text: 'The cobalt procedure is shared.',
      scope: ['org:acme', 'resource:user-42'],
      sourceThreadId: 'beta',
      resolutionScope: ['org:acme', 'resource:user-42', 'thread:beta'],
      defaultScope: ['org:acme', 'resource:user-42', 'thread:beta'],
    });

    await memory.drainKnowledgeSemanticIndex(['org:acme', 'resource:user-42', 'thread:beta']);
    const tools = memory.listTools();
    const result = await tools.knowledge_search!.execute?.({ query: 'cobalt rollout' }, toolContext());
    expect((result as any).results).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'page', name: 'Deployment runbook' })]),
    );
    expect((result as any).results.map((item: any) => item.name)).not.toContain('Beta Secret');
    expect((result as any).results).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'fact', name: '(private entity)' })]),
    );
    expect((result as any).results.some((item: any) => item.sources.includes('semantic'))).toBe(true);
  });

  it('fails explicitly when the semantic index is unavailable', async () => {
    const tools = (await createMemory()).listTools();
    await expect(tools.knowledge_search!.execute?.({ query: 'missing' }, toolContext())).rejects.toThrow(
      /semantic index .* unavailable/i,
    );
  });

  it('fails closed when trusted scope context is missing', async () => {
    const tools = (await createMemory()).listTools();
    await expect(
      tools.knowledge_browse!.execute?.({}, { agent: { threadId: 'alpha', resourceId: 'user-42' } } as any),
    ).rejects.toThrow(/organizationId/);
  });
});
