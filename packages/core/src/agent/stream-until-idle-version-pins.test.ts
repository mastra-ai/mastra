import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../request-context';
import { runDurableStreamUntilIdle } from './durable/durable-stream-until-idle';
import { runStreamUntilIdle } from './stream-until-idle';
import { setAgentVersionPins } from './version-pins';

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

function fakeVersionedAgent(durable: boolean) {
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
  it('keeps a regular label-selected run on its original exact ID for background continuations', async () => {
    const { agent, continuationVersions } = fakeVersionedAgent(false);
    const result = await runStreamUntilIdle(
      agent as any,
      'start',
      {
        requestContext: new RequestContext(),
        memory: { thread: 'thread', resource: 'resource' },
        versions: { self: { label: 'production' } },
      },
      { activeStreams: new Map(), bgManager: completionManager() },
    );
    await drain(result.fullStream);

    expect(continuationVersions).toEqual([{ defaultStatus: 'published', self: { versionId: 'v1' } }]);
  });

  it('keeps a durable label-selected run on its original exact ID for background continuations', async () => {
    const { agent, continuationVersions } = fakeVersionedAgent(true);
    const result = await runDurableStreamUntilIdle(
      agent as any,
      'start',
      {
        requestContext: new RequestContext(),
        memory: { thread: 'thread', resource: 'resource' },
        versions: { self: { label: 'production' } },
      },
      { activeStreams: new Map(), bgManager: completionManager() },
    );
    await drain(result.fullStream);

    expect(continuationVersions).toEqual([{ defaultStatus: 'published', self: { versionId: 'v1' } }]);
  });
});
