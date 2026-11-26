import { describe, expect, it, vi } from 'vitest';
import { ProcessorState } from '../../../processors/runner';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../../request-context';
import { DURABLE_CONTEXT_SEGMENT_KEY, globalRunRegistry } from '../run-registry';
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

  it('rebuilds tools built for an earlier segment, keeping memory, workspace and run state', async () => {
    const runId = 'stale-segment-replace';
    const saveQueueManager = {};
    const processorStates = new Map();
    const outputProcessors = [{ id: 'kept' }];
    const aliceTools = {
      approve: { id: 'approve', built: 'alice' },
      omitted: { id: 'omitted', built: 'alice' },
    };
    const processorTool = { id: 'processor-tool' };
    const entry = {
      model: {},
      requestTools: aliceTools,
      baseTools: { ...aliceTools, processorTool },
      // prepareStep withheld `omitted` for this step, and a processor added `processorTool`.
      tools: { approve: aliceTools.approve, processorTool },
      memory: { built: 'alice' },
      workspace: { built: 'alice' },
      requestContext: new RequestContext([['mastra__user', { id: 'alice' }]]),
      requestContextSegment: 'segment-1',
      saveQueueManager,
      processorStates,
      outputProcessors,
      memoryAuthorizationChecks: new Map([['memory:write', Promise.resolve()]]),
    };
    globalRunRegistry.set(runId, entry as any);
    const agent = {
      getToolsForExecution: vi.fn().mockResolvedValue({
        approve: { id: 'approve', built: 'bob' },
        omitted: { id: 'omitted', built: 'bob' },
      }),
      getMemory: vi.fn().mockResolvedValue({ built: 'bob' }),
      getWorkspace: vi.fn().mockResolvedValue({ built: 'bob' }),
    };
    const stepContext = () =>
      new RequestContext<unknown>([
        [DURABLE_CONTEXT_SEGMENT_KEY, 'segment-2'],
        ['mastra__user', { id: 'bob' }],
      ]);
    // One instance, so the sibling rebuild below is checked against the replaced entry's segment.
    const mastra = makeMastra(agent);
    const rebuild = () =>
      rebuildRunToolsFromMastra({
        mastra,
        runId,
        agentId: 'agent-1',
        state: {} as any,
        requestContextEntries: { marker: 'A', mastra__user: { id: 'alice' } },
        requestContext: stepContext(),
        rehydrateProcessors: true,
        replaceStale: true,
      });

    try {
      await rebuild();
      const replaced = globalRunRegistry.get(runId)!;
      expect(replaced.tools).toEqual({ approve: { id: 'approve', built: 'bob' }, processorTool });
      expect(replaced.baseTools).toEqual({
        approve: { id: 'approve', built: 'bob' },
        omitted: { id: 'omitted', built: 'bob' },
        processorTool,
      });
      expect(replaced.memory).toEqual({ built: 'alice' });
      expect(replaced.workspace).toEqual({ built: 'alice' });
      expect(replaced.requestContext?.get('mastra__user')).toEqual({ id: 'bob' });
      expect(replaced.requestContext?.get('marker')).toBe('A');
      expect(replaced.requestContextRebuilt).toBe(true);
      expect(replaced.requestContextSegment).toBe('segment-2');
      expect(replaced.saveQueueManager).toBe(saveQueueManager);
      expect(replaced.processorStates).toBe(processorStates);
      expect(replaced.outputProcessors).toBe(outputProcessors);
      expect(replaced.memoryAuthorizationChecks).toBeUndefined();

      // A sibling step of the same segment reuses the replaced entry.
      const tools = replaced.tools;
      agent.getToolsForExecution.mockResolvedValue({ approve: { id: 'approve', built: 'sibling' } });
      await rebuild();
      expect(globalRunRegistry.get(runId)!.tools).toBe(tools);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it("drops request-built tools the resuming caller's build omits, keeping processor replacements", async () => {
    const runId = 'stale-segment-omitted-tool';
    const aliceTools = {
      approve: { id: 'approve', built: 'alice' },
      admin: { id: 'admin', built: 'alice' },
      search: { id: 'search', built: 'alice' },
    };
    const processorSearch = { id: 'search', built: 'processor' };
    const tools = { ...aliceTools, search: processorSearch };
    globalRunRegistry.set(runId, {
      model: {},
      requestTools: aliceTools,
      baseTools: tools,
      tools,
      requestContextSegment: 'segment-1',
    } as any);
    const agent = {
      ...makeAgent(),
      // Bob may not use `admin` or `search`.
      getToolsForExecution: vi.fn().mockResolvedValue({ approve: { id: 'approve', built: 'bob' } }),
    };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
        requestContext: new RequestContext<unknown>([[DURABLE_CONTEXT_SEGMENT_KEY, 'segment-2']]),
        rehydrateProcessors: true,
        replaceStale: true,
      });
      const replaced = globalRunRegistry.get(runId)!;
      const expected = { approve: { id: 'approve', built: 'bob' }, search: processorSearch };
      expect(replaced.tools).toEqual(expected);
      expect(replaced.baseTools).toEqual(expected);
      expect(replaced.requestTools).toEqual({ approve: { id: 'approve', built: 'bob' } });
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('does not replace an entry a later segment published during the rebuild', async () => {
    const runId = 'superseded-segment';
    const entry: Record<string, unknown> = {
      model: {},
      tools: { approve: { id: 'approve', built: 'alice' } },
      requestContextSegment: 'segment-1',
    };
    globalRunRegistry.set(runId, entry as any);
    const laterTools = { approve: { id: 'approve', built: 'carol' } };
    const agent = {
      ...makeAgent(),
      getToolsForExecution: vi.fn().mockImplementation(async () => {
        // Segment 3 publishes its entry while segment 2 is still building.
        entry.tools = laterTools;
        entry.requestContextSegment = 'segment-3';
        return { approve: { id: 'approve', built: 'bob' } };
      }),
    };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
        requestContext: new RequestContext<unknown>([[DURABLE_CONTEXT_SEGMENT_KEY, 'segment-2']]),
        rehydrateProcessors: true,
        replaceStale: true,
      });
      expect(entry.tools).toBe(laterTools);
      expect(entry.requestContextSegment).toBe('segment-3');
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('rebuilds tools for the method that started the run', async () => {
    const runId = 'stale-segment-method';
    globalRunRegistry.set(runId, {
      model: {},
      tools: { approve: {} },
      methodType: 'generate',
      requestContextSegment: 'segment-1',
    } as any);
    const agent = { ...makeAgent(), getToolsForExecution: vi.fn().mockResolvedValue({ approve: {} }) };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
        requestContext: new RequestContext<unknown>([[DURABLE_CONTEXT_SEGMENT_KEY, 'segment-2']]),
        rehydrateProcessors: true,
        replaceStale: true,
      });
      expect(agent.getToolsForExecution.mock.calls[0]![0].methodType).toBe('generate');
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('keeps tools built for the current segment', async () => {
    const runId = 'current-segment-keep';
    const tools = { approve: { id: 'approve', built: 'alice' } };
    const requestContext = new RequestContext<unknown>([[DURABLE_CONTEXT_SEGMENT_KEY, 'segment-1']]);
    globalRunRegistry.set(runId, { model: {}, tools, requestContext, requestContextSegment: 'segment-1' } as any);
    const agent = { ...makeAgent(), getToolsForExecution: vi.fn().mockResolvedValue({ approve: {} }) };

    try {
      await rebuildRunToolsFromMastra({
        mastra: makeMastra(agent),
        runId,
        agentId: 'agent-1',
        state: {} as any,
        requestContext: new RequestContext<unknown>([[DURABLE_CONTEXT_SEGMENT_KEY, 'segment-1']]),
        rehydrateProcessors: true,
        replaceStale: true,
      });
      const entry = globalRunRegistry.get(runId)!;
      expect(entry.tools).toBe(tools);
      expect(entry.requestContext).toBe(requestContext);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

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
