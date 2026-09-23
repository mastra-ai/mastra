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

  const register = (runId: string, status: 'success' | 'failed' | 'suspended' = 'success') => {
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
    run.complete();
    await waitFor(() => trim.mock.calls.length === 1);
    // No cutoff: drop everything retained, without comparing clocks against the backend.
    expect(trim.mock.calls[0]![1]).toBeUndefined();
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

  it('keeps a run still in progress when a concurrent run completes', async () => {
    const { trim, register } = setup(true);
    const active = register('trim-run-active');
    await active.registered;
    const activeRegisteredBy = Date.now();
    const done = register('trim-run-done');
    await done.registered;
    done.complete();
    await waitFor(() => trim.mock.calls.length === 1);
    // Cut off before the active run started, backed off for clock skew.
    expect(trim.mock.calls[0]![1]!.before!.getTime()).toBeLessThanOrEqual(activeRegisteredBy - 5_000);
    active.complete();
    await waitFor(() => trim.mock.calls.length === 2);
    expect(trim.mock.calls[1]![1]).toBeUndefined();
  });

  it('keeps a suspended run until it is answered', async () => {
    const { trim, register } = setup(true);
    const suspended = register('trim-run-suspended', 'suspended');
    await suspended.registered;
    const registeredBy = Date.now();
    suspended.complete();
    await new Promise(resolve => setTimeout(resolve, 50));
    for (const [, options] of trim.mock.calls) expect(options?.before?.getTime()).toBeLessThanOrEqual(registeredBy);
  });
});
