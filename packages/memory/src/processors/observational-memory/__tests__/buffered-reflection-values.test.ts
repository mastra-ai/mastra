import { InMemoryStore } from '@mastra/core/storage';
import type { MastraCompositeStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../../index';
import { Extractor } from '../extractor';
import { ObservationalMemory } from '../observational-memory';
import {
  createFixtureMemory,
  expectedBufferExtendedWithUnreflectedTail,
  expectedCrossProcessClearAllowsRecreatedGen0Buffering,
  expectedEmptyAfterReflectionRetries,
  expectedLegacyAdapterExtendedBufferFailsClosed,
  expectedLocalClearDuringReflectionStart,
  expectedNewerReflectionBufferSurvivesRetiredHook,
  expectedRetiredBeforeIdleActivationReadsWinner,
  expectedRetiredBeforeRebaseKeepsNewCycleId,
  expectedRetiredWhileReflectionEndHookHeld,
  expectedStaleEmptyActivationPreservesRecreatedBuffer,
  expectedStaleHigherGenBeforeClearPreservesRecreatedGen0,
  expectedStaleTurnPreservesNewerGenerationBuffer,
  expectedSuccessfulActivationPreservesNextGenerationCycle,
  prepare,
  reachActivation as reachFixtureActivation,
  recordingWriter,
  reflection,
  runBufferExtendedWithUnreflectedTail,
  runCrossProcessClearAllowsRecreatedGen0Buffering,
  runEmptyAfterReflectionRetries,
  runLegacyAdapterExtendedBufferFailsClosed,
  runLocalClearDuringReflectionStart,
  runNewerReflectionBufferSurvivesRetiredHook,
  runRetiredBeforeIdleActivationReadsWinner,
  runRetiredBeforeRebaseKeepsNewCycleId,
  runRetiredWhileReflectionEndHookHeld,
  runStaleEmptyActivationPreservesRecreatedBuffer,
  runStaleHigherGenBeforeClearPreservesRecreatedGen0,
  runStaleTurnPreservesNewerGenerationBuffer,
  runSuccessfulActivationPreservesNextGenerationCycle,
  setup as setupFixture,
  values,
  writeDuringSwap,
} from './buffered-reflection-fixture';
import type { BufferedReflectionEnv, SwapAdapter } from './buffered-reflection-fixture';

const env: BufferedReflectionEnv = {
  Memory,
  ObservationalMemory,
  Extractor,
  createStorage: async () => new InMemoryStore(),
};

function createMemory(storage: MastraCompositeStore, reply: () => string | Promise<string>) {
  return createFixtureMemory(env, storage, reply);
}

function setup(reply: () => string | Promise<string>, initialTokens = 800) {
  return setupFixture(env, reply, initialTokens);
}

const reachActivation = reachFixtureActivation;

describe('buffered reflection extracted thread values (#27262)', () => {
  it.each([false, true])('publishes only after successful activation (reload=%s)', async reload => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection).toContain('condensed prepared');
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'original task',
      threadTitle: 'original title',
      extracted: { priority: 'original' },
    });
    if (reload) f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const activeMemory = reload
      ? createMemory(f.storage, () => {
          throw new Error('Must activate persisted buffer without another model call');
        })
      : f.memory;
    const activeOm = await reachActivation(f, activeMemory);
    const head = await activeOm.getRecord(f.threadId, f.resourceId);
    expect(head?.generationCount).toBe(1);
    expect(head?.activeObservations).toContain('condensed prepared');
    expect(head?.activeObservations).toContain('later fact');
    expect(await values(activeMemory, f.threadId)).toMatchObject({
      currentTask: 'prepared task',
      threadTitle: 'prepared title',
      extracted: { priority: 'prepared' },
    });
    expect((await activeMemory.getThreadById({ threadId: f.threadId }))?.metadata?.unrelated).toBe('preserved');
  });

  it('stores a compact reflection fingerprint instead of duplicating the reflection', async () => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const thread = await f.memory.getThreadById({ threadId: f.threadId });
    expect(thread?.metadata?.mastra).toMatchObject({
      omBufferedReflection: { reflectionDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(JSON.stringify(thread?.metadata)).not.toContain('condensed prepared');
    await reachActivation(f);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
  });

  it('publishes a legacy pending entry containing the full reflection after reload', async () => {
    const f = await setup(() => reflection('legacy'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const record = await f.om.getRecord(f.threadId, f.resourceId);
    if (!record) throw new Error('Missing head');
    await f.store.updateThreadMetadata({
      id: f.threadId,
      update: thread => ({
        ...thread.metadata,
        mastra: {
          omBufferedReflection: {
            recordId: record.id,
            reflection: record.bufferedReflection,
            reflectedObservationLineCount: record.reflectedObservationLineCount ?? 0,
            values: { priority: 'legacy' },
          },
        },
      }),
    });
    f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const replacement = createMemory(f.storage, () => {
      throw new Error('Must activate the persisted legacy buffer');
    });
    await reachActivation(f, replacement);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'legacy' } });
  });

  it('completes activation cleanup even when publishing thread metadata fails', async () => {
    const f = await setup(() => reflection('prepared'));
    await prepare(f.memory, f.threadId, f.resourceId);
    // Inject a failed storage write only at publication; preparation and the swap
    // use the real store. The next turn must be able to buffer another reflection.
    const publish = vi.spyOn(f.store, 'updateThreadMetadata').mockRejectedValueOnce(new Error('storage unavailable'));
    try {
      await reachActivation(f);
    } finally {
      publish.mockRestore();
    }
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.generationCount).toBe(1);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    if (!head) throw new Error('Missing head');
    await f.store.updateActiveObservations({
      id: head.id,
      observations: head.activeObservations + '\n* new observations after activation',
      tokenCount: 800,
      lastObservedAt: new Date(),
    });
    await prepare(f.memory, f.threadId, f.resourceId);
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.bufferedReflection).toContain('condensed prepared');
  });

  it('does not publish staged values if the persisted buffer has changed', async () => {
    const f = await setup(() => reflection('stale'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const record = await f.om.getRecord(f.threadId, f.resourceId);
    if (!record) throw new Error('Missing head');
    // Another writer extends the same record's buffer without this extraction result.
    await f.store.updateBufferedReflection({
      id: record.id,
      reflection: '* newer buffered fact',
      tokenCount: 5,
      inputTokenCount: 10,
      reflectedObservationLineCount: record.reflectedObservationLineCount ?? 0,
    });
    await reachActivation(f);
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    expect((await f.om.getRecord(f.threadId, f.resourceId))?.activeObservations).toContain('newer buffered fact');
  });

  it('discards a reflector result when its generation was superseded while the model ran', async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    const f = await setup(async () => {
      entered();
      await gate;
      return reflection('losing');
    });
    const preparing = prepare(f.memory, f.threadId, f.resourceId);
    await started;
    try {
      const old = await f.om.getRecord(f.threadId, f.resourceId);
      if (!old) throw new Error('Missing head');
      await f.store.createReflectionGeneration({
        currentRecord: { ...old },
        reflection: '* winning fact',
        tokenCount: 100,
      });
    } finally {
      release();
      await preparing;
    }
    expect(await values(f.memory, f.threadId)).toMatchObject({
      currentTask: 'original task',
      threadTitle: 'original title',
      extracted: { priority: 'original' },
    });
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    expect(head?.activeObservations).toBe('* winning fact');
    expect(head?.bufferedReflection).toBeUndefined();
  });

  it('never publishes values from a superseded generation, including after reload', async () => {
    const f = await setup(() => reflection('discarded'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const old = await f.om.getRecord(f.threadId, f.resourceId);
    if (!old) throw new Error('Missing head');
    await f.store.createReflectionGeneration({
      currentRecord: { ...old },
      reflection: '* replacement fact',
      tokenCount: 800,
    });
    // A cold process has no coordinator boundary left from the retired generation.
    f.om.buffering.cleanupStaticMaps(f.threadId, f.resourceId);
    const replacement = createMemory(f.storage, () => reflection('replacement'));
    await prepare(replacement, f.threadId, f.resourceId);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    await reachActivation(f, replacement);
    expect(await values(replacement, f.threadId)).toMatchObject({ extracted: { priority: 'replacement' } });
    expect((await (await replacement.omEngine)?.getRecord(f.threadId, f.resourceId))?.activeObservations).not.toContain(
      'discarded',
    );
  });

  // Technical: another process creates a new generation after this activation read the head but
  // before its commit ran, on an adapter that does not report `supersededBy`. The commit must not
  // treat the other process's generation as its own activation. (#27262)
  it('does not show a reflection activation when another process replaced the generation first', async () => {
    const f = await setup(() => reflection('losing'));
    await prepare(f.memory, f.threadId, f.resourceId);
    const read = f.store.getObservationalMemory.bind(f.store);
    let replaced = false;
    const legacyAdapter = vi
      .spyOn(f.store, 'getObservationalMemory')
      .mockImplementation(async (threadId, resourceId) => {
        // Target the activation's snapshot read: the first read made by tryActivateBufferedReflection.
        const fromActivation = new Error().stack?.includes('tryActivateBufferedReflection') ?? false;
        const record = await read(threadId, resourceId);
        if (!record) return record;
        if (!replaced && fromActivation && record.bufferedReflection) {
          replaced = true;
          await f.store.createReflectionGeneration({
            currentRecord: { ...record },
            reflection: '* winning fact',
            tokenCount: 100,
          });
        }
        const legacy = { ...record };
        delete legacy.supersededBy;
        return legacy;
      });
    const { writer, reflectionActivations } = recordingWriter();
    try {
      await reachActivation(f, f.memory, { writer });
    } finally {
      legacyAdapter.mockRestore();
    }
    expect(replaced).toBe(true);
    expect(reflectionActivations()).toEqual([]);
    const head = await f.om.getRecord(f.threadId, f.resourceId);
    expect(head?.activeObservations).toBe('* winning fact');
    expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
  });
  // Another writer (a second process sharing the store) writes between this activation's head
  // check and its swap. Storage builds the new generation from what it stores at swap time, not
  // from the activation's snapshot. (#27262)
  describe('when another writer lands during activation', () => {
    // Technical: the swap trims only the outer ends of the tail it reads, so whitespace around the
    // snapshot tail ends up in the middle of the new active observations after an append.
    it.each([
      ['an empty tail', '', '\n\n* appended\n', '* appended'],
      ['a whitespace-only tail', '\n \t\n', '\n\n* appended\n', '* appended'],
      ['blank lines around the tail', '\n\n  * later\n\n', '\n  * appended\n\n', '* later\n\n\n  * appended'],
      ['a whitespace-only append', '\n  * later \t\n', '\n\t\n', '* later'],
      ['a tail ending in spaces', '\n  * later \t\n', '\n\n\t* appended  \n', '* later \t\n\n\n\t* appended'],
    ])('publishes values when observations are appended, after %s', async (_label, tail, append, expectedTail) => {
      const f = await setup(() => reflection('prepared'), 500);
      await prepare(f.memory, f.threadId, f.resourceId);
      const prepared = await f.om.getRecord(f.threadId, f.resourceId);
      // Copy it now: some stores return live records, which the swap clears.
      const preparedBuffer = prepared?.bufferedReflection;
      expect(prepared?.reflectedObservationLineCount).toBe(1);
      writeDuringSwap(f, snapshot =>
        f.store.updateActiveObservations({
          id: snapshot.id,
          observations: snapshot.activeObservations + append,
          tokenCount: 1150,
          lastObservedAt: new Date(),
        }),
      );
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { tail, writer });
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: `${preparedBuffer}\n\n${expectedTail}`,
      });
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({
        currentTask: 'prepared task',
        threadTitle: 'prepared title',
        extracted: { priority: 'prepared' },
      });
    });

    it('keeps the buffer when observations are rewritten, and activates it on the next turn', async () => {
      const f = await setup(() => reflection('prepared'), 500);
      await prepare(f.memory, f.threadId, f.resourceId);
      writeDuringSwap(f, snapshot =>
        f.store.updateActiveObservations({
          id: snapshot.id,
          observations: '* original fact\n* later\n\n* appended',
          tokenCount: 1150,
          lastObservedAt: new Date(),
        }),
      );
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { tail: '\n  * later \t', writer });
      expect(reflectionActivations()).toEqual([]);
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 0,
        bufferedReflection: expect.stringContaining('condensed prepared'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });

      await prepare(f.memory, f.threadId, f.resourceId, writer);
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });

    // Technical: updateBufferedReflection appends to the stored buffer, so the activated text
    // starts with the snapshot's buffer and can look like the snapshot's buffer plus an append.
    // The swap only activates the buffer the activation read; the extended buffer stays stored
    // and activates on the next turn, without the values staged for the shorter buffer.
    it.each([
      ['an empty tail', '', 0, '* newer buffered fact'],
      ['a whitespace-only tail', '\n \t', 1, '* newer buffered fact'],
      ['a tail the extension also reflected', '\n* later fact', 1, '* later fact condensed by the other writer'],
    ] as const)(
      'does not publish staged values when the buffer is extended, after %s',
      async (_label, tail, extraReflectedLines, extension) => {
        const f = await setup(() => reflection('stale'), 500);
        await prepare(f.memory, f.threadId, f.resourceId);
        const prepared = await f.om.getRecord(f.threadId, f.resourceId);
        // Copy it now: some stores return live records, which the swap clears.
        const preparedBuffer = prepared?.bufferedReflection;
        expect(prepared?.reflectedObservationLineCount).toBe(1);
        writeDuringSwap(f, snapshot =>
          f.store.updateBufferedReflection({
            id: snapshot.id,
            reflection: extension,
            tokenCount: 50,
            inputTokenCount: 100,
            reflectedObservationLineCount: (snapshot.reflectedObservationLineCount ?? 0) + extraReflectedLines,
          }),
        );
        const { writer, reflectionActivations } = recordingWriter();
        await reachActivation(f, f.memory, { tail, writer });
        expect(reflectionActivations()).toEqual([]);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          generationCount: 0,
          bufferedReflection: `${preparedBuffer}\n\n${extension}`,
        });

        await prepare(f.memory, f.threadId, f.resourceId, writer);
        expect(reflectionActivations()).toHaveLength(1);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          generationCount: 1,
          activeObservations: `${preparedBuffer}\n\n${extension}`,
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({
          currentTask: 'original task',
          threadTitle: 'original title',
          extracted: { priority: 'original' },
        });
      },
    );

    // Technical: the extension repeats the unreflected tail and moves the reflected line count
    // past it, so the stored buffer and cut produce the same text as the snapshot's buffer and
    // cut. Only the swap can tell which buffer it consumed. (#27262)
    it('does not publish staged values when the extension repeats the unreflected tail', async () => {
      const outcome = await runBufferExtendedWithUnreflectedTail(env);
      expect(outcome).toEqual(expectedBufferExtendedWithUnreflectedTail(outcome));
    });

    it.each<SwapAdapter>(['current', 'legacy'])(
      'shows no activation and keeps values when the generation is replaced (%s adapter)',
      async adapter => {
        const f = await setup(() => reflection('losing'));
        await prepare(f.memory, f.threadId, f.resourceId);
        writeDuringSwap(
          f,
          snapshot =>
            f.store.createReflectionGeneration({
              currentRecord: snapshot,
              reflection: '* winning fact',
              tokenCount: 100,
            }),
          { adapter },
        );
        const { writer, reflectionActivations } = recordingWriter();
        await reachActivation(f, f.memory, { writer, tail: '' });
        expect(reflectionActivations()).toEqual([]);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          generationCount: 1,
          activeObservations: '* winning fact',
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
      },
    );

    // Technical: the losing activation must drop this process's reflection buffering boundary for
    // the retired generation, or the boundary blocks buffering for the generation that won.
    it.each<SwapAdapter>(['current', 'legacy'])(
      'buffers the next reflection for the generation that won (%s adapter)',
      async adapter => {
        let reply = 'losing';
        const f = await setup(() => reflection(reply));
        await prepare(f.memory, f.threadId, f.resourceId);
        reply = 'next';
        let winnerId: string | undefined;
        writeDuringSwap(
          f,
          async snapshot => {
            winnerId = (
              await f.store.createReflectionGeneration({
                currentRecord: snapshot,
                reflection: '* winning fact',
                tokenCount: 800,
              })
            ).id;
          },
          { adapter },
        );
        const { writer, reflectionActivations } = recordingWriter();
        await reachActivation(f, f.memory, { writer });
        expect(reflectionActivations()).toEqual([]);
        // The winning generation's stored state is left as the other writer made it.
        const winner = await f.om.getRecord(f.threadId, f.resourceId);
        expect(winner).toMatchObject({
          id: winnerId,
          activeObservations: '* winning fact',
          observationTokenCount: 800,
        });
        expect(winner?.bufferedReflection).toBeUndefined();

        await prepare(f.memory, f.threadId, f.resourceId);
        expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
          bufferedReflection: expect.stringContaining('condensed next'),
        });
        expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
      },
    );

    // Technical: the buffered reflection is still running its awaited onReflectionEnd hook when
    // the idle activation sees its generation retired, so the cleanup has to wait for that
    // operation to finish. Otherwise its boundary outlives it and blocks the winner. (#27262)
    it('buffers for the generation that won after a held onReflectionEnd hook resolves', async () => {
      expect(await runRetiredWhileReflectionEndHookHeld(env)).toEqual(expectedRetiredWhileReflectionEndHookHeld);
    });

    it.each([false, true])(
      'buffers for the winner when idle activation reads it first while onReflectionEnd is held (rejectHook=%s)',
      async rejectHook => {
        expect(await runRetiredBeforeIdleActivationReadsWinner(env, { rejectHook })).toEqual(
          expectedRetiredBeforeIdleActivationReadsWinner,
        );
      },
    );

    // Control: cleanup for the retired operation must not touch the buffering state of a newer
    // operation that started (after the memory was cleared) before the retired one finished.
    it("keeps a newer buffered reflection's state when the retired operation finishes", async () => {
      const outcome = await runNewerReflectionBufferSurvivesRetiredHook(env);
      expect(outcome).toEqual(expectedNewerReflectionBufferSurvivesRetiredHook(outcome));
      expect(outcome.newerCycleId).toEqual(expect.any(String));
    });

    it("keeps a newer generation's buffer and cycle when a stale turn resumes with an older snapshot", async () => {
      const outcome = await runStaleTurnPreservesNewerGenerationBuffer(env);
      expect(outcome).toEqual(expectedStaleTurnPreservesNewerGenerationBuffer(outcome));
      expect(outcome.newerCycleId).toEqual(expect.any(String));
    });

    it('buffers for a recreated generation-0 record after another process clears memory', async () => {
      expect(await runCrossProcessClearAllowsRecreatedGen0Buffering(env)).toEqual(
        expectedCrossProcessClearAllowsRecreatedGen0Buffering,
      );
    });

    it('keeps a recreated generation-0 buffer when a pre-clear generation-1 snapshot resumes', async () => {
      const outcome = await runStaleHigherGenBeforeClearPreservesRecreatedGen0(env);
      expect(outcome).toEqual(expectedStaleHigherGenBeforeClearPreservesRecreatedGen0(outcome));
      expect(outcome.newerCycleId).toEqual(expect.any(String));
    });

    it.each([false, true])(
      'keeps the recreated buffer when an unbuffered pre-clear activation read resolves late (holdNewer=%s)',
      async holdNewer => {
        const outcome = await runStaleEmptyActivationPreservesRecreatedBuffer(env, { holdNewer });
        expect(outcome).toEqual(expectedStaleEmptyActivationPreservesRecreatedBuffer(outcome));
        expect(outcome.newerCycleId).toEqual(expect.any(String));
      },
    );

    it('keeps both cycle ids when the next generation buffers before the old activation emits its marker', async () => {
      const outcome = await runSuccessfulActivationPreservesNextGenerationCycle(env);
      expect(outcome).toEqual(expectedSuccessfulActivationPreservesNextGenerationCycle(outcome));
      expect(outcome.firstCycleId).toEqual(expect.any(String));
      expect(outcome.nextCycleId).toEqual(expect.any(String));
    });

    it('keeps the cycle id when an op is retired during onReflectionStart and rebases onto a recreated head', async () => {
      const outcome = await runRetiredBeforeRebaseKeepsNewCycleId(env);
      expect(outcome).toEqual(expectedRetiredBeforeRebaseKeepsNewCycleId(outcome));
      expect(outcome.startCycleId).toEqual(expect.any(String));
    });

    it('publishes values and shows the activation on an adapter without newRecordId support', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      writeDuringSwap(f, async () => {}, { adapter: 'without-new-record-id' });
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { writer });
      expect(reflectionActivations()).toHaveLength(1);
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });

    // Technical: an adapter that predates the buffer check cannot prove which buffer it swapped
    // in, so its activations never publish staged values, even without a race. (#27262)
    it('shows the activation but keeps values on an adapter without the buffer check', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      writeDuringSwap(f, async () => {}, { adapter: 'legacy' });
      const { writer, reflectionActivations } = recordingWriter();
      await reachActivation(f, f.memory, { writer });
      expect(reflectionActivations()).toHaveLength(1);
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: expect.stringContaining('condensed prepared'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'original' } });
    });

    // Technical: on an adapter without the buffer check, another process extends the buffer with
    // the unreflected tail, so the swap activates the extended buffer and reads exactly like the
    // snapshot's. The values staged for the shorter buffer must not be published. (#27262)
    it('does not publish staged values when an adapter without the buffer check swaps in an extended buffer', async () => {
      const outcome = await runLegacyAdapterExtendedBufferFailsClosed(env);
      expect(outcome).toEqual(expectedLegacyAdapterExtendedBufferFailsClosed(outcome));
    });

    // Technical: an adapter that hands out its stored record shows an observation appended to the
    // new generation after the swap. Activation must judge the text the swap produced, not what
    // the record holds once the retired generation has been read. (#27262)
    it('publishes values when an observation is appended to the new generation during activation', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      const store = f.store;
      const swap = store.swapBufferedReflectionToActive;
      const getHistory = store.getObservationalMemoryHistory;
      let swapped = false;
      store.swapBufferedReflectionToActive = async input => {
        store.swapBufferedReflectionToActive = swap;
        const created = await swap.call(store, input);
        swapped = true;
        // InMemoryStore returns its stored head object; wrap it so the returned record keeps the
        // swap's verification flag while every other field reads through to storage.
        const live = await store.getObservationalMemory(created.threadId, created.resourceId);
        if (!live) throw new Error('Missing head');
        return new Proxy(live, {
          get: (target, key, receiver) =>
            key === 'bufferedReflectionVerified'
              ? created.bufferedReflectionVerified
              : Reflect.get(target, key, receiver),
        });
      };
      store.getObservationalMemoryHistory = async (...args) => {
        if (swapped) {
          store.getObservationalMemoryHistory = getHistory;
          const head = await store.getObservationalMemory(f.threadId, f.resourceId);
          if (!head) throw new Error('Missing head');
          await store.updateActiveObservations({
            id: head.id,
            observations: `${head.activeObservations}\n* appended after the swap`,
            tokenCount: (head.observationTokenCount ?? 0) + 10,
            lastObservedAt: new Date(),
          });
        }
        return getHistory.apply(store, args);
      };
      const { writer, reflectionActivations } = recordingWriter();
      try {
        await reachActivation(f, f.memory, { writer });
      } finally {
        store.swapBufferedReflectionToActive = swap;
        store.getObservationalMemoryHistory = getHistory;
      }
      expect(swapped).toBe(true);
      expect(reflectionActivations()).toHaveLength(1);
      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: expect.stringContaining('appended after the swap'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });

    // Technical: `om.clear()` drops this process's reflection owner while the op waits in
    // `onReflectionStart`; the op must not rebase onto the recreated record or save for it.
    it('does not buffer a reflection for recreated memory after a local clear during onReflectionStart', async () => {
      expect(await runLocalClearDuringReflectionStart(env)).toEqual(expectedLocalClearDuringReflectionStart);
    });

    // Technical: an empty buffered reflection must release this op's buffering boundary, or every
    // turn below blockAfter skips buffering and the memory never reflects until blockAfter.
    it('buffers again after afterReflection empties a buffered reflection', async () => {
      expect(await runEmptyAfterReflectionRetries(env)).toEqual(expectedEmptyAfterReflectionRetries);
    });

    it('publishes activated values when a history adapter ignores the fourth options argument', async () => {
      const f = await setup(() => reflection('prepared'));
      await prepare(f.memory, f.threadId, f.resourceId);
      const getHistory = f.store.getObservationalMemoryHistory.bind(f.store);
      f.store.getObservationalMemoryHistory = (threadId, resourceId, limit) => getHistory(threadId, resourceId, limit);

      try {
        await reachActivation(f);
      } finally {
        f.store.getObservationalMemoryHistory = getHistory;
      }

      expect(await f.om.getRecord(f.threadId, f.resourceId)).toMatchObject({
        generationCount: 1,
        activeObservations: expect.stringContaining('condensed prepared'),
      });
      expect(await values(f.memory, f.threadId)).toMatchObject({ extracted: { priority: 'prepared' } });
    });
  });
});
