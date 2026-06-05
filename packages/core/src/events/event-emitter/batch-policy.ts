import type { Event, SubscribeBatchOptions } from '../types';

/**
 * Opaque timer handle. We don't care whether the runtime returns a number
 * (browser) or a `Timeout` (Node) — we only ever hand it back to
 * `clearTimeout`. Branding it keeps the type honest (you can't pass an
 * arbitrary number) while staying erasure-free at runtime.
 */
declare const batchPolicyTimerHandleBrand: unique symbol;
export type BatchPolicyTimerHandle = { readonly [batchPolicyTimerHandleBrand]: true };

/**
 * Injectable dependencies for `BatchPolicy`. Tests pass fake timers /
 * controllable clocks; production uses Node's `Date.now` / `setTimeout` /
 * `clearTimeout`.
 */
export interface BatchPolicyDeps {
  now: () => number;
  setTimeout: (cb: () => void, ms: number) => BatchPolicyTimerHandle;
  clearTimeout: (handle: BatchPolicyTimerHandle) => void;
}

const defaultDeps: BatchPolicyDeps = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms) as unknown as BatchPolicyTimerHandle,
  clearTimeout: handle => clearTimeout(handle as unknown as Parameters<typeof clearTimeout>[0]),
};

export type EnqueueDecision = 'flush-now' | 'wait';

export const DEFAULT_MAX_BUFFER_SIZE = 256;
export const DEFAULT_OVERFLOW: NonNullable<SubscribeBatchOptions['overflow']> = 'coalesce-or-drop-oldest';

/**
 * Internal to `EventEmitterPubSub`. Embedded by `AckHandleBuffer` to decide
 * when a batched subscription should flush (size, time, coalesce, overflow).
 *
 * Not part of the public API — users configure batching via
 * `SubscribeBatchOptions` on `subscribe`.
 */
export class BatchPolicy {
  private readonly opts: SubscribeBatchOptions;
  private readonly deps: BatchPolicyDeps;
  private readonly maxBufferSize: number;
  private readonly overflow: NonNullable<SubscribeBatchOptions['overflow']>;

  private firstQueuedAt: number | null = null;
  private lastDeliveredAt: number = -Infinity;
  private size = 0;
  private timer: BatchPolicyTimerHandle | null = null;
  private flushHandler: (() => void | Promise<void>) | null = null;

  constructor(opts: SubscribeBatchOptions, deps: BatchPolicyDeps = defaultDeps) {
    this.opts = opts;
    this.deps = deps;
    this.maxBufferSize = opts.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.overflow = opts.overflow ?? DEFAULT_OVERFLOW;
  }

  /** Bind the function invoked when the deadline timer fires. */
  bindFlushHandler(fn: () => void | Promise<void>): void {
    this.flushHandler = fn;
  }

  /**
   * Called by the integrator each time an event is enqueued.
   * Returns whether the integrator should flush immediately.
   */
  onEnqueue(event: Event): EnqueueDecision {
    this.size += 1;
    if (this.firstQueuedAt === null) {
      this.firstQueuedAt = this.deps.now();
    }

    const now = this.deps.now();
    const intervalFloor = this.lastDeliveredAt + (this.opts.minIntervalMs ?? 0);

    // Immediate event — bypass maxWait/maxSize gating, but still respect interval floor.
    if (this.opts.isImmediate?.(event)) {
      if (now >= intervalFloor) {
        return 'flush-now';
      }
      // Hold until the floor; reschedule timer there.
      this.scheduleAt(intervalFloor);
      return 'wait';
    }

    // Overflow trigger (regardless of interval — overflow is a budget enforcement).
    if (this.size >= this.maxBufferSize) {
      return 'flush-now';
    }

    // maxSize trigger — respects interval floor.
    if (this.opts.maxSize !== undefined && this.size >= this.opts.maxSize) {
      if (now >= intervalFloor) {
        return 'flush-now';
      }
      this.scheduleAt(intervalFloor);
      return 'wait';
    }

    // No immediate trigger — schedule the deadline if there is one.
    this.scheduleDeadline();
    return 'wait';
  }

  /**
   * Called by the integrator after a successful flush has delivered
   * `deliveredCount` events. Resets timer + firstQueuedAt.
   */
  onFlushed(deliveredCount: number): void {
    this.lastDeliveredAt = this.deps.now();
    this.size = Math.max(0, this.size - deliveredCount);
    this.firstQueuedAt = null;
    this.cancelTimer();
  }

