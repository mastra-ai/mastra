import { Knowledge } from '@mastra/core/knowledge';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious, SubconsciousCaptureExtractor } from '../subconscious';
import { createCuratorHandler } from '../subconscious/curate';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { createLearnerHandler } from '../subconscious/learn';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

function requestContextWith(overrides: Record<string, unknown> = {}) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  for (const [key, value] of Object.entries(overrides)) requestContext.set(key, value);
  return requestContext;
}

function createMemory(config: Record<string, unknown> = {}) {
  const storage = new InMemoryStore();
  return new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }), ...config });
}

async function scopeIdsFor(
  memory: Memory,
  requestContext: RequestContext,
  resourceId = 'session-a',
  threadId = 'thread-a',
) {
  return resolveKnowledgeScopeIds(memory, { agent: { threadId, resourceId }, requestContext });
}

function captureContext(memory: Memory, requestContext: RequestContext, resourceId = 'session-a') {
  return {
    source: 'observer' as const,
    threadId: 'thread-a',
    resourceId,
    memory,
    requestContext,
    current: {
      nodes: [
        {
          name: 'Shared Node',
          kind: 'note',
          scope: 'resource' as const,
          records: [{ text: 'The rollout region is cobalt.', scope: 'resource' as const }],
        },
      ],
    },
  };
}

function createSemanticDependencies() {
  const indexes = new Set<string>();
  const vector = {
    indexSeparator: '_',
    listIndexes: vi.fn(async () => [...indexes]),
    createIndex: vi.fn(async ({ indexName }: { indexName: string }) => void indexes.add(indexName)),
    upsert: vi.fn(async ({ ids }: any) => ids),
    deleteVectors: vi.fn(async () => undefined),
    query: vi.fn(async () => []),
  } as unknown as MastraVector;
  const embedder = {
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2, 0.3]) })),
  } as unknown as MastraEmbeddingModel<string>;
  return { vector, embedder };
}

function makeSignalArgs(
  requestContext: { get?(key: string): unknown; set?(key: string, value: unknown): void },
  overrides: Partial<ComputeStateSignalArgs> = {},
): ComputeStateSignalArgs {
  return {
    threadId: 'thread-b',
    resourceId: 'session-b',
    stepNumber: 0,
    requestContext,
    contextWindow: { hasSnapshot: false },
    lastSnapshot: undefined,
    deltasSinceSnapshot: [],
    tracking: undefined,
    ...overrides,
  } as unknown as ComputeStateSignalArgs;
}

