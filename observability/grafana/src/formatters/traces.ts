/**
 * Traces formatter for Grafana Tempo.
 *
 * Converts Mastra ExportedSpan to OTLP/HTTP JSON format.
 * Tempo accepts traces via the OTLP/HTTP endpoint at /v1/traces.
 *
 * @see https://grafana.com/docs/tempo/latest/api_docs/pushing-spans-with-http/
 * @see https://opentelemetry.io/docs/specs/otlp/#otlphttp
 */

import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan, ModelGenerationAttributes } from '@mastra/core/observability';

/**
 * OTLP JSON types for trace export.
 * Subset of the full OTLP protobuf spec, using JSON encoding.
 */

interface OtlpExportTraceRequest {
  resourceSpans: OtlpResourceSpans[];
}

interface OtlpResourceSpans {
  resource: OtlpResource;
  scopeSpans: OtlpScopeSpans[];
}

interface OtlpResource {
  attributes: OtlpKeyValue[];
}

interface OtlpScopeSpans {
  scope: OtlpInstrumentationScope;
  spans: OtlpSpan[];
}

interface OtlpInstrumentationScope {
  name: string;
  version?: string;
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  status: OtlpStatus;
  events: OtlpEvent[];
}

interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAnyValue[] };
}

interface OtlpStatus {
  code: number;
  message?: string;
}

interface OtlpEvent {
  name: string;
  timeUnixNano: string;
  attributes: OtlpKeyValue[];
}

// OTLP status codes
const STATUS_UNSET = 0;
const STATUS_OK = 1;
const STATUS_ERROR = 2;

// OTLP span kinds
const SPAN_KIND_INTERNAL = 1;
const SPAN_KIND_CLIENT = 3;

/**
 * Convert a Date to nanoseconds as a string (OTLP uses string for uint64).
 */
function dateToNanoString(date: Date): string {
  return `${BigInt(date.getTime()) * 1_000_000n}`;
}

/**
 * Create an OTLP key-value pair.
 */
function kv(key: string, value: string | number | boolean | undefined): OtlpKeyValue | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return { key, value: { stringValue: value } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (Number.isInteger(value)) return { key, value: { intValue: String(value) } };
  return { key, value: { doubleValue: value as number } };
}

/**
 * Map Mastra SpanType to OTLP SpanKind.
 */
function getSpanKind(type: SpanType): number {
  switch (type) {
    case SpanType.MODEL_GENERATION:
    case SpanType.MCP_TOOL_CALL:
      return SPAN_KIND_CLIENT;
    default:
      return SPAN_KIND_INTERNAL;
  }
}

/**
 * Build OTLP attributes from a Mastra span.
 */
function buildAttributes(span: AnyExportedSpan): OtlpKeyValue[] {
  const attrs: (OtlpKeyValue | undefined)[] = [
    kv('mastra.span.type', span.type),
    kv('mastra.entity.type', span.entityType),
    kv('mastra.entity.id', span.entityId),
    kv('mastra.entity.name', span.entityName),
  ];

  // Add input/output as string attributes
  if (span.input !== undefined) {
    const inputStr = typeof span.input === 'string' ? span.input : JSON.stringify(span.input);
    attrs.push(kv(`mastra.${span.type}.input`, inputStr));
  }
  if (span.output !== undefined) {
    const outputStr = typeof span.output === 'string' ? span.output : JSON.stringify(span.output);
    attrs.push(kv(`mastra.${span.type}.output`, outputStr));
  }

  // Model generation attributes
  if (span.type === SpanType.MODEL_GENERATION && span.attributes) {
    const modelAttrs = span.attributes as ModelGenerationAttributes;
    attrs.push(kv('gen_ai.request.model', modelAttrs.model));
    attrs.push(kv('gen_ai.provider.name', modelAttrs.provider));
    attrs.push(kv('gen_ai.response.model', modelAttrs.responseModel));
    attrs.push(kv('gen_ai.response.finish_reasons', modelAttrs.finishReason));

    if (modelAttrs.usage) {
      attrs.push(kv('gen_ai.usage.input_tokens', modelAttrs.usage.inputTokens));
      attrs.push(kv('gen_ai.usage.output_tokens', modelAttrs.usage.outputTokens));
    }

    if (modelAttrs.parameters) {
      attrs.push(kv('gen_ai.request.temperature', modelAttrs.parameters.temperature));
      attrs.push(kv('gen_ai.request.max_tokens', modelAttrs.parameters.maxOutputTokens));
      attrs.push(kv('gen_ai.request.top_p', modelAttrs.parameters.topP));
    }
  }

  // Tags for root spans
  if (span.isRootSpan && span.tags?.length) {
    attrs.push(kv('mastra.tags', JSON.stringify(span.tags)));
  }

  // Metadata as custom attributes
  if (span.metadata) {
    for (const [k, v] of Object.entries(span.metadata)) {
      if (v === null || v === undefined) continue;
      const val = typeof v === 'object' ? JSON.stringify(v) : v;
      attrs.push(kv(`mastra.metadata.${k}`, val as string | number | boolean));
    }
  }

  // Error information
  if (span.errorInfo) {
    attrs.push(kv('error.type', span.errorInfo.id || 'Error'));
    attrs.push(kv('error.message', span.errorInfo.message));
  }

  return attrs.filter((a): a is OtlpKeyValue => a !== undefined);
}

/**
 * Build OTLP status and events from span error info.
 */
function buildStatusAndEvents(
  span: AnyExportedSpan,
): { status: OtlpStatus; events: OtlpEvent[] } {
  const events: OtlpEvent[] = [];

  if (span.errorInfo) {
    events.push({
      name: 'exception',
      timeUnixNano: dateToNanoString(span.endTime ?? span.startTime),
      attributes: [
        kv('exception.message', span.errorInfo.message),
        kv('exception.type', 'Error'),
        ...(span.errorInfo.details?.stack
          ? [kv('exception.stacktrace', span.errorInfo.details.stack as string)]
          : []),
      ].filter((a): a is OtlpKeyValue => a !== undefined),
    });

    return {
      status: { code: STATUS_ERROR, message: span.errorInfo.message },
      events,
    };
  }

  if (span.endTime) {
    return { status: { code: STATUS_OK }, events };
  }

  return { status: { code: STATUS_UNSET }, events };
}

/**
 * Convert a Mastra ExportedSpan to an OTLP JSON span.
 */
function convertSpanToOtlp(span: AnyExportedSpan): OtlpSpan {
  const { status, events } = buildStatusAndEvents(span);

  return {
    traceId: span.traceId,
    spanId: span.id,
    parentSpanId: span.parentSpanId,
    name: span.name,
    kind: getSpanKind(span.type),
    startTimeUnixNano: dateToNanoString(span.startTime),
    endTimeUnixNano: dateToNanoString(span.endTime ?? span.startTime),
    attributes: buildAttributes(span),
    status,
    events,
  };
}

/**
 * Format a batch of Mastra spans into an OTLP ExportTraceServiceRequest (JSON).
 *
 * @param spans - The spans to format
 * @param serviceName - The service name for the resource
 * @returns The OTLP JSON request body
 */
export function formatSpansForTempo(
  spans: AnyExportedSpan[],
  serviceName: string,
): OtlpExportTraceRequest {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: serviceName } },
            { key: 'telemetry.sdk.name', value: { stringValue: '@mastra/grafana' } },
            { key: 'telemetry.sdk.language', value: { stringValue: 'nodejs' } },
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: '@mastra/grafana',
            },
            spans: spans.map(convertSpanToOtlp),
          },
        ],
      },
    ],
  };
}
