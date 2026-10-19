import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
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
  it('scoped to a thread, waits for that thread only and not for other threads on the same engine', async () => {
    const om = createOm();
    const mine = deferred();
    const other = deferred();
    void om.trackBackgroundWork(mine.promise, om.buffering.getLockKey('t-mine', 'r'));
    void om.trackBackgroundWork(other.promise, om.buffering.getLockKey('t-other', 'r'));

    const scoped = om.settled({ threadId: 't-mine', resourceId: 'r' });
    const all = om.settled();
    expect(await isPending(scoped)).toBe(true);

    mine.resolve();
    await scoped; // resolves although t-other is still busy
    expect(await isPending(all)).toBe(true);

    other.resolve();
    await all;
  });

  it('resolves immediately when no background work is in flight', async () => {
    const om = createOm();

    await expect(om.settled()).resolves.toBeUndefined();
  });

  it('waits for in-flight background work and releases once it finishes', async () => {
    const om = createOm();
    const gate = deferred();

    void om.trackBackgroundWork(gate.promise, 'thread:t');

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
        void om.trackBackgroundWork(second.promise, 'thread:t');
      }),
      'thread:t',
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
    void om.trackBackgroundWork(gate.promise, 'thread:t').catch(() => {});

    const settled = om.settled();
    gate.reject(new Error('background cycle failed'));

    await expect(settled).resolves.toBeUndefined();
    expect((om as any).pendingBackgroundWork.size).toBe(0);
  });

  async function startBufferedReflection({
    threadId,
    reflectorGate,
    flagGate,
  }: {
    threadId: string;
    reflectorGate?: Promise<void>;
    flagGate?: { value: boolean; gate: Promise<void> };
  }) {
    const storage = createInMemoryStorage();
    if (flagGate) {
      const setFlag = storage.setBufferingReflectionFlag.bind(storage);
      storage.setBufferingReflectionFlag = async (id, value, ...rest) => {
        if (value === flagGate.value) await flagGate.gate;
        return setFlag(id, value, ...rest);
      };
    }
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createNoopModel('mock-observer'), messageTokens: 1000 },
      reflection: {
        model: new MockLanguageModelV2({
          modelId: 'gated-reflector',
          doStream: async () => {
            await reflectorGate;
            return {
              rawCall: { rawPrompt: null, rawSettings: {} },
              stream: new ReadableStream({
                start(controller) {
                  controller.enqueue({ type: 'text-start', id: '1' });
                  controller.enqueue({ type: 'text-delta', id: '1', delta: '<observations>* r</observations>' });
                  controller.enqueue({ type: 'text-end', id: '1' });
                  controller.enqueue({
                    type: 'finish',
                    finishReason: 'stop',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  });
                  controller.close();
                },
              }),
            };
          },
        }),
        observationTokens: 1000,
        bufferActivation: 0.5,
      },
    });
    const created = await om.getOrCreateRecord(threadId, 'r1');
    await storage.updateActiveObservations({
      id: created.id,
      observations: '* a fact',
      tokenCount: 800,
      lastObservedAt: new Date(),
    });
    const record = (await om.getRecord(threadId, 'r1'))!;
    // Above the activation point, below the threshold: the step path starts a background reflection.
    await om.reflector.maybeReflect({ record, observationTokens: 800 });
    expect(BufferingCoordinator.asyncBufferingOps.size).toBe(1);
    return om;
  }

  it('joins a buffered reflection', async () => {
    const gate = deferred();
    const om = await startBufferedReflection({ threadId: 'reflect', reflectorGate: gate.promise });

    const settled = om.settled();
    expect(await isPending(settled)).toBe(true);
    gate.resolve();
    await settled;
    expect((await om.getRecord('reflect', 'r1'))?.bufferedReflection).toContain('* r');
    expect((await om.getRecord('reflect', 'r1'))?.isBufferingReflection).toBe(false);
  });

  it.each([
    ['start', true],
    ['clear', false],
  ])('waits for the buffering-reflection %s flag write', async (_label, value) => {
    const gate = deferred();
    const om = await startBufferedReflection({ threadId: `flag-${value}`, flagGate: { value, gate: gate.promise } });

    const settled = om.settled();
    expect(await isPending(settled)).toBe(true);
    gate.resolve();
    await settled;
    expect((await om.getRecord(`flag-${value}`, 'r1'))?.isBufferingReflection).toBe(false);
  });

  it('scoped to a thread, waits for a buffered observation through its flag-clear write', async () => {
    const storage = createInMemoryStorage();
    const clearGate = deferred();
    const setFlag = storage.setBufferingObservationFlag.bind(storage);
    storage.setBufferingObservationFlag = async (id, value, ...rest) => {
      if (value === false) await clearGate.promise;
      return setFlag(id, value, ...rest);
    };
    const om = new ObservationalMemory({
      storage,
      scope: 'thread',
      observation: { model: createNoopModel('mock-observer'), messageTokens: 1000, bufferTokens: 100 },
      reflection: { model: createNoopModel('mock-reflector'), observationTokens: 40000 },
    });
    const record = await om.getOrCreateRecord('obs', 'r1');
    const message = {
      id: 'm1',
      role: 'user' as const,
      threadId: 'obs',
      resourceId: 'r1',
      createdAt: new Date(),
      content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'hello '.repeat(200) }] },
    };
    const triggered = await om.triggerAsyncBuffering({
      threadId: 'obs',
      resourceId: 'r1',
      record,
      pendingTokens: 500,
      unbufferedPendingTokens: 500,
      unobservedMessages: [message],
      threshold: 1000,
    });
    expect(triggered).toBe(true);

    const settled = om.settled({ threadId: 'obs', resourceId: 'r1' });
    expect(await isPending(settled)).toBe(true);
    clearGate.resolve();
    await settled;
    expect((await om.getRecord('obs', 'r1'))?.isBufferingObservation).toBe(false);
  });

  it.each([
    ['no ids', 'thread', {}],
    ['only resourceId on a thread-scoped engine', 'thread', { resourceId: 'r' }],
    ['only threadId on a resource-scoped engine', 'resource', { threadId: 't' }],
  ] as const)('waits for all work when the scope has %s', async (_label, engineScope, scope) => {
    const om = new ObservationalMemory({
      storage: createInMemoryStorage(),
      scope: engineScope,
      observation: { model: createNoopModel('mock-observer'), messageTokens: 1000, bufferTokens: false },
      reflection: { model: createNoopModel('mock-reflector'), observationTokens: 40000 },
    });
    const gate = deferred();
    void om.trackBackgroundWork(gate.promise, { threadId: 't', resourceId: 'r' });

    const settled = om.settled(scope);
    expect(await isPending(settled)).toBe(true);
    gate.resolve();
    await settled;
  });
});
