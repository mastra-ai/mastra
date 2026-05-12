import type { BatchPolicyDeps } from './batch-policy';
import { BatchPolicy } from './batch-policy';
import type { Event, EventCallback, SubscribeBatchOptions } from './types';

interface Entry {
  event: Event;
  ack?: () => Promise<void>;
  nack?: () => Promise<void>;
}

/**
 * Buffer used by adapters whose underlying transport already provides
 * durability for unacked events (Redis Streams PEL, GCP outstanding pool,
 * or — for `EventEmitterPubSub` — the process itself).
 *
 * Holds (event, ack, nack) triples between policy decisions; invokes the
 * subscriber callback once per delivered event, in publish order, when
 * `BatchPolicy` says it's time to flush.
 */
export class AckHandleBuffer {
  private readonly policy: BatchPolicy;
  private queue: Entry[] = [];
  private flushing = false;
  private disposed = false;

  constructor(
    private readonly cb: EventCallback,
    opts: SubscribeBatchOptions,
    deps?: BatchPolicyDeps,
    private readonly onError?: (err: unknown, ctx: { phase: 'cb' | 'ack-dropped' }) => void,
  ) {
    this.policy = new BatchPolicy(opts, deps);
    this.policy.bindFlushHandler(() => this.flush());
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
    if (this.flushing) return;
    // Empty buffer is a true no-op. `policy.onFlushed` bumps `lastDeliveredAt`,
    // which extends the `minIntervalMs` floor — calling it on every empty
    // flush silently corrupts the cadence for callers that flush() defensively.
    if (this.queue.length === 0) return;

    this.flushing = true;
    try {
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

      // Invariant: `delivered.length + dropped.length === snapshot.length`
      // (modulo a throwing `coalesce`, which propagates and never reaches
      // here). Both sides come out of `prepareBatch(events)` over the same
      // snapshot, and `policy.size` was incremented once per push that
      // entered the snapshot. If a future change splits these counts (e.g.
      // late-delivered events accounted separately), update `onFlushed`
      // together — the size counter must decrement by everything that left
      // the queue, or it drifts upward and trips maxSize prematurely.
      this.policy.onFlushed(delivered.length + dropped.length);
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
