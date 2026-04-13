/**
 * Hand-rolled OTLP/JSON decoder for the subset we need to ingest from
 * client-side tool execution.
 *
 * The full OTLP/JSON spec is defined in
 * https://opentelemetry.io/docs/specs/otlp/#otlphttp and the
 * opentelemetry-proto repo. We only consume `ResourceSpans` (for spans)
 * and `ResourceLogs` (for logs). The full message types are large and
 * include backwards-compat fields we never need; this walker reads the
 * fields we care about and ignores the rest.
 *
 * Using `@opentelemetry/otlp-transformer` would pull in the full proto
 * dependency tree (~hundreds of KB) for what amounts to a 100-line walker.
 */

import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, EntityType, ExportedLog, LogLevel } from '@mastra/core/observability';

/**
 * Convert an OTLP nanosecond timestamp (string or number) to a JS Date.
 *
 * OTLP timestamps are uint64 nanoseconds since Unix epoch. JSON
 * marshalers serialize them as either decimal strings (recommended for
 * uint64 to avoid JS number precision loss) or numbers.
 */
function nanosToDate(value: unknown): Date {
  if (typeof value === 'number') {
    return new Date(Math.round(value / 1e6));
  }
  if (typeof value === 'string') {
    // Avoid BigInt in hot path; just take the millisecond portion of the
    // decimal string. ns=19 chars max, ms=last 6 chars before the cut.
    if (value.length <= 6) return new Date(0);
    const ms = Number(value.slice(0, -6));
    return Number.isFinite(ms) ? new Date(ms) : new Date(0);
  }
  return new Date(0);
}

/**
 * OTLP attribute values are tagged unions:
 * `{ stringValue: "..." } | { intValue: 1 } | { boolValue: true } | ...`
 * Flatten to a plain `Record<string, unknown>` for our internal shape.
 */
