/**
 * Seeded interleaving fuzz for the observational memory lifecycle on InMemory storage (runner and
 * invariants: `lifecycle-fuzz-runner.ts`, `lifecycle-invariants.ts`).
 *
 * `OM_FUZZ_SEEDS=<n>` runs more seeds; `OM_FUZZ_FIRST_SEED=<n>` picks the first seed;
 * `OM_FUZZ_REPORT_ONLY=1` reports violations without failing (used to measure an older revision).
 * A failing seed prints its seed and operation trace.
 */
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';
import { runFuzzSeeds } from './lifecycle-fuzz-runner';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const REPORT_ONLY = process.env.OM_FUZZ_REPORT_ONLY === '1';

function clearCoordinator() {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
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
});
