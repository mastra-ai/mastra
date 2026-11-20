import { createHmac, randomBytes } from 'node:crypto';
import { MastraStorageExporter, Observability } from '@mastra/observability';
import { SPAN_OUTCOMES, SPAN_STOP_REASONS, SpanType, TokenMetrics, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, CostContext, MetricEvent, TracingEvent } from '@mastra/core/observability';

export const operations = [
  'authorization',
  'preflight',
  'history-retrieval',
  'policy',
  'review-proposal',
  'review-decision',
  'review-publication',
  'knowledge-search',
  'knowledge-read',
  'knowledge-list',
  'missing-evidence',
  'resolution-reuse',
] as const;
export type Operation = (typeof operations)[number];
export const statuses = [
  'success',
  'denied',
  'error',
  'ready',
  'empty',
  'no-relevant-records',
  'partial',
  'unavailable',
  'missing',
  'suspended',
  'resumed',
  'published',
  'rejected',
  'duplicate',
  'contradiction',
  'insufficient-evidence',
] as const;
export type Status = (typeof statuses)[number];
const metricNames = new Set<string>([
  ...Object.values(TokenMetrics),
  'mastra_agent_duration_ms',
  'mastra_model_duration_ms',
  'mastra_processor_duration_ms',
  'mastra_tool_duration_ms',
  'mastra_workflow_duration_ms',
  'support_operation_count',
  'support_operation_duration_ms',
  'support_result_count',
]);
const numbers = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function numericFields(value: unknown, fields: string[]) {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(fields.filter(key => numbers(input[key])).map(key => [key, input[key]]));
}
function safeUsage(value: unknown) {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    ...numericFields(input, ['inputTokens', 'outputTokens']),
    inputDetails: numericFields(input.inputDetails, [
      'text',
      'cacheRead',
      'cacheWrite',
      'cacheWrite5m',
      'cacheWrite1h',
      'audio',
      'image',
    ]),
    outputDetails: numericFields(input.outputDetails, ['text', 'reasoning', 'audio', 'image']),
  };
}
function safeCost(value: CostContext | undefined): CostContext | undefined {
  if (!value) return;
  return {
    ...(value.provider === 'openai' || value.provider === 'openai.chat' ? { provider: value.provider } : {}),
    ...(value.model === 'gpt-4o-mini' || value.model === 'openai/gpt-4o-mini' ? { model: value.model } : {}),
    ...(numbers(value.estimatedCost) ? { estimatedCost: value.estimatedCost } : {}),
    ...(value.costUnit === 'USD' || value.costUnit === 'usd' ? { costUnit: value.costUnit } : {}),
  };
}
function toolOperation(span: AnyExportedSpan): Operation | undefined {
  if (span.type !== SpanType.TOOL_CALL) return;
  for (const [name, operation] of [
    ['knowledge_search', 'knowledge-search'],
    ['knowledge_read', 'knowledge-read'],
    ['knowledge_list', 'knowledge-list'],
  ] as const) {
    if (
      span.entityId === name ||
      span.name === name ||
      span.name === `tool: '${name}'` ||
      span.name === `tool call: '${name}'`
    )
      return operation;
  }
}

