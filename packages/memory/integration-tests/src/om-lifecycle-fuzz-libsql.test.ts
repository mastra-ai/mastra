/**
 * Seeded interleaving fuzz for the observational memory lifecycle on LibSQL: two
 * ObservationalMemory instances share one LibSQL file database. Runner and invariants live with the
 * InMemory unit fuzz in `src/processors/observational-memory/__tests__/`.
 *
 * `OM_FUZZ_SEEDS=<n>` runs more seeds; `OM_FUZZ_FIRST_SEED=<n>` picks the first seed.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { MemoryStorage } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { ObservationalMemory } from '@mastra/memory/processors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runFuzzSeeds } from '../../src/processors/observational-memory/__tests__/lifecycle-fuzz-runner';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 10);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);

describe('observational memory lifecycle fuzz (LibSQL file database)', () => {
  let dbDir: string;

  beforeEach(async () => {
    dbDir = await mkdtemp(join(tmpdir(), 'om-lifecycle-fuzz-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dbDir, { recursive: true, force: true });
  });

  it(
    `holds the lifecycle invariants for ${SEEDS} seeds`,
    async () => {
      const { failing, report } = await runFuzzSeeds(
        {
          ObservationalMemory,
          createStorage: async seed => {
            const store = new LibSQLStore({ id: randomUUID(), url: `file:${join(dbDir, `seed-${seed}.db`)}` });
            await store.init();
            return (await store.getStore('memory')) as MemoryStorage;
          },
          spyOn: (object, method) => vi.spyOn(object, method),
        },
        { first: FIRST_SEED, count: SEEDS },
      );
      console.info(report);
      expect(failing.map(r => ({ seed: r.seed, violations: r.violations.slice(0, 5) }))).toEqual([]);
    },
    Math.max(120_000, SEEDS * 15_000),
  );
});
