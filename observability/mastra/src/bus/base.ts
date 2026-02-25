/**
 * BaseObservabilityEventBus - Generic event bus for observability events.
 *
 * Provides a synchronous pub/sub mechanism:
 * - Events are dispatched to subscribers immediately on emit()
 * - Graceful error handling (handler errors don't break other handlers)
 * - Clean shutdown clears subscribers
 *
 * Buffering/batching is intentionally NOT done here — individual exporters
 * own their own batching strategy (e.g. CloudExporter batches uploads).
 */

import { MastraBase } from '@mastra/core/base';
import { RegisteredLogger } from '@mastra/core/logger';
import type { ObservabilityEventBus } from '@mastra/core/observability';

export class BaseObservabilityEventBus<TEvent> extends MastraBase implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();

  constructor({ name }: { name?: string } = {}) {
    super({ component: RegisteredLogger.OBSERVABILITY, name: name ?? 'EventBus' });
  }

  emit(event: TEvent): void {
    for (const handler of this.subscribers) {
      try {
        // Handler is typed as () => void, but at runtime an async fn returns a Promise.
        // Defensively catch rejected promises so they don't become unhandled rejections.
        const result: unknown = handler(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => {
            this.logger.error('[ObservabilityEventBus] Handler error:', err);
          });
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

  /** No-op — events are dispatched immediately, nothing to flush. Kept for interface compat. */
  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {
    this.subscribers.clear();
  }
}
