import { describe, expect, it } from 'vitest';

import type { QueryOutcome } from './client';
import { categorize, isLimitCategory, isOverload } from './client';
import { MAX_CONCURRENCY, Pool, PoolAborted } from './pool';
import type { PoolUnit } from './pool';

const ok = (): QueryOutcome => ({ queryId: 'q', wallMs: 1, ok: true, streamedRows: 0, streamedBytes: 0 });
const fail = (
  errorCode: string | undefined,
  errorMessage = '',
  errorCategory: QueryOutcome['errorCategory'] = 'other',
): QueryOutcome => ({
  queryId: 'q',
  wallMs: 1,
  streamedRows: 0,
  streamedBytes: 0,
  ok: false,
  errorCode,
  errorCategory,
  errorMessage,
});
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fast(concurrency: number, extra: Partial<ConstructorParameters<typeof Pool>[0]> = {}) {
  return new Pool({ concurrency, pauseMs: 0, startGapMs: 0, overloadPauseMs: 0, ...extra });
}

/** A unit that issues `queries` queries, logging start/end events. */
function unit(pool: Pool, label: string, cost: number, events: string[], queries = 2, ms = 5): PoolUnit {
  return {
    label,
    cost,
    async run(slot) {
      for (let i = 0; i < queries; i++) {
        await pool.query(slot, async () => {
          events.push(`${label}:start`);
          await delay(ms);
          events.push(`${label}:end`);
          return ok();
        });
      }
    },
  };
}

describe('overload classification', () => {
  it('treats server-busy codes and transport failures as overload, never per-query limits', () => {
    expect(isOverload(fail('202'))).toBe(true);
    expect(isOverload(fail('203'))).toBe(true);
    expect(isOverload(fail('209'))).toBe(true);
    expect(isOverload(fail('210'))).toBe(true);
    expect(isOverload(fail(undefined, 'socket hang up'))).toBe(true);
    expect(isOverload(fail(undefined, 'Request failed with status 503'))).toBe(true);
    expect(isOverload(fail('241', 'Memory limit (total) exceeded'))).toBe(true);
    expect(isOverload(fail('241', 'Memory limit (for query) exceeded', 'memory'))).toBe(false);
    expect(isOverload(fail('159', 'Timeout exceeded', 'timeout'))).toBe(false);
    expect(isOverload(fail('62', 'Syntax error'))).toBe(false);
    expect(isOverload(ok())).toBe(false);
    expect(isLimitCategory('overload')).toBe(false);
    expect(isLimitCategory('memory')).toBe(true);
    expect(isLimitCategory('other')).toBe(false);
  });
});

describe('request size classification', () => {
  it('treats an oversized HTTP parameter as a per-query limit, and leaves code-only inputs unchanged', () => {
    const message = 'Poco::Exception. Code: 1000, e.code() = 0, HTML Form Exception: Field value too long';
    expect(categorize(undefined, message)).toBe('request_size');
    expect(isLimitCategory('request_size')).toBe(true);
    expect(isOverload(fail(undefined, message, 'request_size'))).toBe(false);
    expect(categorize(undefined)).toBe('other');
    expect(categorize('241', message)).toBe('memory');
  });
});

