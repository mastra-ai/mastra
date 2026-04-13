/**
 * ClientObservabilityProxy implementation for @mastra/observability.
 *
 * Handles the two halves of the client observability flow:
 *
 *  - `inject(parentSpan)` (called from request 1) — produces the W3C
 *    carrier the server attaches to the outgoing chunk so the client
 *    SDK can extract it and parent its child spans/logs correctly.
 *
 *  - `receive(payload, parentContext)` (called from request 2 when the
 *    client returns) — decodes the OTLP/JSON payload the client sent
 *    back, validates that it actually belongs to the parent trace
 *    identified by `parentContext`, and forwards each span/log into
 *    the observability bus so existing exporters pick them up.
 *
 * See `observability/mastra/plans/client-tool-tracing.md` for the full
 * design rationale.
 */

import type { IMastraLogger } from '@mastra/core/logger';
import { EntityType, TracingEventType } from '@mastra/core/observability';
import type {
  AnySpan,
  ClientObservabilityCarrier,
  ClientObservabilityProxy,
  ClientObservabilityPayload,
  LogEvent,
  MetricEvent,
  ObservabilityInstance,
  TracingEvent,
} from '@mastra/core/observability';

import { BaseObservabilityInstance } from '../instances/base';
import { buildExportedLog, buildExportedSpan, decodeResourceLogs, decodeResourceSpans } from './otlp';
import type { DecodedOtlpLog, DecodedOtlpSpan } from './otlp';
import { formatTraceparent, parseTraceparent } from './w3c';

/**
 * Hard caps. A misbehaving client could ship arbitrary OTLP; reject
 * payloads that blow past these limits to keep the server safe.
 */
export interface ClientObservabilityProxyLimits {
  /** Maximum number of spans accepted per receive call. */
  maxSpans: number;
  /** Maximum number of log records accepted per receive call. */
  maxLogs: number;
  /** Maximum total payload size in bytes (JSON.stringify length). */
  maxPayloadBytes: number;
}

export const DEFAULT_LIMITS: ClientObservabilityProxyLimits = {
  maxSpans: 10,
  maxLogs: 10,
  maxPayloadBytes: 1024 * 1024,
};

export interface CreateClientObservabilityProxyOptions {
  /**
   * Resolves the observability instance to forward into. Called per
   * `receive()` so config selection works the same way as for
   * server-side spans. Returning `undefined` causes the payload to be
   * dropped silently.
   */
  resolveInstance: () => ObservabilityInstance | undefined;
  /** Logger for warnings about dropped/rejected payloads. */
  logger?: IMastraLogger;
  limits?: Partial<ClientObservabilityProxyLimits>;
}

class ClientObservabilityProxyImpl implements ClientObservabilityProxy {
  readonly #resolveInstance: () => ObservabilityInstance | undefined;
  readonly #logger?: IMastraLogger;
  readonly #limits: ClientObservabilityProxyLimits;

  constructor(options: CreateClientObservabilityProxyOptions) {
    this.#resolveInstance = options.resolveInstance;
    this.#logger = options.logger;
    this.#limits = { ...DEFAULT_LIMITS, ...options.limits };
  }

  inject(parentSpan: AnySpan): ClientObservabilityCarrier {
    return {
      // Mastra spans use OTel-compatible 32-hex traceIds and 16-hex
      // spanIds, so they drop straight into the W3C format. Sampled
      // flag is always 1: if the parent span exists at all, the trace
      // is being recorded server-side, so the client should record too.
      traceparent: formatTraceparent(parentSpan.traceId, parentSpan.id, true),
    };
  }

