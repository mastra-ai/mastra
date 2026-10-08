import { describe, expect, it, vi } from 'vitest';
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
