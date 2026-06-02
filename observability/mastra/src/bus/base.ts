/**
 * BaseObservabilityEventBus - Generic event bus for observability events.
 *
 * Provides a synchronous pub/sub mechanism:
 * - Events are dispatched to subscribers immediately on emit()
 * - Graceful error handling (handler errors don't break other handlers)
 * - flush() awaits any in-flight async subscriber promises
 * - Clean shutdown flushes then clears subscribers
 *
 * Buffering/batching is intentionally NOT done here — individual exporters
 * own their own batching strategy.
 */

import { MastraBase } from '@mastra/core/base';
import { RegisteredLogger } from '@mastra/core/logger';
import type { ObservabilityEventBus } from '@mastra/core/observability';

export class BaseObservabilityEventBus<TEvent> extends MastraBase implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();

  /** In-flight async subscriber promises. Self-cleaning via .finally(). */
  private pendingSubscribers: Set<Promise<void>> = new Set();

  constructor({ name }: { name?: string } = {}) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: name ?? 'EventBus' });
  }

  /**
   * Dispatch an event to all subscribers synchronously.
   * Async handler promises are tracked internally and drained by {@link flush}.
   *
   * @param event - The event to broadcast to subscribers.
   */
  emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        // Handler is typed as () => void, but at runtime an async fn returns a Promise.
        // Defensively catch rejected promises so they don't become unhandled rejections.
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).then === 'function') {
          const promise = (result as Promise<void>).catch(err => {
            this.logger.error('[ObservabilityEventBus] Handler error:', err);
          });
          this.pendingSubscribers.add(promise);
          void promise.finally(() => this.pendingSubscribers.delete(promise));
        }
      } catch (err) {
        this.logger.error('[ObservabilityEventBus] Handler error:', err);
      }
    }
  }

  /**
   * Register a handler to receive future events.
   *
   * @param handler - Callback invoked synchronously on each {@link emit}.
   * @returns An unsubscribe function that removes the handler.
   */
  subscribe(handler: (event: TEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /** Max flush drain iterations before bailing — prevents infinite loops when handlers re-emit. */
  private static readonly MAX_FLUSH_ITERATIONS = 3;

  /** Await all in-flight async subscriber promises, draining until empty. */
  async flush(): Promise<void> {
    let iterations = 0;
    while (this.pendingSubscribers.size > 0) {
      await Promise.allSettled([...this.pendingSubscribers]);
      iterations++;
      if (iterations >= BaseObservabilityEventBus.MAX_FLUSH_ITERATIONS) {
        this.logger.error(
          `[ObservabilityEventBus] flush() exceeded ${BaseObservabilityEventBus.MAX_FLUSH_ITERATIONS} drain iterations — ` +
            `${this.pendingSubscribers.size} promises still pending. Handlers may be re-emitting during flush.`,
        );
        break;
      }
    }
  }

  /** Flush pending promises, then clear all subscribers. */
  async shutdown(): Promise<void> {
    await this.flush();
    this.subscribers.clear();
  }
}
