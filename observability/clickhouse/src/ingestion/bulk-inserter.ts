/**
 * Bulk inserter for ClickHouse.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { TABLE_NAMES } from '../schema/tables.js';
import type { ObservabilityEvent, ObservabilityEventType, Trace, Span, Log, Metric, Score } from '../types.js';

/**
 * Transform a trace event to ClickHouse row format.
 */
function transformTrace(trace: Trace, recordedAt: string): Record<string, unknown> {
  return {
    trace_id: trace.traceId,
    project_id: trace.projectId,
    deployment_id: trace.deploymentId || '',
    name: trace.name,
    status: trace.status || 'unset',
    start_time: trace.startTime,
    end_time: trace.endTime || null,
    duration_ms: trace.durationMs || null,
    input: '', // Not in base Trace type
    output: '', // Not in base Trace type
    metadata: trace.metadata ? JSON.stringify(trace.metadata) : '{}',
    recorded_at: recordedAt,
  };
}

/**
 * Transform a span event to ClickHouse row format.
 */
function transformSpan(span: Span, recordedAt: string): Record<string, unknown> {
  return {
    span_id: span.spanId,
    trace_id: span.traceId,
    parent_span_id: span.parentSpanId || null,
    project_id: span.projectId,
    deployment_id: span.deploymentId || '',
    name: span.name,
    kind: span.kind || 'internal',
    status: span.status || 'unset',
    start_time: span.startTime,
    end_time: span.endTime || null,
    duration_ms: span.durationMs || null,
    attributes: span.attributes ? JSON.stringify(span.attributes) : '{}',
    events: span.events ? JSON.stringify(span.events) : '[]',
    recorded_at: recordedAt,
  };
}

/**
 * Transform a log event to ClickHouse row format.
 */
function transformLog(log: Log, recordedAt: string): Record<string, unknown> {
  return {
    id: log.id,
    project_id: log.projectId,
    deployment_id: log.deploymentId || '',
    trace_id: log.traceId || null,
    span_id: log.spanId || null,
    level: log.level,
    message: log.message,
    timestamp: log.timestamp,
    attributes: log.attributes ? JSON.stringify(log.attributes) : '{}',
    recorded_at: recordedAt,
  };
}

/**
 * Transform a metric event to ClickHouse row format.
 */
function transformMetric(metric: Metric, recordedAt: string): Record<string, unknown> {
  return {
    id: metric.id,
    project_id: metric.projectId,
    deployment_id: metric.deploymentId || '',
    name: metric.name,
    type: metric.type || 'gauge',
    value: metric.value,
    unit: metric.unit || null,
    timestamp: metric.timestamp,
    labels: metric.labels ? JSON.stringify(metric.labels) : '{}',
    recorded_at: recordedAt,
  };
}

/**
 * Transform a score event to ClickHouse row format.
 */
function transformScore(score: Score, recordedAt: string): Record<string, unknown> {
  return {
    id: score.id,
    project_id: score.projectId,
    deployment_id: score.deploymentId || '',
    trace_id: score.traceId || null,
    name: score.name,
    value: score.value,
    normalized_value: score.normalizedValue || null,
    comment: score.comment || null,
    timestamp: score.timestamp,
    metadata: score.metadata ? JSON.stringify(score.metadata) : '{}',
    recorded_at: recordedAt,
  };
}

/**
 * Transform an event to ClickHouse row format.
 */
function transformEvent(event: ObservabilityEvent): Record<string, unknown> {
  const recordedAt = new Date().toISOString();

  switch (event.type) {
    case 'trace':
      return transformTrace(event.data, recordedAt);
    case 'span':
      return transformSpan(event.data, recordedAt);
    case 'log':
      return transformLog(event.data, recordedAt);
    case 'metric':
      return transformMetric(event.data, recordedAt);
    case 'score':
      return transformScore(event.data, recordedAt);
    default:
      throw new Error(`Unknown event type: ${(event as { type: string }).type}`);
  }
}

/**
 * Get the table name for an event type.
 */
function getTableForType(type: ObservabilityEventType): string {
  switch (type) {
    case 'trace':
      return TABLE_NAMES.TRACES;
    case 'span':
      return TABLE_NAMES.SPANS;
    case 'log':
      return TABLE_NAMES.LOGS;
    case 'metric':
      return TABLE_NAMES.METRICS;
    case 'score':
      return TABLE_NAMES.SCORES;
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Bulk insert events into ClickHouse.
 * Groups events by type and inserts into appropriate tables.
 */
export async function bulkInsert(
  client: ClickHouseClient,
  events: Array<{ type: ObservabilityEventType; data: ObservabilityEvent }>,
): Promise<{ insertedByType: Record<string, number> }> {
  // Group events by type
  const eventsByType = new Map<ObservabilityEventType, ObservabilityEvent[]>();

  for (const event of events) {
    const existing = eventsByType.get(event.type) || [];
    existing.push(event.data);
    eventsByType.set(event.type, existing);
  }

  const insertedByType: Record<string, number> = {};

  // Insert each type into its table
  for (const [type, typeEvents] of eventsByType) {
    const tableName = getTableForType(type);
    const rows = typeEvents.map(transformEvent);

    await client.insert({
      table: tableName,
      values: rows,
      format: 'JSONEachRow',
      clickhouse_settings: {
        date_time_input_format: 'best_effort',
      },
    });

    insertedByType[type] = typeEvents.length;
  }

  return { insertedByType };
}
