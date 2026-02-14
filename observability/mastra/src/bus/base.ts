/**
 * BaseObservabilityEventBus - Generic event bus with buffering support.
 *
 * Provides a generic pub/sub mechanism for observability events with:
 * - Buffered emission (events accumulate until buffer is full or flushed)
 * - Configurable buffer size and flush interval
 * - Graceful error handling (handler errors don't break other handlers)
 * - Clean shutdown with final flush
 */

import type { ObservabilityEventBus } from '@mastra/core/observability';

export interface BaseObservabilityEventBusOptions {
  /**
   * Maximum number of events to buffer before auto-flushing.
   * @default 100
   */
  bufferSize?: number;

  /**
   * Interval in milliseconds to auto-flush buffered events.
   * When set to 0 or undefined, no periodic flushing occurs.
   */
  flushIntervalMs?: number;
}

export class BaseObservabilityEventBus<TEvent> implements ObservabilityEventBus<TEvent> {
  private subscribers: Set<(event: TEvent) => void> = new Set();
  private buffer: TEvent[] = [];
  private bufferSize: number;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: BaseObservabilityEventBusOptions = {}) {
    this.bufferSize = options.bufferSize ?? 100;
    if (options.flushIntervalMs && options.flushIntervalMs > 0) {
      this.flushInterval = setInterval(() => this.flush(), options.flushIntervalMs);
      // Allow the process to exit even if the interval is still running
      if (typeof this.flushInterval === 'object' && 'unref' in this.flushInterval) {
        this.flushInterval.unref();
      }
    }
  }

  emit(event: TEvent): void {
    this.buffer.push(event);
    if (this.buffer.length >= this.bufferSize) {
      this.flush().catch(err => {
        console.error('[ObservabilityEventBus] Auto-flush error:', err);
      });
    }
  }

  subscribe(handler: (event: TEvent) => void): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  async flush(): Promise<void> {
    const events = this.buffer.splice(0);
    if (events.length === 0) return;

    await Promise.all(
      events.flatMap(event =>
        Array.from(this.subscribers).map(handler =>
          Promise.resolve()
            .then(() => handler(event))
            .catch(err => {
              console.error('[ObservabilityEventBus] Handler error:', err);
            }),
        ),
      ),
    );
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
    this.subscribers.clear();
  }
}
