/**
 * Seeded interleaving fuzz for the observational memory lifecycle on InMemory storage (runner and
 * invariants: `lifecycle-fuzz-runner.ts`, `lifecycle-invariants.ts`).
 *
 * `OM_FUZZ_SEEDS=<n>` runs more seeds; `OM_FUZZ_FIRST_SEED=<n>` picks the first seed;
 * `OM_FUZZ_REPORT_ONLY=1` reports violations without failing (used to measure an older revision).
 * The tied-timestamp run covers save and synchronous observe only: a reflection generation starts
 * without observed ids and buffered activation does not record them, so a tie at those cursors is
 * still dropped (#27261). `OM_FUZZ_TIE_OPS=all` runs it with every operation to measure that.
 * A failing seed prints its seed and operation trace.
 */
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';
import { runFuzzSeeds } from './lifecycle-fuzz-runner';
import type { Op } from './lifecycle-fuzz-runner';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const REPORT_ONLY = process.env.OM_FUZZ_REPORT_ONLY === '1';
const TIE_OPS: Op[] | undefined = process.env.OM_FUZZ_TIE_OPS === 'all' ? undefined : ['save', 'observe'];

function clearCoordinator() {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.observationBoundaryOwners.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
}

afterEach(() => {
  clearCoordinator();
  vi.restoreAllMocks();
});

describe('observational memory lifecycle fuzz', () => {
  it(
    `holds the lifecycle invariants for ${SEEDS} seeds`,
    async () => {
      const { failing, report } = await runFuzzSeeds(
        {
          ObservationalMemory,
          createStorage: async () => new InMemoryMemory({ db: new InMemoryDB() }),
          spyOn: (object, method) => vi.spyOn(object, method),
        },
        { first: FIRST_SEED, count: SEEDS, beforeSeed: clearCoordinator },
      );
      console.info(report);
      if (!REPORT_ONLY) expect(failing.map(r => ({ seed: r.seed, violations: r.violations.slice(0, 5) }))).toEqual([]);
    },
    Math.max(120_000, SEEDS * 3_000),
  );

  it(
    `never drops a message that shares the cursor millisecond across ${SEEDS} seeds of save and observe`,
    async () => {
      const { failing, report } = await runFuzzSeeds(
        {
          ObservationalMemory,
          createStorage: async () => new InMemoryMemory({ db: new InMemoryDB() }),
          spyOn: (object, method) => vi.spyOn(object, method),
        },
        { first: FIRST_SEED, count: SEEDS, beforeSeed: clearCoordinator, ties: true, ops: TIE_OPS },
      );
      console.info(report);
      if (!REPORT_ONLY) expect(failing.map(r => ({ seed: r.seed, violations: r.violations.slice(0, 5) }))).toEqual([]);
    },
    Math.max(120_000, SEEDS * 3_000),
  );
});
