import { afterEach, describe, expect, it } from 'vitest';

import { createRealV1Harness } from '../test-utils/real-v1-harness.js';

const cleanups: Array<() => void> = [];

/**
 * Model-level stream that emits a short text delta, a `task_write` tool call,
 * and a finish with usage. The agent executes the tool and surfaces a
 * tool-result chunk in its `fullStream`.
 */
function taskWriteStream(): ReadableStream {
  const input = JSON.stringify({
    tasks: [
      { id: 't1', content: 'Plan', status: 'completed', activeForm: 'Planning' },
      { id: 't2', content: 'Verify', status: 'in_progress', activeForm: 'Verifying' },
    ],
  });
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Working' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'task_write',
        input,
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 },
      });
      controller.close();
    },
  });
}

describe('v1 session.signalStream', () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  it('streams the core display-event chunks and persists task state', async () => {
    const { harness, cleanup } = createRealV1Harness<{ tasks?: unknown[] }>({
      doStream: async () => ({ stream: taskWriteStream() }),
    });
    cleanups.push(cleanup);
    await harness.init();

    const session = await harness.session({ threadId: 'thread-stream', resourceId: 'res-1' });

    const output = (await session.signalStream({
      messages: [{ role: 'user', content: 'Create tasks' }],
    })) as { fullStream: AsyncIterable<{ type: string; payload?: unknown }> };

    const seen: string[] = [];
    let usage: { totalTokens?: number } | undefined;
    for await (const chunk of output.fullStream) {
      seen.push(chunk.type);
      if (chunk.type === 'finish' || chunk.type === 'step-finish') {
        const p = chunk.payload as { output?: { usage?: { totalTokens?: number } }; usage?: { totalTokens?: number } };
        usage = p.output?.usage ?? p.usage ?? usage;
      }
    }

    // Core display-event union surfaces through the agent stream.
    expect(seen).toContain('text-delta');
    expect(seen).toContain('tool-call');
    expect(seen).toContain('tool-result');
    expect(seen.some(t => t === 'finish' || t === 'step-finish')).toBe(true);
    expect(usage?.totalTokens).toBeGreaterThan(0);

    // Tasks are session-owned: the built-in task_write persisted to session state.
    const tasks = (session.getState() as { tasks?: Array<{ content: string; status: string }> }).tasks ?? [];
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.content)).toEqual(['Plan', 'Verify']);
  });

  it('returns run status to idle after the stream settles', async () => {
    const { harness, cleanup } = createRealV1Harness({
      doStream: async () => ({ stream: taskWriteStream() }),
    });
    cleanups.push(cleanup);
    await harness.init();

    const session = await harness.session({ threadId: 'thread-idle', resourceId: 'res-1' });
    const output = (await session.signalStream({
      messages: [{ role: 'user', content: 'Go' }],
    })) as { fullStream: AsyncIterable<unknown> };

    // Drain the stream so it settles.
    for await (const _ of output.fullStream) {
      // consume
    }

    // After settle, the session is idle again (a fresh signal can run).
    await expect(
      session.signalStream({ messages: [{ role: 'user', content: 'Again' }] }),
    ).resolves.toBeDefined();
  });
});
