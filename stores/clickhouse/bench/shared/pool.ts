/**
 * Bounded-concurrency query pool for suites that opt in (trace-query). The aggregate suite never
 * uses it and keeps its original sequential loop.
 *
 * - Callers hand over one phase at a time; a phase drains completely before `runPhase` resolves,
 *   so smallest-first ordering and the escalation rule stay exact across phases.
 * - Within a phase, units are dequeued cheapest-first; a unit's queries run sequentially in its slot.
 * - Every query waits for its slot's own gap (`pauseMs`), a global start gap (`startGapMs`), a free
 *   in-flight permit, and any overload pause. `exclusive` queries run with nothing else in flight.
 * - Overload (server busy, not a per-query limit): halve concurrency (floor 1), pause every slot,
 *   retry that query once. Abort on 3 overloads at concurrency 1, or 5 within 10 minutes.
 * - Abort after `maxConsecutiveErrors` non-limit errors across all slots: in-flight queries drain,
 *   nothing new starts.
 */
import { isLimitCategory, isOverload } from './client';
import type { QueryOutcome } from './client';

export const MAX_CONCURRENCY = 8;
const OVERLOAD_WINDOW_MS = 10 * 60_000;
const OVERLOADS_IN_WINDOW = 5;
const OVERLOADS_AT_ONE = 3;
const POLL_MS = 10;

export class PoolAborted extends Error {}

export interface Slot {
  id: number;
  lastQueryEnd: number;
}

export interface PoolUnit {
  cost: number;
  label: string;
  run(slot: Slot): Promise<void>;
}

export interface Tracked<Row> {
  outcome: QueryOutcome<Row>;
  /** Concurrency limit in force when the query started. */
  concurrency: number;
  /** Queries in flight when it started, including itself. */
  inFlight: number;
  retried: boolean;
}

export interface PoolOptions {
  concurrency: number;
  pauseMs?: number;
  startGapMs?: number;
  overloadPauseMs?: number;
  maxConsecutiveErrors?: number;
  log?: (message: string) => void;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, Math.max(0, ms)));

export class Pool {
  concurrency: number;
  inFlight = 0;
  maxObservedInFlight = 0;
  aborted: string | undefined;
  readonly #pauseMs: number;
  readonly #startGapMs: number;
  readonly #overloadPauseMs: number;
  readonly #maxConsecutiveErrors: number;
  readonly #log: (message: string) => void;
  #pausedUntil = 0;
  #nextStart = 0;
  #exclusive = false;
  #consecutiveErrors = 0;
  readonly #overloads: Array<{ at: number; concurrency: number }> = [];

