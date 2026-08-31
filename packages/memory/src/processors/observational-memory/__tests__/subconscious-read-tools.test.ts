import { Knowledge } from '@mastra/core/knowledge';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { Subconscious } from '../subconscious';
import { createKnowledgeTools, resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';

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
        .filter(
          ([, document]) =>
            ignoreFilters ||
            (document.metadata.scope_ids as string[]).some(scopeId => filter.scope_ids.$in.includes(scopeId)),
        )
        .map(([id, document], index) => ({ id, score: 1 - index / 100, metadata: document.metadata }))
        .slice(0, topK),
    ),
  } as unknown as MastraVector;
  const embedder = {
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2, 0.3]) })),
  } as unknown as MastraEmbeddingModel<string>;
  return { vector, embedder };
}

function toolContext(threadId = 'alpha', resourceId = 'user-42', organizationId = 'acme') {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', organizationId);
  return { agent: { threadId, resourceId }, requestContext } as any;
}

async function createMemory(tools = true, ignoreFilters = false) {
  const { vector, embedder } = createSemanticDependencies(ignoreFilters);
  const storage = new InMemoryStore();
  const memory = new Memory({
    storage,
    knowledge: new Knowledge({ id: 'default', storage }),
    vector,
    embedder,
    options: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        experimental_subconscious: new Subconscious({ tools }),
      },
    },
  });
  return memory;
}

async function scopeIdsFor(memory: Memory, threadId = 'alpha', resourceId = 'user-42', organizationId = 'acme') {
  const context = toolContext(threadId, resourceId, organizationId);
  return resolveKnowledgeScopeIds(memory, context);
}

describe('Subconscious knowledge read tools', () => {
  it('registers all three tools by default and honors tools: false', async () => {
    expect(Object.keys((await createMemory()).listTools())).toEqual(
      expect.arrayContaining(['knowledge_search', 'knowledge_read', 'knowledge_browse']),
    );
    expect((await createMemory(false)).listTools()).not.toHaveProperty('knowledge_search');
  });

  it('reads and browses visible records without exposing another organization', async () => {
    const memory = await createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const alphaScopeIds = await scopeIdsFor(memory);
    const betaScopeIds = await scopeIdsFor(memory, 'beta', 'beta-user', 'beta-org');
    const shared = await store.createNode({
      name: 'Project Atlas',
      kind: 'project',
      scopeIds: [alphaScopeIds[1]!],
    });
    await store.createNode({
      name: 'Shared Brief',
      kind: 'note',
      scopeIds: [alphaScopeIds[1]!],
    });
    const secret = await store.createNode({
      name: 'Beta Secret',
      kind: 'secret',
      scopeIds: [betaScopeIds[2]!],
    });
    await store.createRecord({
      node: shared,
      text: '[[Maya Chen]] owns Atlas.',
      scopeIds: [alphaScopeIds[1]!],
      source: 'alpha',
      metadata: { sourceThreadId: 'alpha' },
    });
    await store.createRecord({
      node: secret,
      text: 'Sibling-only information.',
      scopeIds: [betaScopeIds[2]!],
      source: 'beta',
      metadata: { sourceThreadId: 'beta' },
    });

    const tools = memory.listTools();
    const read = await tools.knowledge_read!.execute?.({ name: 'Project Atlas' }, toolContext());
    expect(read).toMatchObject({ found: true, node: { name: 'Project Atlas' } });
    expect((read as any).records[0].text).toContain('Maya Chen');
    const hidden = await tools.knowledge_read!.execute?.({ name: 'Beta Secret' }, toolContext());
    expect(hidden).toEqual({ found: false });
    const firstPage = await tools.knowledge_browse!.execute?.({ limit: 1 }, toolContext());
    expect((firstPage as any).nodes).toHaveLength(1);
    expect((firstPage as any).nextCursor).toBeTruthy();
    const cursorNode = await store.getNode((firstPage as any).nodes[0].id);
    await store.updateNode({
      id: cursorNode!.id,
      version: cursorNode!.version,
      name: `${cursorNode!.name} renamed`,
    });
    const secondPage = await tools.knowledge_browse!.execute?.(
      { limit: 1, cursor: (firstPage as any).nextCursor },
      toolContext(),
    );
    expect((secondPage as any).nodes).toHaveLength(1);
    expect((secondPage as any).nodes[0].id).not.toBe((firstPage as any).nodes[0].id);
    expect([...(firstPage as any).nodes, ...(secondPage as any).nodes].map((node: any) => node.name)).not.toContain(
      'Beta Secret',
    );
  });

  it('keeps organization knowledge out of fixed resource-bound tool scopes', async () => {
    const memory = await createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const alphaScopeIds = await scopeIdsFor(memory);
    await store.createNode({ name: 'Organization handbook', scopeIds: [alphaScopeIds[0]!] });
    await store.createNode({ name: 'Resource handbook', scopeIds: [alphaScopeIds[1]!] });
    const tools = createKnowledgeTools(memory, alphaScopeIds.slice(1));

    await expect(tools.knowledge_read!.execute?.({ name: 'Organization handbook' }, toolContext())).resolves.toEqual({
      found: false,
    });
    await expect(tools.knowledge_read!.execute?.({ name: 'Resource handbook' }, toolContext())).resolves.toMatchObject({
      found: true,
    });
  });

  it('combines lexical and semantic results while filtering another organization even when the adapter ignores filters', async () => {
    const memory = await createMemory(true, true);
    const store = (await memory.storage.getStore('knowledge'))!;
    const alphaScopeIds = await scopeIdsFor(memory);
    const betaScopeIds = await scopeIdsFor(memory, 'beta', 'beta-user', 'beta-org');
    await store.createNode({ name: 'Project Atlas', kind: 'project', scopeIds: [alphaScopeIds[1]!] });
    await store.createNode({
      name: 'Deployment runbook',
      kind: 'document',
      metadata: { description: 'The cobalt rollout procedure.' },
      scopeIds: [alphaScopeIds[1]!],
    });
    const privateParent = await store.createNode({
      name: 'Beta Secret',
      kind: 'secret',
      scopeIds: [betaScopeIds[2]!],
    });
    const privateRecord = await store.createRecord({
      node: privateParent,
      text: 'The cobalt procedure is shared.',
      scopeIds: [betaScopeIds[2]!],
      source: 'beta',
      metadata: { sourceThreadId: 'beta' },
    });

    await memory.drainKnowledgeSemanticIndex(betaScopeIds);
    const tools = memory.listTools();
    const result = await tools.knowledge_search!.execute?.({ query: 'cobalt rollout' }, toolContext());
    expect((result as any).results).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'node', name: 'Deployment runbook' })]),
    );
    expect((result as any).results.map((result: any) => result.name)).not.toContain('Beta Secret');
    expect((result as any).results.map((result: any) => result.id)).not.toContain(privateRecord.id);
    expect((result as any).results.some((result: any) => result.sources.includes('semantic'))).toBe(true);
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