describe('Pool', () => {
  it('rejects concurrency outside 1..8', () => {
    expect(() => fast(0)).toThrow();
    expect(() => fast(MAX_CONCURRENCY + 1)).toThrow();
    expect(() => fast(1.5)).toThrow();
  });

  it('at concurrency 1 runs units strictly sequentially, cheapest first, stable on ties', async () => {
    const pool = fast(1);
    const events: string[] = [];
    await pool.runPhase([unit(pool, 'c', 3, events, 1), unit(pool, 'a', 1, events, 1), unit(pool, 'b', 1, events, 1)]);
    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
    expect(pool.maxObservedInFlight).toBe(1);
  });

  it('never exceeds the concurrency limit and reports inFlight per query', async () => {
    const pool = fast(3);
    const seen: number[] = [];
    const units: PoolUnit[] = Array.from({ length: 9 }, (_, i) => ({
      label: `u${i}`,
      cost: i,
      async run(slot) {
        const tracked = await pool.query(slot, async () => {
          await delay(10);
          return ok();
        });
        seen.push(tracked.inFlight);
        expect(tracked.concurrency).toBe(3);
      },
    }));
    await pool.runPhase(units);
    expect(pool.maxObservedInFlight).toBe(3);
    expect(Math.max(...seen)).toBeLessThanOrEqual(3);
    expect(seen.length).toBe(9);
  });

  it('keeps a phase barrier: nothing from the next phase starts before the previous drains', async () => {
    const pool = fast(4);
    const events: string[] = [];
    await pool.runPhase([unit(pool, 'p1a', 1, events, 2, 15), unit(pool, 'p1b', 2, events, 1, 2)]);
    await pool.runPhase([unit(pool, 'p2a', 1, events, 1, 2)]);
    const lastP1 = Math.max(...events.map((e, i) => (e.startsWith('p1') ? i : -1)));
    const firstP2 = events.findIndex(e => e.startsWith('p2'));
    expect(firstP2).toBeGreaterThan(lastP1);
  });

  it('runs a unit\u2019s queries in order inside one slot, with the slot gap between them', async () => {
    const pool = new Pool({ concurrency: 2, pauseMs: 30, startGapMs: 0 });
    const starts: number[] = [];
    await pool.runPhase([
      {
        label: 'u',
        cost: 0,
        async run(slot) {
          for (let i = 0; i < 3; i++) {
            await pool.query(slot, async () => {
              starts.push(Date.now());
              return ok();
            });
          }
        },
      },
    ]);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(28);
    expect(starts[2]! - starts[1]!).toBeGreaterThanOrEqual(28);
  });

  it('spaces query starts globally by startGapMs', async () => {
    const pool = new Pool({ concurrency: 4, pauseMs: 0, startGapMs: 20 });
    const starts: number[] = [];
    await pool.runPhase(
      Array.from({ length: 4 }, (_, i) => ({
        label: `u${i}`,
        cost: 0,
        async run(slot) {
          await pool.query(slot, async () => {
            starts.push(Date.now());
            await delay(50);
            return ok();
          });
        },
      })),
    );
    starts.sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(18);
  });

  it('runs exclusive queries with nothing else in flight', async () => {
    const pool = fast(4);
    let exclusiveSawOthers = false;
    const units: PoolUnit[] = Array.from({ length: 6 }, (_, i) => ({
      label: `u${i}`,
      cost: 0,
      async run(slot) {
        await pool.query(
          slot,
          async () => {
            if (i === 2 && pool.inFlight !== 1) exclusiveSawOthers = true;
            await delay(10);
            return ok();
          },
          { exclusive: i === 2 },
        );
      },
    }));
    await pool.runPhase(units);
    expect(exclusiveSawOthers).toBe(false);
  });

  it('on overload halves concurrency, pauses, and retries the query once', async () => {
    const logs: string[] = [];
    const pool = fast(4, { overloadPauseMs: 40, log: m => logs.push(m) });
    let calls = 0;
    let t0 = 0;
    let t1 = 0;
    const result = await new Promise<Awaited<ReturnType<Pool['query']>>>((resolve, reject) => {
      pool
        .runPhase([
          {
            label: 'u',
            cost: 0,
            async run(slot) {
              resolve(
                await pool.query(slot, async () => {
                  calls++;
                  if (calls === 1) {
                    t0 = Date.now();
                    return fail('202');
                  }
                  t1 = Date.now();
                  return ok();
                }),
              );
            },
          },
        ])
        .catch(reject);
    });
    expect(calls).toBe(2);
    expect(result.retried).toBe(true);
    expect(result.outcome.ok).toBe(true);
    expect(pool.concurrency).toBe(2);
    expect(t1 - t0).toBeGreaterThanOrEqual(38);
    expect(logs.some(l => l.includes('4 → 2'))).toBe(true);
  });

  it('marks a twice-overloaded query as overload and does not count it toward non-limit errors', async () => {
    const pool = fast(4);
    let category: string | undefined;
    await pool.runPhase([
      {
        label: 'u',
        cost: 0,
        async run(slot) {
          category = (await pool.query(slot, async () => fail('203'))).outcome.errorCategory;
        },
      },
    ]);
    expect(category).toBe('overload');
    expect(pool.concurrency).toBe(1);
    expect(pool.aborted).toBeUndefined();
  });

  it('aborts after 3 overloads at concurrency 1', async () => {
    const pool = fast(1);
    const units: PoolUnit[] = Array.from({ length: 5 }, (_, i) => ({
      label: `u${i}`,
      cost: i,
      async run(slot) {
        await pool.query(slot, async () => fail('202'));
      },
    }));
    await expect(pool.runPhase(units)).rejects.toBeInstanceOf(PoolAborted);
    expect(pool.overloadCount).toBe(3);
  });

  it('aborts after 5 overloads within 10 minutes even above concurrency 1', async () => {
    const pool = fast(8);
    let n = 0;
    const units: PoolUnit[] = Array.from({ length: 10 }, (_, i) => ({
      label: `u${i}`,
      cost: i,
      async run(slot) {
        // Overload once per unit, then succeed on the retry: 8→4→2→1 then two more at 1... the
        // window rule must fire at the 5th regardless.
        let first = true;
        await pool.query(slot, async () => {
          if (first) {
            first = false;
            n++;
            return fail('202');
          }
          return ok();
        });
      },
    }));
    await expect(pool.runPhase(units)).rejects.toBeInstanceOf(PoolAborted);
    expect(n).toBeLessThanOrEqual(5);
  });

  it('aborts after 3 consecutive non-limit errors; limit hits neither count nor reset', async () => {
    const pool = fast(1);
    const plan = [fail('62'), fail('159', '', 'timeout'), fail('62'), fail('241', '', 'memory'), fail('62'), ok()];
    let started = 0;
    const units: PoolUnit[] = plan.map((outcome, i) => ({
      label: `u${i}`,
      cost: i,
      async run(slot) {
        started++;
        await pool.query(slot, async () => outcome);
      },
    }));
    await expect(pool.runPhase(units)).rejects.toBeInstanceOf(PoolAborted);
    expect(started).toBe(5);
  });

  it('success resets the consecutive error count', async () => {
    const pool = fast(1);
    const plan = [fail('62'), fail('62'), ok(), fail('62'), fail('62'), ok()];
    await pool.runPhase(
      plan.map((outcome, i) => ({
        label: `u${i}`,
        cost: i,
        async run(slot) {
          await pool.query(slot, async () => outcome);
        },
      })),
    );
    expect(pool.aborted).toBeUndefined();
  });

  it('reduce() only lowers concurrency, and idle slots above the limit stop taking units', async () => {
    const pool = fast(4);
    pool.reduce(8, 'noop');
    expect(pool.concurrency).toBe(4);
    const events: string[] = [];
    const units = Array.from({ length: 8 }, (_, i) => unit(pool, `u${i}`, i, events, 1, 5));
    const first: PoolUnit = {
      label: 'reducer',
      cost: -1,
      async run() {
        pool.reduce(1, 'test');
      },
    };
    await pool.runPhase([first, ...units]);
    expect(pool.concurrency).toBe(1);
    expect(events.filter(e => e.endsWith(':start')).length).toBe(8);
  });

  it('surfaces a unit exception after draining and refuses later phases', async () => {
    const pool = fast(2);
    await expect(
      pool.runPhase([
        {
          label: 'boom',
          cost: 0,
          async run() {
            throw new Error('boom');
          },
        },
      ]),
    ).rejects.toThrow('boom');
    await expect(pool.runPhase([])).rejects.toBeInstanceOf(PoolAborted);
  });
});
