import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious } from '../subconscious';
import { SubconsciousCurateExtractor } from '../subconscious/curate';
import { resolveKnowledgeScopeIds } from '../subconscious/knowledge-tools';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

function createMemory() {
  const storage = new InMemoryStore();
  return new Memory({ storage, knowledge: new Knowledge({ id: 'default', storage }), ...semanticInfrastructure });
}

async function scopeIdsFor(memory: Memory, requestContext: RequestContext) {
  return resolveKnowledgeScopeIds(memory, { agent: { threadId: 'thread-a', resourceId: 'session-a' }, requestContext });
}
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

  it('curate and remind resolve search scope from the override', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const search = vi.spyOn(store, 'search');
    const projectScopeIds = await scopeIdsFor(memory, requestContextWith({ knowledgeResourceId: 'project-1' }));
    const sessionScopeIds = await scopeIdsFor(memory, requestContextWith());
    const subconscious = new Subconscious({
      observation: [{ name: 'curate', model: 'mock/model', maxSteps: 5 }],
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
      expect(call[0]!.scopeIds).toContain(projectScopeIds[1]);
      expect(call[0]!.scopeIds).not.toContain(sessionScopeIds[1]);
    }

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
