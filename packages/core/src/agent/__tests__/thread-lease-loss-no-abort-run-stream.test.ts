/**
 * A run registered with an agent that has no `abortRunStream` (a persisted-signal
 * replay's stub agent, or any caller passing a minimal agent) must survive losing
 * its thread lease: the runtime fences the run, and must not throw an unhandled
 * TypeError trying to abort a stream the agent cannot abort. The same holds for an agent whose
 * `abortRunStream` throws.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { verifyRunLease } from '../run-lease-fence';
import { AgentThreadLeaseLostError, AgentThreadStreamRuntime } from '../thread-stream-runtime';

vi.hoisted(() => {
  process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS = '20';
});
afterAll(() => {
  delete process.env.MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS;
});

/** Answers every renewal with "not yours", as a backend that gave the lease away does. */
class LeaseLosingPubSub extends EventEmitterPubSub {
  lost = false;
  override renewLease(key: string, owner: string, ttlMs: number): Promise<boolean> {
    if (this.lost) return Promise.resolve(false);
    return super.renewLease(key, owner, ttlMs);
  }
}

describe('thread lease loss for an agent without abortRunStream', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);

  beforeEach(() => {
    unhandled.length = 0;
    process.on('unhandledRejection', onUnhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
  });

  it('fences the run without an unhandled rejection', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeaseLosingPubSub();
    const agent = { id: 'stub-agent' } as unknown as Agent<any, any, any, any>;
    const runId = 'stub-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    let streamController!: ReadableStreamDefaultController<unknown>;
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream<unknown>({
        start(controller) {
          streamController = controller;
        },
      }),
      _waitUntilFinished: () => finished,
    } as unknown as MastraModelOutput<unknown>;

    await runtime.registerRun(
      agent,
      output,
      { memory: { thread: 'stub-thread', resource: 'stub-user' } } as any,
      pubsub,
    );
    expect(await pubsub.getLeaseOwner(['stub-user', 'stub-thread'].join('\u0000'))).toBe(runId);

    await expect(verifyRunLease(runId)).resolves.toBeUndefined();
    pubsub.lost = true;
    await vi.waitFor(() => expect(verifyRunLease(runId)).rejects.toBeInstanceOf(AgentThreadLeaseLostError), {
      timeout: 2_000,
    });
    // Let the rejection, if any, reach the process before asserting.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(unhandled).toEqual([]);

    streamController.close();
    finish();
    await pubsub.close();
  });

  it('does not let a throwing abortRunStream become an uncaught exception', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new LeaseLosingPubSub();
    const abortRunStream = vi.fn(() => {
      throw new Error('abort failed');
    });
    const agent = { id: 'throwing-agent', abortRunStream } as unknown as Agent<any, any, any, any>;
    const runId = 'throwing-run';
    let finish!: () => void;
    const finished = new Promise<void>(resolve => {
      finish = resolve;
    });
    let streamController!: ReadableStreamDefaultController<unknown>;
    const output = {
      runId,
      status: 'running',
      fullStream: new ReadableStream<unknown>({
        start(controller) {
          streamController = controller;
        },
      }),
      _waitUntilFinished: () => finished,
    } as unknown as MastraModelOutput<unknown>;
    const uncaught: unknown[] = [];
    const onUncaught = (error: unknown) => uncaught.push(error);
    process.on('uncaughtException', onUncaught);

    try {
      await runtime.registerRun(
        agent,
        output,
        { memory: { thread: 'throwing-thread', resource: 'throwing-user' } } as any,
        pubsub,
      );
      pubsub.lost = true;
      // No step is running, so the run is stopped as soon as the lease is lost.
      await vi.waitFor(() => expect(abortRunStream).toHaveBeenCalledWith(runId), { timeout: 2_000 });
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(uncaught).toEqual([]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('uncaughtException', onUncaught);
      streamController.close();
      finish();
      await pubsub.close();
    }
  });
});
