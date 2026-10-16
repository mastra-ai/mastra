import { describe, expect, it, vi } from 'vitest';
import { MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY, MASTRA_VERSIONS_KEY, RequestContext } from '../request-context';
import { runDurableStreamUntilIdle } from './durable/durable-stream-until-idle';
import { runStreamUntilIdle } from './stream-until-idle';
import { getAgentVersionPins, MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, setAgentVersionPins } from './version-pins';

function emptyStream() {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

function completionManager() {
  return {
    stream: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'background-task-running', payload: { taskId: 'task' } });
          setTimeout(() => {
            controller.enqueue({
              type: 'background-task-completed',
              payload: { taskId: 'task', toolCallId: 'call', toolName: 'background' },
            });
            controller.close();
          }, 0);
        },
      }),
  } as any;
}

async function drain(stream: ReadableStream<unknown>) {
  for await (const _chunk of stream) {
    // Drain the wrapper so it can launch and finish its continuation.
  }
}

function fakeVersionedAgent(durable: boolean, onContinuation?: (requestContext: RequestContext) => void) {
  let labelTarget = 'v1';
  const continuationVersions: unknown[] = [];
  const stream = vi.fn(async (_messages: unknown, options: any) => {
    if (stream.mock.calls.length === 1) {
      setAgentVersionPins(options.requestContext, {
        root: { agentId: 'stored-agent', versionId: labelTarget, selectedLabel: 'production' },
        defaultStatus: 'published',
      });
      labelTarget = 'v2';
    } else {
      continuationVersions.push(options.versions);
      onContinuation?.(options.requestContext);
    }
    const fullStream = emptyStream();
    if (!durable) return { runId: crypto.randomUUID(), status: 'success', fullStream };
    return {
      runId: crypto.randomUUID(),
      fullStream,
      output: { fullStream },
      cleanup: vi.fn(),
      abort: vi.fn(),
    };
  });
  return {
    agent: {
      id: 'stored-agent',
      getDefaultOptions: () => ({}),
      getMemory: async () => ({}),
      stream,
    },
    continuationVersions,
  };
}

describe('streamUntilIdle version pins', () => {
  it.each(
    [
      { kind: 'regular', durable: false },
      { kind: 'durable', durable: true },
    ].flatMap(agent =>
      (['present', 'absent', 'present-undefined'] as const).flatMap(policy =>
        (['success', 'throws', 'aborts'] as const).map(outcome => ({ ...agent, policy, outcome })),
      ),
    ),
  )(
    'preserves caller context and $policy policy after a pinned $kind continuation $outcome without agent scopes',
    async ({ durable, policy, outcome }) => {
      const requestContext = new RequestContext();
      requestContext.set('callerValue', 'original');
      const originalPolicy = policy === 'present' ? { defaultLabel: 'caller-policy' } : undefined;
      const originalDelegated = policy === 'present' ? false : undefined;
      if (policy !== 'absent') {
        requestContext.set(MASTRA_VERSIONS_KEY, originalPolicy);
        requestContext.set(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY, originalDelegated);
      }
      const abortController = new AbortController();
      const continuationError = new Error('continuation failed');
      const continuationContexts: RequestContext[] = [];
      const continuationPolicies: unknown[] = [];
      const continuationMarkers: unknown[] = [];
      const { agent, continuationVersions } = fakeVersionedAgent(durable, context => {
        continuationContexts.push(context);
        continuationPolicies.push(context.get(MASTRA_VERSIONS_KEY));
        continuationMarkers.push(context.get(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY));
        context.set('callerValue', 'updated by continuation');
        if (outcome === 'throws') throw continuationError;
        if (outcome === 'aborts') abortController.abort();
      });
      const run = durable ? runDurableStreamUntilIdle : runStreamUntilIdle;
      const result = await run(
        agent as any,
        'start',
        {
          requestContext,
          memory: { thread: 'thread', resource: 'resource' },
          versions: { defaultLabel: 'production' },
          abortSignal: abortController.signal,
        },
        { activeStreams: new Map(), bgManager: completionManager() },
      );
      if (outcome === 'throws') await expect(drain(result.fullStream)).rejects.toBe(continuationError);
      else await drain(result.fullStream);

      expect(continuationVersions).toEqual([
        { defaultStatus: 'published', agents: { 'stored-agent': { versionId: 'v1' } } },
      ]);
      expect(continuationContexts).toHaveLength(1);
      expect(continuationContexts[0]).toBe(requestContext);
      expect(requestContext.get('callerValue')).toBe('updated by continuation');
      expect(continuationPolicies).toEqual(continuationVersions);
      expect(continuationMarkers).toEqual([true]);
      await vi.waitFor(() => {
        expect(requestContext.has(MASTRA_VERSIONS_KEY)).toBe(policy !== 'absent');
        expect(requestContext.get(MASTRA_VERSIONS_KEY)).toBe(originalPolicy);
        expect(requestContext.has(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY)).toBe(policy !== 'absent');
        expect(requestContext.get(MASTRA_AGENT_VERSION_PINS_DELEGATED_KEY)).toBe(originalDelegated);
        expect(requestContext.has(MASTRA_CONTINUATION_TOOL_CALL_IDS_KEY)).toBe(false);
      });
      expect(getAgentVersionPins(requestContext)?.root?.versionId).toBe('v1');
    },
  );

  it('keeps a regular label-selected run on its original exact ID for background continuations', async () => {
    const { agent, continuationVersions } = fakeVersionedAgent(false);
    const result = await runStreamUntilIdle(
      agent as any,
      'start',
      {
        requestContext: new RequestContext(),
        memory: { thread: 'thread', resource: 'resource' },
        versions: { defaultLabel: 'production' },
      },
      { activeStreams: new Map(), bgManager: completionManager() },
    );
    await drain(result.fullStream);

    expect(continuationVersions).toEqual([
      { defaultStatus: 'published', agents: { 'stored-agent': { versionId: 'v1' } } },
    ]);
  });

  it('keeps a durable label-selected run on its original exact ID for background continuations', async () => {
    const { agent, continuationVersions } = fakeVersionedAgent(true);
    const result = await runDurableStreamUntilIdle(
      agent as any,
      'start',
      {
        requestContext: new RequestContext(),
        memory: { thread: 'thread', resource: 'resource' },
        versions: { defaultLabel: 'production' },
      },
      { activeStreams: new Map(), bgManager: completionManager() },
    );
    await drain(result.fullStream);

    expect(continuationVersions).toEqual([
      { defaultStatus: 'published', agents: { 'stored-agent': { versionId: 'v1' } } },
    ]);
  });
});
