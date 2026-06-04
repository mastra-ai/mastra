import type { Event, EventCallback, SubscribeBatchOptions } from '../types';
import type { BatchPolicyDeps } from './batch-policy';
import { BatchPolicy } from './batch-policy';

interface Entry {
  event: Event;
  ack?: () => Promise<void>;
  nack?: () => Promise<void>;
}

/**
 * In-process queue used by `EventEmitterPubSub` to turn its
 * one-event-per-emit stream into batched callback invocations.
 * Owns a `BatchPolicy` that decides when to flush (size, time,
 * quiet-period) and holds (event, ack, nack) triples in publish
 * order until that decision fires.
 *
 * Extracted from `EventEmitterPubSub` only so the batching state
 * machine can be tested in isolation. Not a public extension point.
 * State is per-process; the queue dies with the process.
 */
export class AckHandleBuffer {
  private readonly policy: BatchPolicy;
  private queue: Entry[] = [];
  private flushing = false;
  private reflush = false;
  private disposed = false;

  constructor(
    private readonly cb: EventCallback,
    opts: SubscribeBatchOptions,
    deps?: BatchPolicyDeps,
    private readonly onError?: (err: unknown, ctx: { phase: 'cb' | 'ack-dropped' }) => void,
  ) {
    this.policy = new BatchPolicy(opts, deps);
    // The policy's deadline timer fires this handler fire-and-forget (it
    // discards the returned promise), so a rejection from `flush()` — e.g. a
    // user-supplied `coalesce` throwing inside `prepareBatch`, which lands
    // outside the per-event try/catch below — would otherwise escape as an
    // unhandled rejection on the timer path. The inline flush-now, group, and
    // explicit `flush()` paths each catch this already; route the timer path
    // through the same `onError` channel.
    this.policy.bindFlushHandler(() =>
      this.flush().catch(err => {
        this.onError?.(err, { phase: 'cb' });
      }),
    );
  }

  /**
   * Called by the adapter for each event arriving from the underlying transport.
   */
  async push(event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): Promise<void> {
    if (this.disposed) return;
    this.queue.push({ event, ack, nack });
    const decision = this.policy.onEnqueue(event);
    if (decision === 'flush-now') {
      await this.flush();
    }
  }

  /**
   * Drain the current queue regardless of policy state. Safe to call from
   * adapter `flush()` or external code that wants to force delivery.
   */
  async flush(): Promise<void> {
    // A flush-now request that lands while we're already draining is not
    // dropped — latch it so the current pass picks up the new events as
    // soon as it finishes its current snapshot, instead of forcing those
    // events to wait until the policy timer fires.
    if (this.flushing) {
      this.reflush = true;
      return;
    }
    // Empty buffer is a true no-op. `policy.onFlushed` bumps `lastDeliveredAt`,
    // which extends the `minIntervalMs` floor — calling it on every empty
    // flush silently corrupts the cadence for callers that flush() defensively.
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
      do {
        this.reflush = false;
        if (this.queue.length === 0) break;

        const snapshot = this.queue;
        this.queue = [];

        const events = snapshot.map(e => e.event);
        // Build a reverse index once so we don't pay O(n) per event looking up
        // the original Entry below.
        const byEvent = new Map<Event, Entry>();
        for (const e of snapshot) byEvent.set(e.event, e);

        const { delivered, dropped } = this.policy.prepareBatch(events);

        // Ack events that were coalesced or overflow-dropped — they should
        // not be redelivered. The transport's own ack is the right hook.
        for (const ev of dropped) {
          const entry = byEvent.get(ev);
          if (entry?.ack) {
            try {
              await entry.ack();
            } catch (err) {
              this.onError?.(err, { phase: 'ack-dropped' });
            }
          }
        }

        for (const ev of delivered) {
          // A cb may dispose the buffer mid-flush (e.g. subscriber tearing
          // itself down on a fatal event). Honor it immediately — don't keep
          // feeding events into a callback that asked to stop.
          if (this.disposed) break;
          const entry = byEvent.get(ev);
          try {
            // The declared EventCallback return type is `void`, but real
            // implementations frequently return a Promise. Await both kinds
            // so per-event isolation actually waits for the cb to settle.
            await (this.cb(ev, entry?.ack, entry?.nack) as void | Promise<void>);
          } catch (err) {
            this.onError?.(err, { phase: 'cb' });
          }
        }

        // `policy.size` was incremented once per push; decrement it by
        // everything that left the queue (delivered + dropped) so it doesn't
        // drift upward and trip maxSize prematurely.
        this.policy.onFlushed(delivered.length + dropped.length);
      } while (this.reflush && !this.disposed);
    } finally {
      this.flushing = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.queue = [];
    this.policy.dispose();
  }
}
