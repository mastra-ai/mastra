/**
 * Client observability interfaces.
 *
 * These interfaces define the contract for propagating observability
 * context from the server to the client and receiving buffered
 * spans/logs back. Currently used for client-side tool execution
 * (tools defined via `@mastra/client-js`'s `clientTools` feature),
 * but the interfaces are intentionally generic so they can be reused
 * for any server→client→server observability boundary.
 *
 * `@mastra/core` defines only the interfaces here. The implementation
 * (W3C trace context propagation, OTLP/JSON decoding) lives in
 * `@mastra/observability`.
 */

import type { AnySpan } from './tracing';

/**
 * W3C trace context carrier shipped from server to client.
 *
 * Holds `traceparent`, `tracestate`, and `baggage` so the client SDK
 * can attach child spans/logs to the right parent and honor sampling
 * decisions made server-side.
 */
export interface ClientObservabilityCarrier {
  /** W3C traceparent header value, e.g. `00-{traceId}-{spanId}-{flags}` */
  traceparent: string;
  /** W3C tracestate header value */
  tracestate?: string;
  /** W3C baggage header value, used to carry sampling decisions and runIds */
  baggage?: string;
}

/**
 * OTLP/JSON payload returned from client to server.
 *
 * `spans` and `logs` are typed as `unknown` at the core boundary; the
 * implementation in `@mastra/observability` validates the actual
 * OTLP/JSON shape (`ResourceSpans` for `spans`, `ResourceLogs` for
 * `logs`) before forwarding to the observability bus.
 *
 * `executionDurationMs` and `toolName` are populated by the client SDK
 * collector so the server can emit a duration metric. They are the
 * only way the server can recover the actual wall-clock duration of
 * the client-side execution when the server-side span is an event
 * span with no endTime.
 */
export interface ClientObservabilityPayload {
  /** OTLP/JSON encoded ResourceSpans */
  spans?: unknown;
  /** OTLP/JSON encoded ResourceLogs */
  logs?: unknown;
  /**
   * Wall-clock duration in milliseconds, measured by the client
   * collector around the user-supplied function.
   */
  executionDurationMs?: number;
  /**
   * Name of the operation that was executed. Used as the `entityName`
   * on the duration metric so it can be filtered.
   */
  toolName?: string;
}

/**
 * Server-side proxy for client observability data.
 *
 * Provided by `@mastra/observability`. The server calls `inject` to
 * produce a W3C carrier for the outgoing chunk, and calls `receive`
 * on the next request to decode and forward the client's buffered
 * spans/logs into the observability bus.
 *
 * `receive` is called from a **different request** than `inject`: the
 * carrier is the only thing that survives across the two requests,
 * which is why `receive` takes a `ClientObservabilityCarrier` rather
 * than a live `AnySpan`.
 *
 * Implementations must validate that:
 *  - every span/log `traceId` matches the traceparent in the carrier
 *  - every span's `parentSpanId` resolves to the carrier's span or to
 *    another span in the same payload
 *  - hard caps on span/log counts and total payload size are enforced
 */
export interface ClientObservabilityProxy {
  /**
   * Inject the parent span's W3C context into a carrier for transport
   * to the client.
   */
  inject(parentSpan: AnySpan): ClientObservabilityCarrier;

  /**
   * Validate and forward an OTLP/JSON payload returned by the client,
   * parented under the span identified by `parentContext`.
   *
   * Implementations should silently drop invalid payloads (logging a
   * warning) rather than throwing, so a misbehaving client cannot
   * break the server-side operation.
   */
  receive(payload: ClientObservabilityPayload, parentContext: ClientObservabilityCarrier): void;
}
