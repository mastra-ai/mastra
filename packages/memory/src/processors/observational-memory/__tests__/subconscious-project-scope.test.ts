import { Agent, setRunAgentScopes } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import type { ComputeStateSignalArgs } from '@mastra/core/processors';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { createPinnedTools, PinnedStateProcessor, Subconscious } from '../subconscious';
import { SubconsciousCurateExtractor } from '../subconscious/curate';
import { resolveRunKnowledgeScopes } from '../subconscious/knowledge-tools';
import { SubconsciousRemindExtractor } from '../subconscious/remind';

/** A Factory-style host: org → project → thread, where every session of a project shares the project scope. */
const projectScopeTypes = {
  'org:$orgId': { identity: true, access: [{ principal: 'self', role: 'owner' as const }] },
  'project:$projectId': {
    identity: true,
    parent: 'org:$orgId',
    access: [{ principal: 'self', role: 'owner' as const }],
  },
  'thread:$threadId': {
    identity: true,
    parent: 'project:$projectId',
    access: [{ principal: 'self', role: 'owner' as const }],
  },
};

function createMemory() {
  const storage = new InMemoryStore();
  return new Memory({
    storage,
    knowledge: new Knowledge({ id: 'default', storage, scopes: projectScopeTypes }),
    ...semanticInfrastructure,
  });
}

function runScopesFor(memory: Memory, requestContext: RequestContext, threadId = 'thread-a') {
  return resolveRunKnowledgeScopes(memory, {
    agent: { threadId, resourceId: 'session-a' },
    requestContext,
  });
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

/** A run's request context with the trusted agent scopes the host stamped on it. */
function requestContextFor(projectId?: string) {
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, projectId ? ['org:acme', `project:${projectId}`] : ['org:acme']);
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

describe('Subconscious on a host-configured project scope', () => {
  it('the pinned state processor surfaces a pin written under the project scope to a different session', async () => {
    const memory = createMemory();
    const { scopeIds, levels } = await runScopesFor(memory, requestContextFor('project-1'));
    expect(levels.map(level => level.address)).toEqual(['org:acme', 'project:project-1', 'thread:thread-a']);
    const tools = createPinnedTools(memory, {
      scopeIds,
      levels,
      sourceThreadId: 'thread-a',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    const pinned = (await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any)) as any;

    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => memory.getKnowledgeInstance(),
      getKnowledgeStore: () => memory.getKnowledgeStore(),
    });

    // Session B in the same project sees the pin.
    const sameProject = await processor.computeStateSignal(makeSignalArgs(requestContextFor('project-1')));
    expect(sameProject).toMatchObject({ mode: 'snapshot' });
    expect(sameProject!.contents).toContain(pinned.id);

    // Session B in another project sees nothing.
    const otherProject = await processor.computeStateSignal(
      makeSignalArgs(requestContextFor('project-2'), { threadId: 'thread-c' }),
    );
    expect(otherProject).toBeUndefined();
  });

  it('a changed project on the same request context reads fresh instead of serving the memo', async () => {
    const memory = createMemory();
    const { scopeIds, levels } = await runScopesFor(memory, requestContextFor('project-1'));
    const tools = createPinnedTools(memory, {
      scopeIds,
      levels,
      sourceThreadId: 'thread-a',
      maxPins: 20,
      maxCharacters: 2_000,
    });
    await tools.knowledge_pin!.execute!({ text: 'Project one pin.' } as any, {} as any);

    const processor = new PinnedStateProcessor({
      getKnowledgeInstance: () => memory.getKnowledgeInstance(),
      getKnowledgeStore: () => memory.getKnowledgeStore(),
    });
    const requestContext = requestContextFor('project-1');

    const first = await processor.computeStateSignal(makeSignalArgs(requestContext));
    expect(first).toMatchObject({ mode: 'snapshot' });

    // Same request context, later step, but the run is now in another project (a thread's project
    // is fixed when it is created, so this is another thread): the memo must not be served.
    setRunAgentScopes(requestContext, ['org:acme', 'project:project-2']);
    const second = await processor.computeStateSignal(
      makeSignalArgs(requestContext, { stepNumber: 1, threadId: 'thread-c' }),
    );
    expect(second).toBeUndefined();
  });

  it('curate and remind search the run’s project scope, not another project’s', async () => {
    const memory = createMemory();
    const store = (await memory.storage.getStore('knowledge'))!;
    const search = vi.spyOn(store, 'search');
    const projectScopeIds = (await runScopesFor(memory, requestContextFor('project-1'))).scopeIds;
    const otherScopeIds = (await runScopesFor(memory, requestContextFor('project-2'), 'thread-c')).scopeIds;
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
      requestContext: requestContextFor('project-1'),
      observationCommitted: Promise.resolve(true),
    });
    await vi.waitFor(() => expect(curatorAgent).toBeDefined());
    const tools = await curatorAgent!.listTools();
    await (tools.knowledge_search as any).execute({ query: 'Project Atlas' }, {});
    expect(search).toHaveBeenCalled();
    for (const call of search.mock.calls) {
      expect(call[0]!.scopeIds).toContain(projectScopeIds[1]);
      expect(call[0]!.scopeIds).not.toContain(otherScopeIds[1]);
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
        requestContext: requestContextFor('project-1'),
      } as any),
    ).catch(() => undefined);
    expect(search).toHaveBeenCalled();
    for (const call of search.mock.calls) {
      expect(call[0]!.scopeIds).toContain(projectScopeIds[1]);
      expect(call[0]!.scopeIds).not.toContain(otherScopeIds[1]);
    }
  });
});