/** The only persistence exporter. Project fresh records so future framework fields cannot leak payloads. */
export class PayloadFreeStorageExporter extends MastraStorageExporter {
  private readonly correlationKey = randomBytes(32);
  private opaque(value: string | undefined) {
    return value ? createHmac('sha256', this.correlationKey).update(value).digest('hex').slice(0, 32) : undefined;
  }
  override async _exportTracingEvent(event: TracingEvent) {
    const span = event.exportedSpan;
    const type = Object.values(SpanType).includes(span.type) ? span.type : SpanType.GENERIC;
    const attributes = (span.attributes ?? {}) as Record<string, unknown>;
    const operation = toolOperation(span);
    const output = span.output && typeof span.output === 'object' ? (span.output as Record<string, unknown>) : {};
    const resultCount =
      operation === 'knowledge-search' && Array.isArray(output.results)
        ? output.results.length
        : operation === 'knowledge-read' && output.page
          ? 1
          : operation === 'knowledge-list' && Array.isArray(output.entries)
            ? output.entries.length
            : undefined;
    const outcome = SPAN_OUTCOMES.includes(span.outcome as (typeof SPAN_OUTCOMES)[number])
      ? span.outcome
      : span.endTime
        ? span.errorInfo
          ? 'error'
          : 'unknown'
        : undefined;
    const safe: AnyExportedSpan = {
      id: this.opaque(span.id)!,
      traceId: this.opaque(span.traceId)!,
      parentSpanId: this.opaque(span.parentSpanId),
      resumedFromSpanId: this.opaque(span.resumedFromSpanId),
      name: operation ?? type,
      type,
      startTime: span.startTime,
      endTime: span.endTime,
      isEvent: span.isEvent,
      isRootSpan: span.isRootSpan,
      serviceName: 'knowledge-support',
      outcome,
      ...numericFields(span, ['timeToFirstTokenMs', 'errorCount']),
      ...(span.stopReason && Object.hasOwn(SPAN_STOP_REASONS, span.stopReason) ? { stopReason: span.stopReason } : {}),
      ...(span.errorInfo ? { errorInfo: { message: 'Operation failed' } } : {}),
      attributes: {
        ...(resultCount === undefined ? {} : { resultCount }),
        ...numericFields(attributes, ['messageCount', 'stepCount', 'inputTokens', 'outputTokens']),
        ...(typeof attributes.success === 'boolean' ? { success: attributes.success } : {}),
        ...(attributes.usage ? { usage: safeUsage(attributes.usage) } : {}),
        ...(attributes.internalUsage ? { internalUsage: safeUsage(attributes.internalUsage) } : {}),
      },
    };
    if (event.type === 'span_ended' && operation) {
      const metrics = observability.getDefaultInstance()?.getMetricsContext?.();
      const status =
        span.errorInfo || output.error || attributes.success === false || outcome === 'error' ? 'error' : 'success';
      metrics?.emit('support_operation_count', 1, { operation, status });
      if (resultCount !== undefined) metrics?.emit('support_result_count', resultCount, { operation, status });
      if (resultCount === 0)
        metrics?.emit('support_operation_count', 1, { operation: 'missing-evidence', status: 'empty' });
      const page = output.page as { body?: unknown } | undefined;
      if (
        operation === 'knowledge-read' &&
        typeof page?.body === 'string' &&
        /^<!-- knowledge-review:/u.test(page.body)
      )
        metrics?.emit('support_operation_count', 1, { operation: 'resolution-reuse', status: 'ready' });
      if (span.endTime)
        metrics?.emit('support_operation_duration_ms', Math.max(0, span.endTime.getTime() - span.startTime.getTime()), {
          operation,
          status,
        });
    }
    await super._exportTracingEvent({ type: event.type, exportedSpan: safe });
  }
  override async onMetricEvent(event: MetricEvent) {
    const metric = event.metric;
    if (!metricNames.has(metric.name) || !numbers(metric.value)) return;
    const labels: Record<string, string> = {};
    if (operations.includes(metric.labels.operation as Operation)) labels.operation = metric.labels.operation!;
    if (metric.labels.status === 'ok') labels.status = 'success';
    if (statuses.includes(metric.labels.status as Status)) labels.status = metric.labels.status!;
    // LibSQL supports native spans but not metric rows. Preserve native metric samples as point events.
    const span: AnyExportedSpan = {
      id: this.opaque(metric.metricId)!,
      traceId: this.opaque(metric.traceId ?? metric.metricId)!,
      parentSpanId: this.opaque(metric.spanId),
      name: metric.name,
      type: SpanType.GENERIC,
      startTime: metric.timestamp,
      endTime: metric.timestamp,
      isEvent: true,
      isRootSpan: !metric.spanId,
      serviceName: 'knowledge-support',
      outcome: 'success',
      metadata: {
        value: metric.value,
        labels,
        ...(metric.usageId ? { usageId: this.opaque(metric.usageId) } : {}),
        ...(metric.costContext ? { costContext: safeCost(metric.costContext) } : {}),
      },
    };
    await super._exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span });
    await super._exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span });
  }

  override async onLogEvent() {}
  override async onScoreEvent() {}
  override async onFeedbackEvent() {}
  override async onFeedbackReplacementEvent() {}
  override async onFeedbackReviewStatusEvent() {}
}
export const telemetryExporter = new PayloadFreeStorageExporter({ maxBatchWaitMs: 200 });
export const observability = new Observability({
  sensitiveDataFilter: false,
  configs: {
    local: {
      serviceName: 'knowledge-support',
      exporters: [telemetryExporter],
      logging: { enabled: false },
      requestContextKeys: [],
    },
  },
});

/** Values are enums and nonnegative numbers; callers never supply private strings or identifiers. */
export function recordOperation(operation: Operation, status: Status, started = performance.now(), results?: number) {
  const metrics = observability.getDefaultInstance()?.getMetricsContext?.();
  metrics?.emit('support_operation_count', 1, { operation, status });
  metrics?.emit('support_operation_duration_ms', Math.max(0, performance.now() - started), { operation, status });
  if (results !== undefined && numbers(results)) metrics?.emit('support_result_count', results, { operation, status });
}
