import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

function createInMemoryStorage(): InMemoryMemory {
  const db = new InMemoryDB();
  return new InMemoryMemory({ db });
}

function createNoopModel(modelId: string) {
  return new MockLanguageModelV2({
    modelId,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      text: '<observations>* noop</observations>',
      content: [{ type: 'text' as const, text: '<observations>* noop</observations>' }],
      warnings: [],
    }),
  });
}

function createOm() {
  return new ObservationalMemory({
    storage: createInMemoryStorage(),
    scope: 'thread',
    observation: {
      model: createNoopModel('mock-observer'),
      messageTokens: 1000,
    },
    reflection: {
      model: createNoopModel('mock-reflector'),
      observationTokens: 40000,
    },
  });
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Resolves to true if the promise has not settled after the microtask/timer queue drains. */
async function isPending(promise: Promise<unknown>): Promise<boolean> {
  const marker = Symbol('pending');
  const result = await Promise.race([promise.then(() => 'settled'), new Promise(res => setTimeout(res, 10, marker))]);
  return result === marker;
}

describe('ObservationalMemory.settled', () => {
  it('resolves immediately when no background work is in flight', async () => {
    const om = createOm();

    await expect(om.settled()).resolves.toBeUndefined();
  });

  it('waits for in-flight background work and releases once it finishes', async () => {
    const om = createOm();
    const gate = deferred();

    void om.trackBackgroundWork(gate.promise);

    const settled = om.settled();
    expect(await isPending(settled)).toBe(true);

    gate.resolve();
    await settled;
    expect((om as any).pendingBackgroundWork.size).toBe(0);
  });

  it('joins background work that enqueues further background work', async () => {
    const om = createOm();
    const first = deferred();
    const second = deferred();
    let secondStarted = false;

    void om.trackBackgroundWork(
      first.promise.then(() => {
        // A buffered observation can trigger a reflection, which spawns nested agent
        // runs — settled() must drain those too, not just the first snapshot.
        secondStarted = true;
        void om.trackBackgroundWork(second.promise);
      }),
    );

    const settled = om.settled();

    first.resolve();
    expect(await isPending(settled)).toBe(true);
    expect(secondStarted).toBe(true);

    second.resolve();
    await settled;
    expect((om as any).pendingBackgroundWork.size).toBe(0);
  });

  it('resolves when background work rejects, without an unhandled rejection', async () => {
    const om = createOm();
    const gate = deferred();

    // Callers keep their own rejection handling; the tracker must not swallow or
    // re-surface it, and settled() must not hang on a failed cycle.
    void om.trackBackgroundWork(gate.promise).catch(() => {});

    const settled = om.settled();
    gate.reject(new Error('background cycle failed'));

    await expect(settled).resolves.toBeUndefined();
    expect((om as any).pendingBackgroundWork.size).toBe(0);
  });
});