  constructor(options: PoolOptions) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > MAX_CONCURRENCY) {
      throw new Error(`concurrency must be an integer in 1..${MAX_CONCURRENCY}`);
    }
    this.concurrency = options.concurrency;
    this.#pauseMs = options.pauseMs ?? 2_000;
    this.#startGapMs = options.startGapMs ?? 250;
    this.#overloadPauseMs = options.overloadPauseMs ?? 60_000;
    this.#maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.#log = options.log ?? (() => {});
  }

  get overloadCount(): number {
    return this.#overloads.length;
  }

  /** Lower the limit for the rest of the run (overload or a sentinel drift). Never raises it. */
  reduce(to: number, reason: string): void {
    const next = Math.max(1, Math.min(this.concurrency, Math.floor(to)));
    if (next === this.concurrency) return;
    this.#log(`concurrency ${this.concurrency} → ${next} (${reason})`);
    this.concurrency = next;
  }

  /** Run one phase to completion. Throws `PoolAborted` (after draining) if the run aborted. */
  async runPhase(units: PoolUnit[]): Promise<void> {
    if (this.aborted) throw new PoolAborted(this.aborted);
    const queue = units
      .map((unit, index) => ({ unit, index }))
      .sort((a, b) => a.unit.cost - b.unit.cost || a.index - b.index);
    let failure: unknown;
    const worker = async (id: number) => {
      const slot: Slot = { id, lastQueryEnd: 0 };
      while (queue.length > 0 && !this.aborted && failure === undefined) {
        if (id >= this.concurrency) return;
        const { unit } = queue.shift()!;
        try {
          await unit.run(slot);
        } catch (error) {
          if (error instanceof PoolAborted) return;
          failure ??= error;
          this.aborted ??= `unit ${unit.label} failed`;
        }
      }
    };
    await Promise.all(Array.from({ length: this.concurrency }, (_, id) => worker(id)));
    if (failure !== undefined) throw failure;
    if (this.aborted) throw new PoolAborted(this.aborted);
  }

  /** Run one query under the pool's pacing, permits and overload policy. */
  async query<Row>(
    slot: Slot,
    exec: () => Promise<QueryOutcome<Row>>,
    options: { exclusive?: boolean } = {},
  ): Promise<Tracked<Row>> {
    let retried = false;
    for (;;) {
      if (this.aborted) throw new PoolAborted(this.aborted);
      await sleep(slot.lastQueryEnd + this.#pauseMs - Date.now());
      const start = await this.#acquire(options.exclusive === true);
      let outcome: QueryOutcome<Row>;
      try {
        outcome = await exec();
      } finally {
        this.inFlight--;
        if (options.exclusive) this.#exclusive = false;
        slot.lastQueryEnd = Date.now();
      }
      if (isOverload(outcome)) {
        this.#onOverload();
        if (!retried && !this.aborted) {
          retried = true;
          continue;
        }
        return { outcome: { ...outcome, errorCategory: 'overload' }, ...start, retried };
      }
      this.#onResult(outcome);
      return { outcome, ...start, retried };
    }
  }

  async #acquire(exclusive: boolean): Promise<{ concurrency: number; inFlight: number }> {
    for (;;) {
      if (this.aborted) throw new PoolAborted(this.aborted);
      const now = Date.now();
      const blocked =
        now < this.#pausedUntil ||
        this.#exclusive ||
        this.inFlight >= this.concurrency ||
        (exclusive && this.inFlight > 0);
      if (!blocked && now >= this.#nextStart) {
        this.inFlight++;
        this.maxObservedInFlight = Math.max(this.maxObservedInFlight, this.inFlight);
        if (exclusive) this.#exclusive = true;
        this.#nextStart = now + this.#startGapMs;
        return { concurrency: exclusive ? 1 : this.concurrency, inFlight: this.inFlight };
      }
      const wait = blocked ? POLL_MS : this.#nextStart - now;
      await sleep(Math.min(Math.max(wait, 1), Math.max(POLL_MS, this.#pausedUntil - now)));
    }
  }

  #onOverload(): void {
    const now = Date.now();
    this.#overloads.push({ at: now, concurrency: this.concurrency });
    const atOne = this.#overloads.filter(o => o.concurrency === 1).length;
    const recent = this.#overloads.filter(o => now - o.at <= OVERLOAD_WINDOW_MS).length;
    if (atOne >= OVERLOADS_AT_ONE || recent >= OVERLOADS_IN_WINDOW) {
      this.aborted ??= `replica overloaded (${atOne} at concurrency 1, ${recent} in 10 min)`;
      this.#log(`aborting: ${this.aborted}`);
      return;
    }
    this.reduce(Math.floor(this.concurrency / 2), 'overload');
    this.#pausedUntil = Math.max(this.#pausedUntil, now + this.#overloadPauseMs);
    this.#log(`overload: pausing all slots ${Math.round(this.#overloadPauseMs / 1000)}s`);
  }

  #onResult(outcome: QueryOutcome<unknown>): void {
    // Same rule as the aggregate loop: success resets, limit hits neither reset nor count.
    if (outcome.ok) {
      this.#consecutiveErrors = 0;
      return;
    }
    if (isLimitCategory(outcome.errorCategory ?? 'other')) return;
    this.#consecutiveErrors++;
    if (this.#consecutiveErrors >= this.#maxConsecutiveErrors) {
      this.aborted ??= `${this.#consecutiveErrors} consecutive non-limit errors`;
      this.#log(`aborting: ${this.aborted}`);
    }
  }
}
