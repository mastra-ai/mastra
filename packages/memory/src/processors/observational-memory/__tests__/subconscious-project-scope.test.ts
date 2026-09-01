import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious } from '../subconscious';
import { createCuratorHandler } from '../subconscious/curate';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

const PROJECT_SCOPE = ['org:acme', 'resource:project-1'];

function requestContextWith(overrides: Record<string, unknown> = {}) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  for (const [key, value] of Object.entries(overrides)) requestContext.set(key, value);
  return requestContext;
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

  it('curate and remind resolve the worklist and search scope from the override', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const store = (await memory.storage.getStore('knowledge'))!;
    const knowledgeBySource = vi.spyOn(store, 'knowledgeBySource');
    const search = vi.spyOn(store, 'search');

    const resolved = {
      observation: [],
      reflection: [{ name: 'curate', maxSteps: 5, builtIn: true }],
      defaultScope: 'resource',
      maxScope: 'resource',
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
    for (const call of knowledgeBySource.mock.calls) {
      expect(call[0]!.scope).toContain('resource:project-1');
      expect(call[0]!.scope).not.toContain('resource:session-a');
    }
    expect(knowledgeBySource).toHaveBeenCalled();

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
