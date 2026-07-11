/**
 * Client observability internals.
 *
 * These files implement the in-memory OTLP/JSON collector that buffers
 * spans and logs from inside client-side execute functions. The
 * collector is created automatically by the SDK whenever the server
 * sends a W3C trace context carrier — no user configuration needed.
 *
 * Users interact via `observe` on the tool execution context, not
 * with the collector directly.
 */

export { createObservabilityCollector } from './collector';
export type { ObservabilityCollector, ObservabilityCollectorFactory } from './types';