describe('Subconscious project scope override', () => {
  it('capture writes nodes and records under knowledgeResourceId instead of the run resourceId', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });
    const requestContext = requestContextWith({ knowledgeResourceId: 'project-1' });

    await extractor.onExtracted?.({ ...captureContext(memory, requestContext), extractor } as any);

    const store = (await memory.storage.getStore('knowledge'))!;
    const projectScopeIds = await scopeIdsFor(memory, requestContext);
    const sessionScopeIds = await scopeIdsFor(memory, requestContextWith());
    const shared = await store.resolveNode({ name: 'Shared Node', scopeIds: projectScopeIds });
    expect(shared).not.toBeNull();
    expect(await store.getNodeScopeIds(shared!.id)).toEqual([projectScopeIds[3]]);
    expect(await store.resolveNode({ name: 'Shared Node', scopeIds: sessionScopeIds })).toBeNull();

    const records = await store.listRecords({ node: shared!, scopeIds: projectScopeIds });
    expect(records.records).toHaveLength(1);
    expect(await store.getRecordScopeIds(records.records[0]!.id)).toEqual([projectScopeIds[3]]);
  });

  it('capture falls back to the run resourceId when no override is present', async () => {
    const memory = createMemory();
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });

    await extractor.onExtracted?.({ ...captureContext(memory, requestContextWith()), extractor } as any);

    const store = (await memory.storage.getStore('knowledge'))!;
    const sessionScopeIds = await scopeIdsFor(memory, requestContextWith());
    const projectScopeIds = await scopeIdsFor(memory, requestContextWith({ knowledgeResourceId: 'project-1' }));
    const shared = await store.resolveNode({ name: 'Shared Node', scopeIds: sessionScopeIds });
    expect(shared).not.toBeNull();
    expect(await store.getNodeScopeIds(shared!.id)).toEqual([sessionScopeIds[3]]);
    expect(await store.resolveNode({ name: 'Shared Node', scopeIds: projectScopeIds })).toBeNull();
  });

  it('knowledge read tools from a different run resourceId see project-scoped knowledge under the override', async () => {
    const { vector, embedder } = createSemanticDependencies();
    const memory = createMemory({
      vector,
      embedder,
      options: {
        observationalMemory: {
          model: 'google/gemini-2.5-flash',
          experimental_subconscious: new Subconscious({ tools: true }),
        },
      },
    });
    // Session A captures under the override.
    const extractor = new SubconsciousCaptureExtractor({
      learnedGuidance: false,
    });
    await extractor.onExtracted?.({
      ...captureContext(memory, requestContextWith({ knowledgeResourceId: 'project-1' })),
      extractor,
    } as any);

    const tools = memory.listTools();
    // Session B, different run resourceId, same override: the node is visible.
    const sharedRead = await tools.knowledge_read!.execute?.({ name: 'Shared Node' }, {
      agent: { threadId: 'thread-b', resourceId: 'session-b' },
      requestContext: requestContextWith({ knowledgeResourceId: 'project-1' }),
    } as any);
    expect(sharedRead).toMatchObject({ found: true, node: { name: 'Shared Node' } });

    // Session B without the override: siloed, nothing found.
    const siloedRead = await tools.knowledge_read!.execute?.({ name: 'Shared Node' }, {
      agent: { threadId: 'thread-b', resourceId: 'session-b' },
      requestContext: requestContextWith(),
    } as any);
    expect(siloedRead).toEqual({ found: false });
  });

  it('the pinned state processor surfaces a pin written under the project scope to a different session', async () => {
    const memory = createMemory();
    const scopeIds = await scopeIdsFor(memory, requestContextWith({ knowledgeResourceId: 'project-1' }));
    const tools = createPinnedTools(memory, {
      scopeIds,
      sourceThreadId: 'thread-a',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    const pinned = (await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any)) as any;

    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => memory.getKnowledgeInstance(),
      getKnowledgeStore: () => memory.getKnowledgeStore(),
    });

    // Session B with the override sees the pin.
    const withOverride = await processor.computeStateSignal(
      makeSignalArgs(requestContextWith({ knowledgeResourceId: 'project-1' })),
    );
    expect(withOverride).toMatchObject({ mode: 'snapshot' });
    expect(withOverride!.contents).toContain(pinned.id);

    // Session B without the override sees nothing.
    const withoutOverride = await processor.computeStateSignal(makeSignalArgs(requestContextWith()));
    expect(withoutOverride).toBeUndefined();
  });

  it('a changed override on the same request context reads fresh instead of serving the memo', async () => {
    const memory = createMemory();
    const scopeIds = await scopeIdsFor(memory, requestContextWith({ knowledgeResourceId: 'project-1' }));
    const tools = createPinnedTools(memory, {
      scopeIds,
      sourceThreadId: 'thread-a',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    await tools.knowledge_pin!.execute!({ text: 'Project one pin.' } as any, {} as any);

    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => memory.getKnowledgeInstance(),
      getKnowledgeStore: () => memory.getKnowledgeStore(),
    });
    const requestContext = requestContextWith({ knowledgeResourceId: 'project-1' });

    const first = await processor.computeStateSignal(makeSignalArgs(requestContext));
    expect(first).toMatchObject({ mode: 'snapshot' });

    // Same request context, later step, but the override moved to another project:
    // the scope key differs, so the memo must not be served.
    requestContext.set('knowledgeResourceId', 'project-2');
    const second = await processor.computeStateSignal(makeSignalArgs(requestContext, { stepNumber: 1 }));
    expect(second).toBeUndefined();
  });

  it('curate, learn, and remind resolve the worklist and search scope from the override', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const listRecordsBySource = vi.spyOn(store, 'listRecordsBySource');
    const search = vi.spyOn(store, 'search');
    const projectScopeIds = await scopeIdsFor(memory, requestContextWith({ knowledgeResourceId: 'project-1' }));
    const sessionScopeIds = await scopeIdsFor(memory, requestContextWith());

    const resolved = {
      observation: [],
      reflection: [
        { name: 'curate', maxSteps: 5, builtIn: true },
        { name: 'learn', maxSteps: 5, builtIn: true },
      ],
      learnedGuidance: true,
      tools: true,
      activity: { recentUpdates: 10 },
      pins: false,
    } as any;
    const reflectionContext = () =>
      ({
        parentThreadId: 'thread-a',
        resourceId: 'session-a',
        observations: '',
        requestContext: requestContextWith({ knowledgeResourceId: 'project-1' }),
        mainAgent: { getModel: vi.fn(async () => 'mock/model') },
      }) as any;

    await createCuratorHandler(memory, resolved)(reflectionContext());
    await createLearnerHandler(memory, resolved)(reflectionContext());
    for (const call of listRecordsBySource.mock.calls) {
      expect(call[0]!.scopeIds).toContain(projectScopeIds[1]);
      expect(call[0]!.scopeIds).not.toContain(sessionScopeIds[1]);
    }
    expect(listRecordsBySource).toHaveBeenCalled();

    const remind = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true } as any);
    await Promise.resolve(
      remind.onExtracted?.({
        source: 'observer',
        threadId: 'thread-a',
        resourceId: 'session-a',
        rawObservations: 'The user is scheduling Project Atlas.',
        memory,
        mainAgent: {
          getModel: vi.fn(async () => {
            throw new Error('stop before the agent runs');
          }),
        },
        sendSignal: vi.fn(async () => undefined),
        requestContext: requestContextWith({ knowledgeResourceId: 'project-1' }),
      } as any),
    ).catch(() => undefined);
    expect(search).toHaveBeenCalled();
    for (const call of search.mock.calls) {
      expect(call[0]!.scopeIds).toContain(projectScopeIds[1]);
      expect(call[0]!.scopeIds).not.toContain(sessionScopeIds[1]);
    }
  });
});
