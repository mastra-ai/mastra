/**
 * Buffered reflection extracted values (#27262) on a file-backed LibSQL database. Scenarios and
 * expected outcomes are shared with the InMemory unit tests in
 * `src/processors/observational-memory/__tests__/buffered-reflection-values.test.ts`.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLStore } from '@mastra/libsql';
import { Extractor, Memory } from '@mastra/memory';
import { ObservationalMemory } from '@mastra/memory/processors';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
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
} from '../../src/processors/observational-memory/__tests__/buffered-reflection-fixture';
import type { BufferedReflectionEnv } from '../../src/processors/observational-memory/__tests__/buffered-reflection-fixture';

describe('buffered reflection extracted values (LibSQL file database)', () => {
  let dbDir: string;
  let env: BufferedReflectionEnv;
  let stores: LibSQLStore[];

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-buffered-reflection-'));
    stores = [];
    env = {
      Memory,
      ObservationalMemory,
      Extractor,
      createStorage: async () => {
        const store = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, `${randomUUID()}.db`)}` });
        // Tracked before init so a store whose init fails is still closed.
        stores.push(store);
        await store.init();
        return store;
      },
    };
  });

  afterEach(async () => {
    // Close every database before deleting its directory; one failed close must not leave the rest open.
    const closed = await Promise.allSettled(stores.map(store => store.close()));
    await rm(dbDir, { recursive: true, force: true });
    const failure = closed.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failure) throw failure.reason;
  });

  // Technical: another process extends the buffer between the activation's head check and its
  // swap; the extension repeats the unreflected tail and moves the cut past it, so the activated
  // text matches the snapshot's buffer. Only the swap can tell which buffer it consumed.
  it('does not publish staged values when the extension repeats the unreflected tail', async () => {
    const outcome = await runBufferExtendedWithUnreflectedTail(env);
    expect(outcome).toEqual(expectedBufferExtendedWithUnreflectedTail(outcome));
  });

  // Technical: the same race on an adapter that predates the buffer check. The swap activates the
  // extended buffer, but the values staged for the shorter buffer are never published.
  it('does not publish staged values when an adapter without the buffer check swaps in an extended buffer', async () => {
    const outcome = await runLegacyAdapterExtendedBufferFailsClosed(env);
    expect(outcome).toEqual(expectedLegacyAdapterExtendedBufferFailsClosed(outcome));
  });

  it('does not buffer a reflection for recreated memory after a local clear during onReflectionStart', async () => {
    expect(await runLocalClearDuringReflectionStart(env)).toEqual(expectedLocalClearDuringReflectionStart);
  });

  it('buffers again after afterReflection empties a buffered reflection', async () => {
    expect(await runEmptyAfterReflectionRetries(env)).toEqual(expectedEmptyAfterReflectionRetries);
  });

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
});
