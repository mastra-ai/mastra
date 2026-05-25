/**
 * Client observability types for @mastra/client-js.
 *
 * These are internal to the SDK — users interact via `observe` on the
 * tool execution context, not with the collector directly.
 */

import type { ClientObservabilityCarrier, ClientObservabilityPayload } from '@mastra/core/observability';

/**
 * Per-invocation collector that buffers spans and logs from inside a
 * client-side execute function. Created automatically by the SDK when
 * the server sends a W3C carrier on a tool-call chunk.
 */
export interface ObservabilityCollector {
  /** The W3C carrier this collector is parented under. */
  readonly parentContext: ClientObservabilityCarrier;

  /** Wrap an async operation in a child span. */
  span<T>(name: string, fn: () => Promise<T> | T, attributes?: Record<string, unknown>): Promise<T>;

  /** Record a structured log entry against the current innermost span. */
  log(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', message: string, data?: Record<string, unknown>): void;

  /** Run a function with this collector as the active context. */
  withContext<T>(fn: () => Promise<T> | T): Promise<T>;

  /** Drain all buffered spans and logs into an OTLP/JSON payload. */
  flush(): ClientObservabilityPayload;
}

/** Factory that creates a collector from a W3C carrier. */
export type ObservabilityCollectorFactory = (parentContext: ClientObservabilityCarrier) => ObservabilityCollector;
