/**
 * Lifecycle fuzz with each ObservationalMemory instance loaded from its own module copy, so the
 * two instances share storage but no process-local state (operation registry, commit queue,
 * BufferingCoordinator maps, in-memory locks). This models two replicas serving one thread.
 */
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runFuzzSeeds } from './lifecycle-fuzz-runner';
import type { FuzzOM } from './lifecycle-fuzz-runner';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const REPORT_ONLY = process.env.OM_FUZZ_REPORT_ONLY === '1';

async function loadReplica() {
  vi.resetModules();
  const om = await import('../observational-memory');
  const coordinator = await import('../buffering-coordinator');
  return {
    ObservationalMemory: om.ObservationalMemory as unknown as new (config: any) => FuzzOM,
    clear: () => {
      const c = coordinator.BufferingCoordinator;
      c.asyncBufferingOps.clear();
      c.lastBufferedBoundary.clear();
      c.observationBoundaryOwners.clear();
      c.lastBufferedAtTime.clear();
      c.reflectionBufferCycleIds.clear();
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe('observational memory lifecycle fuzz across processes', () => {
  it(
    `holds the lifecycle invariants for ${SEEDS} seeds with no shared process state`,
    async () => {
      const a = await loadReplica();
      const b = await loadReplica();
      expect(a.ObservationalMemory).not.toBe(b.ObservationalMemory);
      const { failing, report } = await runFuzzSeeds(
        {
          ObservationalMemory: a.ObservationalMemory,
          ObservationalMemoryB: b.ObservationalMemory,
          createStorage: async () => new InMemoryMemory({ db: new InMemoryDB() }),
          spyOn: (object, method) => vi.spyOn(object, method),
        },
        {
          first: FIRST_SEED,
          count: SEEDS,
          beforeSeed: () => {
            a.clear();
            b.clear();
          },
        },
      );
      console.info(report);
      if (!REPORT_ONLY) expect(failing.map(r => ({ seed: r.seed, violations: r.violations.slice(0, 5) }))).toEqual([]);
    },
    Math.max(120_000, SEEDS * 3_000),
  );
});