function flattenAttributes(otlpAttrs: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(otlpAttrs)) return undefined;
  const out: Record<string, unknown> = {};
  for (const attr of otlpAttrs) {
    if (!attr || typeof attr !== 'object') continue;
    const key = (attr as { key?: unknown }).key;
    if (typeof key !== 'string') continue;
    const v = (attr as { value?: unknown }).value;
    if (!v || typeof v !== 'object') continue;
    const value = v as Record<string, unknown>;
    if ('stringValue' in value) out[key] = value.stringValue;
    else if ('intValue' in value) out[key] = Number(value.intValue);
    else if ('doubleValue' in value) out[key] = value.doubleValue;
    else if ('boolValue' in value) out[key] = value.boolValue;
    else if ('arrayValue' in value || 'kvlistValue' in value) {
      // Nested values are uncommon for our use case; preserve raw shape.
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Decoded shape of one span pulled out of an OTLP/JSON ResourceSpans
 * payload. Just enough fields to construct an ExportedSpan and forward
 * it through the bus.
 */
export interface DecodedOtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  attributes?: Record<string, unknown>;
  /** OTLP status code: 0 unset, 1 ok, 2 error */
  statusCode?: number;
  statusMessage?: string;
}

export interface DecodedOtlpLog {
  traceId: string;
  spanId?: string;
  timestamp: Date;
  /** OTLP severityText: "INFO", "WARN", etc. */
  severityText?: string;
  /** OTLP severityNumber: 1-24 */
  severityNumber?: number;
  body?: unknown;
  attributes?: Record<string, unknown>;
}

/**
 * Walk an OTLP/JSON ResourceSpans payload and return a flat list of
 * decoded spans. Returns an empty array (and never throws) if the
 * payload is malformed.
 */
export function decodeResourceSpans(payload: unknown): DecodedOtlpSpan[] {
  const out: DecodedOtlpSpan[] = [];
  const resourceSpans = (payload as { resourceSpans?: unknown[] } | undefined)?.resourceSpans;
  if (!Array.isArray(resourceSpans)) return out;

  for (const rs of resourceSpans) {
    const scopeSpans = (rs as { scopeSpans?: unknown[] } | undefined)?.scopeSpans;
    if (!Array.isArray(scopeSpans)) continue;
    for (const ss of scopeSpans) {
      const spans = (ss as { spans?: unknown[] } | undefined)?.spans;
      if (!Array.isArray(spans)) continue;
      for (const span of spans) {
        if (!span || typeof span !== 'object') continue;
        const s = span as Record<string, unknown>;
        const traceId = typeof s.traceId === 'string' ? s.traceId : undefined;
        const spanId = typeof s.spanId === 'string' ? s.spanId : undefined;
        const name = typeof s.name === 'string' ? s.name : undefined;
        if (!traceId || !spanId || !name) continue;
        const decoded: DecodedOtlpSpan = {
          traceId,
          spanId,
          parentSpanId: typeof s.parentSpanId === 'string' && s.parentSpanId ? s.parentSpanId : undefined,
          name,
          startTime: nanosToDate(s.startTimeUnixNano),
          endTime: s.endTimeUnixNano !== undefined ? nanosToDate(s.endTimeUnixNano) : undefined,
          attributes: flattenAttributes(s.attributes),
        };
        const status = s.status as Record<string, unknown> | undefined;
        if (status && typeof status === 'object') {
          if (typeof status.code === 'number') decoded.statusCode = status.code;
          if (typeof status.message === 'string') decoded.statusMessage = status.message;
        }
        out.push(decoded);
      }
    }
  }
  return out;
}

export function decodeResourceLogs(payload: unknown): DecodedOtlpLog[] {
  const out: DecodedOtlpLog[] = [];
  const resourceLogs = (payload as { resourceLogs?: unknown[] } | undefined)?.resourceLogs;
  if (!Array.isArray(resourceLogs)) return out;

  for (const rl of resourceLogs) {
    const scopeLogs = (rl as { scopeLogs?: unknown[] } | undefined)?.scopeLogs;
    if (!Array.isArray(scopeLogs)) continue;
    for (const sl of scopeLogs) {
      const logRecords = (sl as { logRecords?: unknown[] } | undefined)?.logRecords;
      if (!Array.isArray(logRecords)) continue;
      for (const record of logRecords) {
        if (!record || typeof record !== 'object') continue;
        const r = record as Record<string, unknown>;
        const traceId = typeof r.traceId === 'string' ? r.traceId : undefined;
        if (!traceId) continue;
        // OTLP log body is a tagged union like attributes; we accept the
        // common stringValue case and otherwise pass through.
        let body: unknown = r.body;
        if (body && typeof body === 'object' && 'stringValue' in (body as Record<string, unknown>)) {
          body = (body as Record<string, unknown>).stringValue;
        }
        out.push({
          traceId,
          spanId: typeof r.spanId === 'string' && r.spanId ? r.spanId : undefined,
          timestamp: r.timeUnixNano !== undefined ? nanosToDate(r.timeUnixNano) : nanosToDate(r.observedTimeUnixNano),
          severityText: typeof r.severityText === 'string' ? r.severityText : undefined,
          severityNumber: typeof r.severityNumber === 'number' ? r.severityNumber : undefined,
          body,
          attributes: flattenAttributes(r.attributes),
        });
      }
    }
  }
  return out;
}

/**
 * Translate an OTLP severity (text or number) to a Mastra LogLevel.
 *
 * OTEL severity numbers per spec:
 *   1-4 trace, 5-8 debug, 9-12 info, 13-16 warn, 17-20 error, 21-24 fatal.
 */
export function otlpSeverityToLogLevel(text: string | undefined, num: number | undefined): LogLevel {
  if (text) {
    const lc = text.toLowerCase();
    if (lc.startsWith('trace') || lc.startsWith('debug')) return 'debug';
    if (lc.startsWith('info')) return 'info';
    if (lc.startsWith('warn')) return 'warn';
    if (lc.startsWith('error')) return 'error';
    if (lc.startsWith('fatal')) return 'fatal';
  }
  if (typeof num === 'number') {
    if (num <= 8) return 'debug';
    if (num <= 12) return 'info';
    if (num <= 16) return 'warn';
    if (num <= 20) return 'error';
    return 'fatal';
  }
  return 'info';
}

/**
 * Convert a decoded OTLP span into the Mastra ExportedSpan shape so it
 * can be emitted via the observability bus.
 *
 * All ingested spans use SpanType.GENERIC because we don't know what
 * the user instrumented inside their client tool. The original span
 * name and attributes are preserved.
 */
export function buildExportedSpan(
  decoded: DecodedOtlpSpan,
  options: { entityType?: EntityType; entityName?: string; isInternal?: boolean } = {},
): AnyExportedSpan {
  const errorInfo =
    decoded.statusCode === 2
      ? {
          message: decoded.statusMessage ?? 'Client tool span reported error status',
          // SpanErrorInfo allows extra fields; keep the minimum.
        }
      : undefined;
  return {
    id: decoded.spanId,
    traceId: decoded.traceId,
    name: decoded.name,
    type: SpanType.GENERIC,
    parentSpanId: decoded.parentSpanId,
    isRootSpan: !decoded.parentSpanId,
    startTime: decoded.startTime,
    endTime: decoded.endTime,
    attributes: decoded.attributes,
    entityType: options.entityType,
    entityName: options.entityName,
    isEvent: false,
    ...(errorInfo ? { errorInfo: errorInfo as any } : {}),
  } as AnyExportedSpan;
}

export function buildExportedLog(decoded: DecodedOtlpLog): ExportedLog {
  return {
    timestamp: decoded.timestamp,
    traceId: decoded.traceId,
    spanId: decoded.spanId,
    level: otlpSeverityToLogLevel(decoded.severityText, decoded.severityNumber),
    message: typeof decoded.body === 'string' ? decoded.body : decoded.body !== undefined ? String(decoded.body) : '',
    data: decoded.attributes,
  };
}
