import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { isMastraTimeoutError } from '../../../loop/timeout';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { ensureRemoteAbortListener, publishAbortRequest } from '../abort-transport';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';
import type { RunRegistryEntry } from '../types';

/**
 * A model that opens a stream and then never produces anything, so the only
 * way the run ends is an abort. Without one of these a fast mock finishes
 * before the abort lands and the test passes for the wrong reason.
 */
function createHangingModel() {
  return new MockLanguageModelV2({
    doStream: async ({ abortSignal }: { abortSignal?: AbortSignal }) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 'text-1' });
          abortSignal?.addEventListener(
            'abort',
            () => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              controller.error(error);
            },
            { once: true },
          );
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

describe('DurableAgent cross-process abort', () => {
  it('aborts a run whose executing process never held the caller AbortController', async () => {
    // A worker that rehydrated a run from storage has no controller in its
    // registry entry — that is precisely why a caller's local abort() could
    // never reach it. Model that state directly.
    const runId = 'worker-side-run';
    const pubsub = new EventEmitterPubSub();
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    globalRunRegistry.set(runId, entry);

    try {
      await ensureRemoteAbortListener(pubsub, runId);

      // The listener gives the worker a signal of its own, which is what every
      // downstream model/tool call in the step already reads.
      expect(entry.abortSignal).toBeDefined();
      expect(entry.abortSignal!.aborted).toBe(false);

      const aborted = new Promise<void>(resolve => {
        entry.abortSignal!.addEventListener('abort', () => resolve(), { once: true });
      });

      await publishAbortRequest(pubsub, runId);
      await aborted;

      expect(entry.abortSignal!.aborted).toBe(true);
    } finally {
      globalRunRegistry.delete(runId);
      await pubsub.close();
    }
  });

  it('stays abortable when the step starts before anything registered the run', async () => {
    // A worker's first step can run before `resolveRuntimeDependencies` has
    // seeded the registry. Skipping the listener there would leave the run
    // permanently deaf to remote aborts.
    const runId = 'unregistered-run';
    const pubsub = new EventEmitterPubSub();

    try {
      await ensureRemoteAbortListener(pubsub, runId);

      const entry = globalRunRegistry.get(runId);
      expect(entry).toBeDefined();
      // Still a placeholder, so the real runtime rebuild is not skipped.
      expect(entry!.isPlaceholder).toBe(true);
      expect(entry!.abortSignal!.aborted).toBe(false);

      const aborted = new Promise<void>(resolve => {
        entry!.abortSignal!.addEventListener('abort', () => resolve(), { once: true });
      });

      await publishAbortRequest(pubsub, runId);
      await aborted;

      expect(entry!.abortSignal!.aborted).toBe(true);
    } finally {
      globalRunRegistry.delete(runId);
      await pubsub.close();
    }
  });

  it('only installs one listener per run no matter how many steps start', async () => {
    const runId = 'idempotent-listener-run';
    const pubsub = new EventEmitterPubSub();
    globalRunRegistry.set(runId, { isPlaceholder: true } as RunRegistryEntry);

    try {
      await ensureRemoteAbortListener(pubsub, runId);
      const firstSignal = globalRunRegistry.get(runId)!.abortSignal;

      // A run runs many steps in the same process; each one calls this.
      await ensureRemoteAbortListener(pubsub, runId);
      await ensureRemoteAbortListener(pubsub, runId);

      // Same controller reused — a replacement would strand the signal already
      // handed to an in-flight model call.
      expect(globalRunRegistry.get(runId)!.abortSignal).toBe(firstSignal);
    } finally {
      globalRunRegistry.delete(runId);
      await pubsub.close();
    }
  });

  it('stays retryable when the subscription fails', async () => {
    const runId = 'failed-subscribe-run';
    const pubsub = new EventEmitterPubSub();
    let failNext = true;
    const originalSubscribe = pubsub.subscribe.bind(pubsub);
    pubsub.subscribe = (async (...args: Parameters<typeof originalSubscribe>) => {
      if (failNext) {
        failNext = false;
        throw new Error('pubsub down');
      }
      return originalSubscribe(...args);
    }) as typeof pubsub.subscribe;
    globalRunRegistry.set(runId, { isPlaceholder: true } as RunRegistryEntry);

    try {
      // A transient transport failure must not leave the run permanently deaf:
      // the next step gets to try again.
      await expect(ensureRemoteAbortListener(pubsub, runId)).rejects.toThrow('pubsub down');
      expect(globalRunRegistry.get(runId)!.remoteAbortListenerInstalled).toBe(false);

      await ensureRemoteAbortListener(pubsub, runId);
      const entry = globalRunRegistry.get(runId)!;
      const aborted = new Promise<void>(resolve => {
        entry.abortSignal!.addEventListener('abort', () => resolve(), { once: true });
      });
      await publishAbortRequest(pubsub, runId);
      await aborted;
      expect(entry.abortSignal!.aborted).toBe(true);
    } finally {
      globalRunRegistry.delete(runId);
      await pubsub.close();
    }
  });

  it('arms the carried deadline even when the subscription fails', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const runId = 'deadline-failed-subscribe-run';
    const pubsub = new EventEmitterPubSub();
    pubsub.subscribe = (async () => {
      throw new Error('pubsub down');
    }) as typeof pubsub.subscribe;
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    globalRunRegistry.set(runId, entry);

    try {
      await expect(
        ensureRemoteAbortListener(pubsub, runId, undefined, { at: Date.now() + 1000, timeoutMs: 1000 }),
      ).rejects.toThrow('pubsub down');
      expect(entry.abortSignal!.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      expect(entry.abortSignal!.aborted).toBe(true);
      expect(isMastraTimeoutError(entry.abortSignal!.reason)).toBe(true);
    } finally {
      entry.cleanup?.();
      globalRunRegistry.delete(runId);
      vi.useRealTimers();
      await pubsub.close();
    }
  });

  it("re-arms a warm worker's deadline when a resumed segment carries a new one", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const runId = 'deadline-resumed-segment-run';
    const pubsub = new EventEmitterPubSub();
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    globalRunRegistry.set(runId, entry);

    try {
      // First segment: 1s deadline. The run suspends before it, leaving the entry warm.
      await ensureRemoteAbortListener(pubsub, runId, undefined, { at: Date.now() + 1000, timeoutMs: 1000 });
      // The resumed segment starts later with its own, later deadline.
      await vi.advanceTimersByTimeAsync(500);
      await ensureRemoteAbortListener(pubsub, runId, undefined, { at: Date.now() + 5000, timeoutMs: 5000 });

      // The first segment's deadline must not stop the resumed one.
      await vi.advanceTimersByTimeAsync(1000);
      expect(entry.abortSignal!.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(4000);
      expect(entry.abortSignal!.aborted).toBe(true);
      expect(isMastraTimeoutError(entry.abortSignal!.reason)).toBe(true);
    } finally {
      entry.cleanup?.();
      globalRunRegistry.delete(runId);
      vi.useRealTimers();
      await pubsub.close();
    }
  });

  it("does not stop a warm resume that carries no deadline at the previous segment's deadline", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const runId = 'deadline-resumed-without-deadline-run';
    const pubsub = new EventEmitterPubSub();
    const entry = { isPlaceholder: true } as RunRegistryEntry;
    globalRunRegistry.set(runId, entry);

    try {
      await ensureRemoteAbortListener(pubsub, runId, undefined, { at: Date.now() + 200, timeoutMs: 200 });
      // The resume swaps in a fresh controller on the same entry, as create-inngest-agent does.
      await vi.advanceTimersByTimeAsync(100);
      const resumed = new AbortController();
      entry.abortController = resumed;
      entry.abortSignal = resumed.signal;
      await ensureRemoteAbortListener(pubsub, runId, undefined, undefined);

      await vi.advanceTimersByTimeAsync(1000);
      expect(resumed.signal.aborted).toBe(false);
    } finally {
      entry.cleanup?.();
      globalRunRegistry.delete(runId);
      vi.useRealTimers();
      await pubsub.close();
    }
  });

  it('stops an in-flight run from an abort request it did not raise locally, and still terminates the stream', async () => {
    const pubsub = new EventEmitterPubSub();
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'cross-process-abort-agent',
      name: 'cross-process-abort-agent',
      instructions: 'test',
      model: createHangingModel() as unknown as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    new Mastra({ agents: { 'cross-process-abort-agent': durableAgent as any }, storage, logger: false });

    const { output, runId, cleanup } = await durableAgent.stream('Go');

    const terminalEvents: string[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), (event: any) => {
      if (event?.type === 'finish' || event?.type === 'abort' || event?.type === 'error') {
        terminalEvents.push(event.type);
      }
    });

    // Let the run get as far as an in-flight model call.
    await new Promise(resolve => setTimeout(resolve, 50));

    // Deliberately NOT result.abort(): that flips a controller in this process
    // and proves nothing about a caller living somewhere else. Publishing the
    // request straight to pubsub is what a different pod's abort() looks like
    // from here — the executing process must pick it up on its own.
    await publishAbortRequest(pubsub, runId);

    // The run must actually end, and it must end with a terminal event. A hard
    // workflow cancel would stop the work but skip the event, leaving every
    // stream consumer waiting forever.
    await output.consumeStream();

    expect(terminalEvents).toContain('finish');

    cleanup();
    await pubsub.close();
  }, 20000);
});
