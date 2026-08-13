import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious, SubconsciousCaptureExtractor } from '../subconscious';
import { createCuratorHandler } from '../subconscious/curate';
import { createLearnerHandler } from '../subconscious/learn';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

const PROJECT_SCOPE = ['org:acme', 'resource:project-1'];

function requestContextWith(overrides: Record<string, unknown> = {}) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  for (const [key, value] of Object.entries(overrides)) requestContext.set(key, value);
  return requestContext;
}

function captureContext(memory: Memory, requestContext: RequestContext, resourceId = 'session-a') {
  return {
    source: 'observer' as const,
    threadId: 'thread-a',
    resourceId,
    memory,
    requestContext,
    current: {
      entities: [{ name: 'Shared Entity', kind: 'note', facts: [{ text: 'The rollout region is cobalt.' }] }],
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
  it('capture writes entities and facts under knowledgeResourceId instead of the run resourceId', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      maxScope: 'resource',
      learnedGuidance: false,
    });
    const requestContext = requestContextWith({ knowledgeResourceId: 'project-1' });

    await extractor.onExtracted?.({ ...captureContext(memory, requestContext), extractor } as any);

    const store = (await memory.storage.getStore('knowledge'))!;
    const shared = await store.getEntityByName({ name: 'Shared Entity', scope: PROJECT_SCOPE });
    expect(shared).toMatchObject({ scope: PROJECT_SCOPE });
    expect(
      await store.getEntityByName({ name: 'Shared Entity', scope: ['org:acme', 'resource:session-a'] }),
    ).toBeNull();

    const facts = await store.factsAbout({ entityId: shared!.id, scope: [...PROJECT_SCOPE, 'thread:thread-a'] });
    expect(facts.facts).toHaveLength(1);
    // Unscoped captured facts land at thread level; the resource rung is the project.
    expect(facts.facts[0]!.scope).toEqual([...PROJECT_SCOPE, 'thread:thread-a']);
  });

  it('capture falls back to the run resourceId when no override is present', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      maxScope: 'resource',
      learnedGuidance: false,
    });

    await extractor.onExtracted?.({ ...captureContext(memory, requestContextWith()), extractor } as any);

    const store = (await memory.storage.getStore('knowledge'))!;
    expect(
      await store.getEntityByName({ name: 'Shared Entity', scope: ['org:acme', 'resource:session-a'] }),
    ).toMatchObject({ scope: ['org:acme', 'resource:session-a'] });
    expect(await store.getEntityByName({ name: 'Shared Entity', scope: PROJECT_SCOPE })).toBeNull();
  });

  it('knowledge read tools from a different run resourceId see project-scoped knowledge under the override', async () => {
    const { vector, embedder } = createSemanticDependencies();
    const memory = new Memory({
      storage: new InMemoryStore(),
      vector,
      embedder,
      options: {
        observationalMemory: {
          model: 'google/gemini-2.5-flash',
          subconscious: new Subconscious({ tools: true }),
        },
      },
    });
    // Session A captures under the override.
    const extractor = new SubconsciousCaptureExtractor({
      defaultScope: 'resource',
      maxScope: 'resource',
      learnedGuidance: false,
    });
    await extractor.onExtracted?.({
      ...captureContext(memory, requestContextWith({ knowledgeResourceId: 'project-1' })),
      extractor,
    } as any);

    const tools = memory.listTools();
    // Session B, different run resourceId, same override: the entity is visible.
    const sharedRead = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Shared Entity' }, {
      agent: { threadId: 'thread-b', resourceId: 'session-b' },
      requestContext: requestContextWith({ knowledgeResourceId: 'project-1' }),
    } as any);
    expect(sharedRead).toMatchObject({ found: true, entity: { name: 'Shared Entity' } });

    // Session B without the override: siloed, nothing found.
    const siloedRead = await tools.knowledge_read!.execute?.({ type: 'entity', name: 'Shared Entity' }, {
      agent: { threadId: 'thread-b', resourceId: 'session-b' },
      requestContext: requestContextWith(),
    } as any);
    expect(siloedRead).toEqual({ found: false });
  });

  it('the pinned state processor surfaces a pin written under the project scope to a different session', async () => {
    const storage = new InMemoryStore();
    const memory = { storage } as unknown as Parameters<typeof createPinnedTools>[0];
    const tools = createPinnedTools(memory, {
      scope: [...PROJECT_SCOPE, 'thread:thread-a'],
      sourceThreadId: 'thread-a',
      defaultScope: 'resource',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    const pinned = (await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any)) as any;

    const processor = new PinnedStateProcessor({
      getKnowledgeStore: async () => (storage as any).getStore('knowledge'),
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
    const storage = new InMemoryStore();
    const memory = { storage } as unknown as Parameters<typeof createPinnedTools>[0];
    const tools = createPinnedTools(memory, {
      scope: [...PROJECT_SCOPE, 'thread:thread-a'],
      sourceThreadId: 'thread-a',
      defaultScope: 'resource',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    await tools.knowledge_pin!.execute!({ text: 'Project one pin.' } as any, {} as any);

    const processor = new PinnedStateProcessor({
      getKnowledgeStore: async () => (storage as any).getStore('knowledge'),
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
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const listFactsBySource = vi.spyOn(store, 'listFactsBySource');
    const search = vi.spyOn(store, 'search');

    const resolved = {
      observation: [],
      reflection: [
        { name: 'curate', maxSteps: 5, builtIn: true },
        { name: 'learn', maxSteps: 5, builtIn: true },
      ],
      defaultScope: 'resource',
      maxScope: 'resource',
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
    for (const call of listFactsBySource.mock.calls) {
      expect(call[0]!.scope).toContain('resource:project-1');
      expect(call[0]!.scope).not.toContain('resource:session-a');
    }
    expect(listFactsBySource).toHaveBeenCalled();

    const remind = new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true } as any);
    await Promise.resolve(
      remind.onExtracted?.({
        source: 'observer',
        threadId: 'thread-a',
        resourceId: 'session-a',
        rawObservations: 'The user is scheduling Project Atlas.',
        memory: { storage: memory.storage, getKnowledgeSemanticIndex: vi.fn() },
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
      expect(call[0]!.scope).toContain('resource:project-1');
      expect(call[0]!.scope).not.toContain('resource:session-a');
    }
  });
});
