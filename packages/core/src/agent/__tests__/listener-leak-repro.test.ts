import { expect, it, vi } from 'vitest';

const counters = vi.hoisted(() => ({ active: 0 }));
vi.mock('../thread-saves', async importOriginal => {
  const original = await importOriginal<typeof import('../thread-saves')>();
  return {
    ...original,
    onThreadMessagesSaved: (...args: Parameters<typeof original.onThreadMessagesSaved>) => {
      const stop = original.onThreadMessagesSaved(...args);
      counters.active++;
      return () => {
        counters.active--;
        stop();
      };
    },
  };
});

import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { AsyncCallbackPubSub } from './signals-test-utils';

it('counts listeners left behind by suspended thread runs (#29010)', async () => {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new AsyncCallbackPubSub();
  const counts: number[] = [];
  for (let index = 0; index < 5; index++) {
    const runId = `parked-${index}`;
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            type: 'tool-call-approval',
            runId,
            payload: { toolCallId: `approval-${index}`, toolName: 'approve' },
          });
          // Keep the continuation stream open while approval is pending.
        },
      }),
      _waitUntilFinished: () => finished,
    };
    await runtime.registerRun(
      { id: 'approval-agent' } as any,
      output as any,
      { memory: { thread: `approval-thread-${index}`, resource: 'user' } } as any,
      pubsub,
    );
    output.status = 'suspended';
    finish();
    await new Promise(resolve => setTimeout(resolve, 20));
    counts.push(counters.active);
  }
  expect(counts).toEqual([0, 0, 0, 0, 0]);
});
