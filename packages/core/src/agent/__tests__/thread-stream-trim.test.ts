import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';
import { LeasePubSub } from './thread-stream-test-utils';

async function waitFor(predicate: () => boolean, timeoutMs = 2_000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

function setup(withMemory: boolean) {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new LeasePubSub();
  const trim = vi.spyOn(pubsub, 'trimTopic');
  const agent = {
    id: 'trim-agent',
    getMemory: async () => (withMemory ? {} : undefined),
  } as unknown as Agent<any, any, any, any>;
  const options = { memory: { thread: 'trim-thread', resource: 'trim-user' } } as any;

  const register = (runId: string, status: 'success' | 'failed' = 'success') => {
    let finish!: () => void;
    const finished = new Promise<void>(resolve => (finish = resolve));
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'start', runId });
          controller.close();
        },
      }),
      _waitUntilFinished: () => finished,
    } as any;
    const registered = runtime.registerRun(agent, output, options, pubsub);
    return {
      registered,
      complete: () => {
        output.status = status;
        finish();
      },
    };
  };
  return { trim, register };
}

describe('thread topic trim', () => {
  it('trims the whole backlog once a persisted run completes on an idle thread', async () => {
    const { trim, register } = setup(true);
    const run = register('trim-run-1');
    await run.registered;
    const before = Date.now();
    run.complete();
    await waitFor(() => trim.mock.calls.length === 1);
    expect(trim.mock.calls[0]![1].before.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('does not trim a run that did not persist', async () => {
    const { trim, register } = setup(true);
    const run = register('trim-run-failed', 'failed');
    await run.registered;
    run.complete();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(trim).not.toHaveBeenCalled();
  });

  it('does not trim when the agent has no storage', async () => {
    const { trim, register } = setup(false);
    const run = register('trim-run-no-memory');
    await run.registered;
    run.complete();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(trim).not.toHaveBeenCalled();
  });
});