  /**
   * Pure helper. Given the caller-owned queue contents, applies `coalesce`
   * and `overflow` to decide what to deliver and what to drop.
   * Order-preserving for kept events.
   */
  prepareBatch(events: Event[]): { delivered: Event[]; dropped: Event[] } {
    let working = events;

    // 1. Coalesce, if configured.
    if (this.opts.coalesce) {
      const coalesced = this.opts.coalesce(working);
      // Contract: `coalesce` MUST return a subset of `working` by reference
      // identity. Anything else (fresh objects, even with matching ids)
      // breaks ack routing downstream — AckHandleBuffer keys ack/nack by
      // event reference, and there's no way to map a manufactured event
      // back to the original transport handle. Detect the violation here
      // and discard the whole batch (treat all originals as dropped) rather
      // than silently deliver references with no ack/nack wired up.
      const inputRefs = new Set<Event>(working);
      const allInInput = coalesced.every(e => inputRefs.has(e));
      working = allInInput ? coalesced : [];
    }

    const keptRefs = new Set<Event>(working);
    const computeDropped = (): Event[] => events.filter(e => !keptRefs.has(e));

    // 2. Overflow handling — only if still over `maxBufferSize`.
    if (working.length <= this.maxBufferSize) {
      return { delivered: working, dropped: computeDropped() };
    }

    const overBy = working.length - this.maxBufferSize;
    const isImmediate = this.opts.isImmediate;

    let kept: Event[];
    let droppedFromOverflow: Event[];

    switch (this.overflow) {
      case 'drop-newest': {
        const splitFromEnd = this.takeWithoutDropping(working, overBy, isImmediate, /* fromEnd */ true);
        kept = splitFromEnd.kept;
        droppedFromOverflow = splitFromEnd.dropped;
        break;
      }
      case 'drop-oldest':
      case 'coalesce-or-drop-oldest':
      default: {
        const splitFromStart = this.takeWithoutDropping(working, overBy, isImmediate, /* fromEnd */ false);
        kept = splitFromStart.kept;
        droppedFromOverflow = splitFromStart.dropped;
        break;
      }
    }

    return { delivered: kept, dropped: [...computeDropped(), ...droppedFromOverflow] };
  }

  /** Stop the timer and clear policy state. */
  dispose(): void {
    this.cancelTimer();
    this.flushHandler = null;
    this.firstQueuedAt = null;
    this.size = 0;
  }

  private scheduleDeadline(): void {
    if (this.opts.maxWaitMs === undefined && this.opts.minIntervalMs === undefined) {
      // No time-based trigger — only `maxSize` / `isImmediate` can flush.
      return;
    }

    const firstQueuedAt = this.firstQueuedAt ?? this.deps.now();
    const deadline = this.opts.maxWaitMs !== undefined ? firstQueuedAt + this.opts.maxWaitMs : Number.POSITIVE_INFINITY;
    const floor = this.lastDeliveredAt + (this.opts.minIntervalMs ?? 0);
    const at = Math.max(deadline, floor);
    this.scheduleAt(at);
  }

  private scheduleAt(at: number): void {
    if (!isFinite(at)) {
      return;
    }
    this.cancelTimer();
    const delay = Math.max(0, at - this.deps.now());
    this.timer = this.deps.setTimeout(() => {
      this.timer = null;
      const handler = this.flushHandler;
      if (handler) {
        void handler();
      }
    }, delay);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.deps.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Drop `count` non-immediate items from the start (or end) of `items`.
   * Immediate items are never dropped — if every candidate is immediate,
   * fewer than `count` items are dropped.
   */
  private takeWithoutDropping(
    items: Event[],
    count: number,
    isImmediate: ((e: Event) => boolean) | undefined,
    fromEnd: boolean,
  ): { kept: Event[]; dropped: Event[] } {
    const dropped: Event[] = [];
    const result = [...items];
    let remaining = count;

    const order = fromEnd ? [...result.keys()].reverse() : [...result.keys()];

    for (const idx of order) {
      if (remaining === 0) break;
      const ev = result[idx]!;
      if (isImmediate?.(ev)) continue;
      dropped.push(ev);
      result[idx] = undefined as unknown as Event;
      remaining -= 1;
    }

    const kept = result.filter((e): e is Event => e !== undefined);
    return { kept, dropped };
  }
}
