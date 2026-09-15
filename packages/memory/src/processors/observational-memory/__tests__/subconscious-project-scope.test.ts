import { Agent } from '@mastra/core/agent';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious } from '../subconscious';
import { SubconsciousCurateExtractor } from '../subconscious/curate';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

const PROJECT_SCOPE = ['org:acme', 'resource:project-1'];
const semanticInfrastructure = {
  vector: {
    indexSeparator: '_',
    listIndexes: vi.fn(async () => ['knowledge_documents_dimension_2']),
    createIndex: vi.fn(async () => undefined),
    upsert: vi.fn(async () => []),
    deleteVectors: vi.fn(async () => undefined),
    query: vi.fn(async () => []),
  } as unknown as MastraVector,
  embedder: {
    doEmbed: vi.fn(async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1, 0.2]) })),
  } as unknown as MastraEmbeddingModel<string>,
};

function requestContextWith(overrides: Record<string, unknown> = {}) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  for (const [key, value] of Object.entries(overrides)) requestContext.set(key, value);
  return requestContext;
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

afterEach(() => vi.restoreAllMocks());

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

  it('curate and remind resolve search scope from the override', async () => {
    const memory = new Memory({ storage: new InMemoryStore(), ...semanticInfrastructure });
    const store = (await memory.storage.getStore('knowledge'))!;
    const search = vi.spyOn(store, 'search');
    const subconscious = new Subconscious({
      observation: [{ name: 'curate', model: 'mock/model', maxSteps: 5 }],
      defaultScope: 'resource',
      maxScope: 'resource',
    });
    let curatorAgent: Agent | undefined;
    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation(function (this: Agent) {
      curatorAgent = this;
      return { accepted: new Promise(() => {}), signal: {} } as any;
    });
    const curatorConfig = subconscious.resolved.observation.find(agent => agent.name === 'curate')!;
    const curate = new SubconsciousCurateExtractor(curatorConfig, subconscious.resolved, () => memory, 'mock/model');

    await curate.onExtracted?.({
      source: 'observer',
      extractor: curate,
      threadId: 'thread-a',
      resourceId: 'session-a',
      current: 'Project Atlas launches soon.',
      rawObservations: 'Project Atlas launches soon.',
      memory,
      requestContext: requestContextWith({ knowledgeResourceId: 'project-1' }),
    });
    const tools = await curatorAgent!.listTools();
    await (tools.knowledge_search as any).execute({ query: 'Project Atlas' }, {});
    expect(search).toHaveBeenCalled();
    for (const call of search.mock.calls) {
      expect(call[0]!.scope).toContain('resource:project-1');
      expect(call[0]!.scope).not.toContain('resource:session-a');
    }

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