  receive(payload: ClientObservabilityPayload, parentContext: ClientObservabilityCarrier): void {
    if (!payload || (!payload.spans && !payload.logs && payload.executionDurationMs === undefined)) {
      return;
    }

    // Size cap before decoding so a hostile payload can't OOM us.
    let payloadBytes = 0;
    try {
      payloadBytes = JSON.stringify(payload).length;
    } catch {
      this.#warn('Client observability payload is not JSON-serializable; dropping.');
      return;
    }
    if (payloadBytes > this.#limits.maxPayloadBytes) {
      this.#warn('Client observability payload exceeds size limit; dropping.', {
        bytes: payloadBytes,
        limit: this.#limits.maxPayloadBytes,
      });
      return;
    }

    const parent = parseTraceparent(parentContext.traceparent);
    if (!parent) {
      this.#warn('Client observability parentContext.traceparent is malformed; dropping payload.');
      return;
    }

    const instance = this.#resolveInstance();
    if (!instance || !(instance instanceof BaseObservabilityInstance)) {
      // No instance to forward into; silently drop. This is normal in
      // tests and in setups without a default instance configured.
      return;
    }

    const decodedSpans = payload.spans ? decodeResourceSpans(payload.spans) : [];
    const decodedLogs = payload.logs ? decodeResourceLogs(payload.logs) : [];

    if (decodedSpans.length > this.#limits.maxSpans) {
      this.#warn('Client observability payload exceeds span count limit; dropping.', {
        spans: decodedSpans.length,
        limit: this.#limits.maxSpans,
      });
      return;
    }
    if (decodedLogs.length > this.#limits.maxLogs) {
      this.#warn('Client observability payload exceeds log count limit; dropping.', {
        logs: decodedLogs.length,
        limit: this.#limits.maxLogs,
      });
      return;
    }

    // Validation: every span/log traceId must match the parent
    // traceparent. This prevents a hostile client from injecting spans
    // into traces it doesn't own.
    if (!validateTraceIds(decodedSpans, decodedLogs, parent.traceId)) {
      this.#warn('Client observability payload contains spans or logs from a foreign trace; dropping.');
      return;
    }

    // Validation: every span's parentSpanId must resolve to the parent
    // span identified by parentContext, or to another span present in
    // this payload. Forbidding orphans prevents broken trees and bounds
    // the trust we place in client input.
    if (!validateParentLinks(decodedSpans, parent.spanId)) {
      this.#warn('Client observability payload contains spans with orphan parents; dropping.');
      return;
    }

    // All validation passed; emit through the bus.
    for (const decoded of decodedSpans) {
      const exported = buildExportedSpan(decoded);
      const startedEvent: TracingEvent = { type: TracingEventType.SPAN_STARTED, exportedSpan: exported };
      instance.__receiveExternalEvent(startedEvent);
      // If the span has an end time, also emit the ended event so
      // exporters that only care about completed spans see it.
      if (exported.endTime) {
        const endedEvent: TracingEvent = { type: TracingEventType.SPAN_ENDED, exportedSpan: exported };
        instance.__receiveExternalEvent(endedEvent);
      }
    }
    for (const decoded of decodedLogs) {
      const log = buildExportedLog(decoded);
      const event: LogEvent = { type: 'log', log };
      instance.__receiveExternalEvent(event);
    }

    // Emit a duration metric. This is the only way the server can
    // recover the actual wall-clock duration since the event span has
    // no endTime and would be skipped by emitDurationMetrics.
    if (typeof payload.executionDurationMs === 'number') {
      const hasError = decodedSpans.some(s => s.statusCode === 2);
      const metricEvent: MetricEvent = {
        type: 'metric',
        metric: {
          timestamp: new Date(),
          traceId: parent.traceId,
          spanId: parent.spanId,
          name: 'mastra_tool_duration_ms',
          value: payload.executionDurationMs,
          labels: { status: hasError ? 'error' : 'ok', toolType: 'client' },
          correlationContext: {
            traceId: parent.traceId,
            spanId: parent.spanId,
            entityType: EntityType.TOOL,
            ...(payload.toolName ? { entityName: payload.toolName } : {}),
          },
        },
      };
      instance.__receiveExternalEvent(metricEvent);
    }
  }

  #warn(message: string, data?: Record<string, unknown>): void {
    if (this.#logger) {
      this.#logger.warn(`[ClientObservabilityProxy] ${message}`, data);
    }
  }
}

function validateTraceIds(spans: DecodedOtlpSpan[], logs: DecodedOtlpLog[], expected: string): boolean {
  for (const s of spans) if (s.traceId !== expected) return false;
  for (const l of logs) if (l.traceId !== expected) return false;
  return true;
}

function validateParentLinks(spans: DecodedOtlpSpan[], rootParent: string): boolean {
  if (spans.length === 0) return true;
  const known = new Set<string>([rootParent]);
  for (const s of spans) known.add(s.spanId);
  for (const s of spans) {
    if (!s.parentSpanId) {
      return false;
    }
    if (!known.has(s.parentSpanId)) {
      return false;
    }
  }
  return true;
}

export function createClientObservabilityProxy(
  options: CreateClientObservabilityProxyOptions,
): ClientObservabilityProxy {
  return new ClientObservabilityProxyImpl(options);
}
