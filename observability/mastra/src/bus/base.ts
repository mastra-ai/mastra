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
 * own their own batching strategy (e.g. CloudExporter batches uploads).
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

  subscribe(handler: (event: TEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  /** Await all in-flight async subscriber promises. */
  async flush(): Promise<void> {
    if (this.pendingSubscribers.size > 0) {
      await Promise.allSettled([...this.pendingSubscribers]);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.subscribers.clear();
  }
}
