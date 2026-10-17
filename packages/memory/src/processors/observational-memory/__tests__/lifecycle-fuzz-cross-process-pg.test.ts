/**
 * Cross-process lifecycle fuzz against Postgres: two OM module copies (no shared process state),
 * each claiming operations through its own PostgresStore pool on one schema.
 * Needs the stores/pg test database (`docker compose up -d` in stores/pg).
 */
import { randomUUID } from 'node:crypto';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PostgresStore } from '../../../../../../stores/pg/src';
import { runFuzzSeeds } from './lifecycle-fuzz-runner';
import type { FuzzOM } from './lifecycle-fuzz-runner';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const REPORT_ONLY = process.env.OM_FUZZ_REPORT_ONLY === '1';
const config = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};
const schemaName = `om_fuzz_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

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

let stores: PostgresStore[] = [];
let memories: [MemoryStorage, MemoryStorage];

/** A fresh pair of pools per seed: the runner patches the storage it is given. */
async function openPair(seed: number) {
  await Promise.all(stores.map(store => store.close().catch(() => {})));
  stores = [0, 1].map(i => new PostgresStore({ ...config, id: `${schemaName}-${seed}-${i}`, schemaName }));
  for (const store of stores) await store.init();
  const [a, b] = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));
  memories = [a!, b!];
  return memories[0];
}

// OM_FUZZ_AUDIT=1: log every OM row write in commit order (row locks serialize writes to a row).
const AUDIT = process.env.OM_FUZZ_AUDIT === '1';
beforeAll(async () => {
  await openPair(0);
  if (!AUDIT) return;
  const s = `"${schemaName}"`;
  await stores[0]!.pool.query(`
    CREATE TABLE ${s}.om_audit (seq bigserial, op text, thread text, id text, sup text, cursor text, chunks jsonb, active text);
    CREATE FUNCTION ${s}.om_audit_fn() RETURNS trigger AS $$ BEGIN
      INSERT INTO ${s}.om_audit (op, thread, id, sup, cursor, chunks, active)
      VALUES (TG_OP, NEW."threadId", NEW.id, NEW."supersededBy", NEW."lastObservedAt"::text,
        (SELECT jsonb_agg(jsonb_build_object('c', c->>'cycleId', 'm', c->'messageIds'))
           FROM jsonb_array_elements(COALESCE(NEW."bufferedObservationChunks", '[]'::jsonb)) c),
        (SELECT string_agg(x[1], ',') FROM regexp_matches(COALESCE(NEW."activeObservations", ''), '(m[0-9]{4})', 'g') x));
      RETURN NEW; END $$ LANGUAGE plpgsql;
    CREATE TRIGGER om_audit AFTER INSERT OR UPDATE ON ${s}.mastra_observational_memory
      FOR EACH ROW EXECUTE FUNCTION ${s}.om_audit_fn();`);
}, 60_000);



afterAll(async () => {
  if (AUDIT) console.info(`OM_FUZZ_AUDIT schema=${schemaName}`);
  else await stores[0]?.pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await Promise.all(stores.map(store => store.close().catch(() => {})));
});

afterEach(() => vi.restoreAllMocks());

describe('observational memory lifecycle fuzz across processes on Postgres', () => {
  it(
    `holds the lifecycle invariants for ${SEEDS} seeds`,
    async () => {
      const a = await loadReplica();
      const b = await loadReplica();
      const { failing, report } = await runFuzzSeeds(
        {
          ObservationalMemory: a.ObservationalMemory,
          // OM_FUZZ_SINGLE=1: both instances in one process, sharing one store (control).
          ObservationalMemoryB: process.env.OM_FUZZ_SINGLE === '1' ? undefined : b.ObservationalMemory,
          createStorage: openPair,
          // OM_FUZZ_PG_CLAIMS=0: pg data, process-local claims per replica (control).
          createClaimStores: process.env.OM_FUZZ_PG_CLAIMS === '0' ? undefined : async () => memories,
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
    Math.max(300_000, SEEDS * 6_000),
  );
});
