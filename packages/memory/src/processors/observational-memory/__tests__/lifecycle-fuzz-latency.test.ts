/**
 * Single-process lifecycle fuzz on InMemoryMemory with random per-call latency, to tell OM
 * interleaving bugs apart from adapter bugs. Claim methods are not delayed: they must register
 * synchronously.
 */
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterEach, describe, it, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';
import { runFuzzSeeds } from './lifecycle-fuzz-runner';
import type { FuzzOM } from './lifecycle-fuzz-runner';
import { BufferingCoordinator } from '../buffering-coordinator';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const MAX_MS = Number(process.env.OM_FUZZ_LATENCY_MS ?? 2);
const ONLY = process.env.OM_FUZZ_LATENCY_ONLY?.split(',');

function withLatency(storage: MemoryStorage, seed: number): MemoryStorage {
  let a = seed >>> 0;
  const rng = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4_294_967_296;
  };
  return new Proxy(storage, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || typeof prop !== 'string' || prop.includes('ObservationalMemoryOperation'))
        return value;
      if (ONLY && !ONLY.includes(prop)) return value;
      return async (...args: unknown[]) => {
        await new Promise(resolve => setTimeout(resolve, Math.floor(rng() * (MAX_MS + 1))));
        const result = await value.apply(target, args);
        if (process.env.OM_FUZZ_LOG && (prop === 'saveMessages' || prop === 'listMessages')) {
          const a = args[0] as any;
          const ids =
            prop === 'saveMessages'
              ? a.messages.map((m: any) => m.id + '@' + new Date(m.createdAt).toISOString().slice(17, 23))
              : (result as any).messages.map((m: any) => m.id);
          process.stderr.write(`MSG ${prop} ${ids}\n`);
        }
        if (process.env.OM_FUZZ_LOG && /^(appendBuffered|swapBufferedToActive|commitActive)/.test(prop)) {
          const a = args[0] as any;
          const iso = (d: any) => (d ? new Date(d).toISOString().slice(14, 23) : '-');
          process.stderr.write(
            `DETAIL ${prop} id=${a.id} ${a.chunk ? `cycle=${a.chunk.cycleId.slice(-5)} msgs=${a.chunk.messageIds} lastObs=${iso(a.chunk.lastObservedAt)}` : ''}${a.observedMessageIds ? ` observedIds=${a.observedMessageIds} lastObs=${iso(a.lastObservedAt)}` : ''} ${prop.startsWith('swap') ? `in=${JSON.stringify({ ...a, currentRecord: undefined }).slice(0, 300)}` : ''} -> ${JSON.stringify(result, (k, v) => (k === 'observations' || k === 'activatedObservations' ? undefined : v)).slice(0, 500)}\n`,
          );
        }
        if (process.env.OM_FUZZ_LOG && /Observ|Reflect|Buffer/.test(prop)) {
          const a = args[0] as any;
          const r = result as any;
          process.stderr.write(
            `CALL ${prop} in=${a?.id ?? a?.currentRecord?.id ?? (typeof a === 'string' ? a : '')}${a?.chunk ? ` cycle=${a.chunk.cycleId}` : ''} out=${r?.id ?? r?.recordId ?? ''} chunks=${(r?.bufferedObservationChunks ?? []).map((c: any) => c.cycleId).join(',')} sup=${r?.supersededBy ?? ''}\n`,
          );
        }
        return result;
      };
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  });
}

afterEach(() => vi.restoreAllMocks());

if (process.env.OM_FUZZ_LOG) {
  const proto = InMemoryMemory.prototype as any;
  const orig = proto.rollOverObservationalMemory;
  proto.rollOverObservationalMemory = function (stored: any, ...rest: unknown[]) {
    const out = orig.call(this, stored, ...rest);
    process.stderr.write(
      `ROLL ${stored.id} -> ${out.id} chunks=${(out.bufferedObservationChunks ?? []).map((c: any) => c.cycleId).join(',')}\n${new Error().stack?.split('\n').slice(2, 9).join('\n')}\n`,
    );
    return out;
  };
}

describe('observational memory lifecycle fuzz with storage latency', () => {
  it(`reports invariants for ${SEEDS} seeds at up to ${MAX_MS}ms per call`, async () => {
    const { report } = await runFuzzSeeds(
      {
        ObservationalMemory: ObservationalMemory as unknown as new (config: any) => FuzzOM,
        createStorage: async seed => withLatency(new InMemoryMemory({ db: new InMemoryDB() }), seed),
        spyOn: (object, method) => vi.spyOn(object, method),
      },
      {
        first: FIRST_SEED,
        count: SEEDS,
        beforeSeed: () => {
          BufferingCoordinator.asyncBufferingOps.clear();
          BufferingCoordinator.lastBufferedBoundary.clear();
          BufferingCoordinator.observationBoundaryOwners.clear();
          BufferingCoordinator.lastBufferedAtTime.clear();
          BufferingCoordinator.reflectionBufferCycleIds.clear();
        },
      },
    );
    console.info(report);
  }, 600_000);
});
