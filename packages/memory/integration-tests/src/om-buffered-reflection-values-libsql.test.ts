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
  expectedNewerReflectionBufferSurvivesRetiredHook,
  expectedRetiredBeforeIdleActivationReadsWinner,
  expectedRetiredWhileReflectionEndHookHeld,
  runBufferExtendedWithUnreflectedTail,
  runNewerReflectionBufferSurvivesRetiredHook,
  runRetiredBeforeIdleActivationReadsWinner,
  runRetiredWhileReflectionEndHookHeld,
} from '../../src/processors/observational-memory/__tests__/buffered-reflection-fixture';
import type { BufferedReflectionEnv } from '../../src/processors/observational-memory/__tests__/buffered-reflection-fixture';

describe('buffered reflection extracted values (LibSQL file database)', () => {
  let dbDir: string;
  let env: BufferedReflectionEnv;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-buffered-reflection-'));
    env = {
      Memory,
      ObservationalMemory,
      Extractor,
      createStorage: async () => {
        const store = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, `${randomUUID()}.db`)}` });
        await store.init();
        return store;
      },
    };
  });

  afterEach(async () => {
    await rm(dbDir, { recursive: true, force: true });
  });

  // Technical: another process extends the buffer between the activation's head check and its
  // swap; the extension repeats the unreflected tail and moves the cut past it, so the activated
  // text matches the snapshot's buffer. Only the swap can tell which buffer it consumed.
  it('does not publish staged values when the extension repeats the unreflected tail', async () => {
    const outcome = await runBufferExtendedWithUnreflectedTail(env);
    expect(outcome).toEqual(expectedBufferExtendedWithUnreflectedTail(outcome));
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
});
