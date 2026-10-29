import { describe, expect, it, vi } from 'vitest';
import { ProcessorState } from '../../../processors/runner';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../../request-context';
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra } from './resolve-runtime';

/**
 * Regression coverage for #20210: when a durable run is rehydrated on a
 * cross-process worker (e.g. an Inngest step delegating to a subagent), the
 * step input carries no `requestContextEntries` snapshot. The rebuild must fall
 * back to the run-level RequestContext instead of resolving tools with an empty
 * one, otherwise request-scoped configuration is silently dropped.
 */
function makeMastra(agent: unknown) {
  return { getAgentById: () => agent } as any;
}

function makeAgent() {
  return {
    getToolsForExecution: vi.fn().mockResolvedValue({}),
    getMemory: vi.fn().mockResolvedValue(undefined),
    getWorkspace: vi.fn().mockResolvedValue(undefined),
  };
}

describe('rebuildRunToolsFromMastra request context', () => {
  it.each(['empty', 'placeholder', 'authoritative'] as const)(
    'shares the winning processor pipeline during concurrent %s hydration',
    async registryState => {
      const runId = `concurrent-hydration-${registryState}`;
      const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
      const bothStarted = Promise.withResolvers<void>();
      const pipelines = [[{ id: 'first' }], [{ id: 'second' }]];
      const contexts: RequestContext[] = [];
      const agent = {
        ...makeAgent(),
        getToolsForExecution: vi.fn().mockResolvedValue({ rebuilt: {} }),
        listOutputProcessors: vi.fn().mockImplementation(async (requestContext: RequestContext) => {
          const index = agent.listOutputProcessors.mock.calls.length - 1;
          contexts[index] = requestContext;
          requestContext.set('hydration', index);
          if (index === 1) bothStarted.resolve();
          await gates[index]!.promise;
          return pipelines[index];
        }),
      };
      const snapshot = {};
      if (registryState === 'placeholder') {
        globalRunRegistry.set(runId, { isPlaceholder: true, tools: {} } as any);
      }
      // Sibling steps of one run share the same Mastra instance.
      const mastra = makeMastra(agent);
      const rebuild = () =>
        rebuildRunToolsFromMastra({
          mastra,
          runId,
          agentId: 'agent-1',
          state: {} as any,
          rehydrateProcessors: true,
        });
      const firstCall = rebuild();
      const secondCall = rebuild();
      try {
        await bothStarted.promise;
        if (registryState === 'authoritative') {
          globalRunRegistry.set(runId, { model: {}, tools: snapshot } as any);
        }
        gates[0]!.resolve();
        const first = await firstCall;
        const published = globalRunRegistry.get(runId)!;
        const state = new ProcessorState();
        state.customState.processedChunks = 1;
        published.processorStates!.set('first', state);
        gates[1]!.resolve();
        const second = await secondCall;

        expect(globalRunRegistry.get(runId)).toBe(published);
        expect(first?.outputProcessors).toBe(pipelines[0]);
        expect(second?.outputProcessors).toBe(first?.outputProcessors);
        expect(second?.processorStates).toBe(first?.processorStates);
        expect(second?.processorStates).toBe(published.processorStates);
        expect(second?.processorStates?.get('first')).toBe(state);
        expect(state.customState.processedChunks).toBe(1);
        expect(published.requestContext).toBe(contexts[0]);
        expect(published.requestContext?.get('hydration')).toBe(0);
        if (registryState === 'authoritative') {
          expect(published.tools).toBe(snapshot);
          expect(published.tools).toEqual({});
        }
      } finally {
        gates.forEach(gate => gate.resolve());
        await Promise.allSettled([firstCall, secondCall]);
        globalRunRegistry.delete(runId);
      }
    },
  );

  it('retains the missing-agent fallback when processor hydration is requested', async () => {
    const runId = 'missing-agent-rebuild';
    const getAgentById = vi.fn().mockImplementation(() => {
      throw new Error('Agent with id missing-agent not found');
    });

    await expect(
      rebuildRunToolsFromMastra({
        mastra: { getAgentById } as any,
        runId,
        agentId: 'missing-agent',
        state: {} as any,
        rehydrateProcessors: true,
      }),
    ).resolves.toBeUndefined();
    expect(getAgentById).toHaveBeenCalledWith('missing-agent');
    expect(globalRunRegistry.has(runId)).toBe(false);
  });

  it('rebuilds the save queue without resolving processors for persistence-only callers', async () => {
    const runId = 'persistence-only-rebuild';
    const memory = {};
    const listOutputProcessors = vi.fn().mockRejectedValue(new Error('must not resolve processors'));
    const agent = {
      ...makeAgent(),
      getMemory: vi.fn().mockResolvedValue(memory),
      listOutputProcessors,
    };

    try {
      const rebuilt = await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
      });

      expect(rebuilt?.saveQueueManager).toBeDefined();
      expect(rebuilt?.memory).toBe(memory);
      expect(listOutputProcessors).not.toHaveBeenCalled();
      expect(globalRunRegistry.get(runId)?.outputProcessors).toBeUndefined();
      expect(globalRunRegistry.get(runId)?.errorProcessors).toBeUndefined();
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  // The finish path compares the writer the run started with against the one this worker
  // rebuilt, so the rebuild must resolve it from its own configured processors.
  it.each([
    { name: 'without the call-time MessageHistory', configured: [], kind: 'memory' },
    {
      name: 'with an agent-level MessageHistory',
      configured: [{ id: 'message-history', persistMessages: vi.fn() }],
      kind: 'processor',
    },
  ])('resolves the history writer on a worker $name', async ({ configured, kind }) => {
    const runId = `history-writer-${kind}`;
    const memory = { getMergedThreadConfig: () => ({ lastMessages: 10 }) };
    const agent = {
      ...makeAgent(),
      getMemory: vi.fn().mockResolvedValue(memory),
      listConfiguredOutputProcessors: vi.fn().mockResolvedValue(configured),
      listOutputProcessors: vi.fn().mockResolvedValue([{ id: 'combined-workflow' }]),
    };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
        rehydrateProcessors: true,
      });

      expect(globalRunRegistry.get(runId)?.historyWriter?.kind).toBe(kind);
      expect(agent.listConfiguredOutputProcessors).toHaveBeenCalledTimes(1);
      expect(agent.listOutputProcessors).toHaveBeenCalledWith(expect.anything(), configured);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it("resolves a worker's output processors with the run's memory context", async () => {
    const runId = 'rebuild-memory-context';
    const memoryConfig = { lastMessages: false as const };
    let seen: unknown;
    const agent = {
      ...makeAgent(),
      getMemory: vi.fn().mockResolvedValue({ getMergedThreadConfig: () => memoryConfig }),
      listConfiguredOutputProcessors: vi.fn().mockResolvedValue([]),
      listOutputProcessors: vi.fn(async (requestContext: RequestContext) => {
        seen = requestContext.get('MastraMemory');
        return [];
      }),
    };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: { threadId: 'thread-1', resourceId: 'user-1', memoryConfig } as any,
        rehydrateProcessors: true,
      });

      expect(seen).toEqual({ thread: { id: 'thread-1' }, resourceId: 'user-1', memoryConfig });
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('a durable agent passes the resolved configured processors through instead of resolving them again', async () => {
    const { Agent } = await import('../../agent');
    const { createDurableAgent } = await import('../create-durable-agent');
    const resolver = vi.fn(() => []);
    const agent = new Agent({
      id: 'resolver-agent',
      name: 'resolver-agent',
      instructions: 'test',
      model: 'openai/gpt-4o-mini',
      outputProcessors: resolver,
    });
    const durable = createDurableAgent({ agent });
    const requestContext = new RequestContext();

    const configured = await durable.listConfiguredOutputProcessors(requestContext);
    await durable.listOutputProcessors(requestContext, configured);

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it.each(['persistence-only', 'live-pipeline'] as const)(
    'keeps runtime resolution failures non-fatal for a %s rebuild',
    async registryState => {
      const runId = `resolution-failure-${registryState}`;
      const agent = makeAgent();
      agent.getWorkspace.mockRejectedValue(new Error('workspace resolution failed'));
      const outputProcessors: [] = [];
      const processorStates = new Map();
      if (registryState === 'live-pipeline') {
        globalRunRegistry.set(runId, { tools: {}, outputProcessors, processorStates } as any);
      }

      try {
        await expect(
          rebuildRunToolsFromMastra({
            mastra: makeMastra(agent),
            runId,
            agentId: 'agent-1',
            state: {} as any,
            rehydrateProcessors: registryState === 'live-pipeline',
          }),
        ).resolves.toBeUndefined();
        if (registryState === 'live-pipeline') {
          expect(globalRunRegistry.get(runId)?.outputProcessors).toBe(outputProcessors);
          expect(globalRunRegistry.get(runId)?.processorStates).toBe(processorStates);
        }
      } finally {
        globalRunRegistry.delete(runId);
      }
    },
  );

  it('falls back to the run-level context when the step input has no snapshot', async () => {
    const agent = makeAgent();
    const requestContext: RequestContext = new RequestContext([['tenantId', 'acme'] as const]);

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: 'run-1',
      agentId: 'agent-1',
      state: {} as any,
      requestContext,
    });

    const used = agent.getToolsForExecution.mock.calls[0]![0].requestContext;
    expect(used.get('tenantId')).toBe('acme');
  });

  it('prefers the step input snapshot when present', async () => {
    const agent = makeAgent();

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: 'run-1',
      agentId: 'agent-1',
      state: {} as any,
      requestContextEntries: { tenantId: 'from-snapshot' },
      requestContext: new RequestContext([['tenantId', 'from-run'] as const]),
    });

    const used = agent.getToolsForExecution.mock.calls[0]![0].requestContext;
    expect(used.get('tenantId')).toBe('from-snapshot');
  });

  it('carries the live auth token over the snapshot, which never persists it', async () => {
    const agent = makeAgent();

    const runLevel: RequestContext = new RequestContext<unknown>([['tenantId', 'from-run'] as const]);
    runLevel.setRaw(MASTRA_AUTH_TOKEN_KEY, 'live-bearer-token');

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: 'run-1',
      agentId: 'agent-1',
      state: {} as any,
      // The snapshot deliberately excludes the token (see preparation.ts).
      requestContextEntries: { tenantId: 'from-snapshot' },
      requestContext: runLevel,
    });

    const used = agent.getToolsForExecution.mock.calls[0]![0].requestContext;
    expect(used.get('tenantId')).toBe('from-snapshot');
    expect(used.getRaw(MASTRA_AUTH_TOKEN_KEY)).toBe('live-bearer-token');
  });

  it('drops a stale token from a legacy snapshot when no live token exists', async () => {
    const agent = makeAgent();

    await rebuildRunToolsFromMastra({
      mastra: makeMastra(agent),
      runId: 'run-1',
      agentId: 'agent-1',
      state: {} as any,
      // Legacy snapshot written before the token was excluded from persistence.
      requestContextEntries: { tenantId: 'from-snapshot', [MASTRA_AUTH_TOKEN_KEY]: 'stale-bearer-token' },
      requestContext: new RequestContext([['tenantId', 'from-run'] as const]),
    });

    const used = agent.getToolsForExecution.mock.calls[0]![0].requestContext;
    expect(used.get('tenantId')).toBe('from-snapshot');
    expect(used.getRaw(MASTRA_AUTH_TOKEN_KEY)).toBeUndefined();
  });
});
