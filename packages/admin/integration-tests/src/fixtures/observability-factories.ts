import { randomUUID } from 'node:crypto';
import type { Trace, Span, Log, Metric, Score } from '@mastra/admin';

/**
 * Create trace data for testing observability features.
 *
 * @param options Trace options (projectId and deploymentId are required)
 * @returns Complete trace data
 */
export function createTraceData(options: {
  projectId: string;
  deploymentId: string;
  name?: string;
  status?: 'ok' | 'error' | 'unset';
}): Trace {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + Math.random() * 5000);

  return {
    traceId: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? `test-trace-${Date.now()}`,
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    status: options.status ?? 'ok',
    metadata: {},
  };
}

/**
 * Create span data for testing observability features.
 *
 * @param options Span options
 * @returns Complete span data
 */
export function createSpanData(options: {
  traceId: string;
  projectId: string;
  deploymentId: string;
  parentSpanId?: string | null;
  name?: string;
  kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
}): Span {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + Math.random() * 1000);

  return {
    spanId: randomUUID(),
    traceId: options.traceId,
    parentSpanId: options.parentSpanId ?? null,
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? `test-span-${Date.now()}`,
    kind: options.kind ?? 'internal',
    startTime,
    endTime,
    durationMs: endTime.getTime() - startTime.getTime(),
    status: 'ok',
    attributes: {},
    events: [],
  };
}

/**
 * Create log data for testing observability features.
 *
 * @param options Log options
 * @returns Complete log data
 */
export function createLogData(options: {
  projectId: string;
  deploymentId: string;
  traceId?: string | null;
  spanId?: string | null;
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
}): Log {
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    traceId: options.traceId ?? null,
    spanId: options.spanId ?? null,
    level: options.level ?? 'info',
    message: options.message ?? `Test log message at ${Date.now()}`,
    timestamp: new Date(),
    attributes: {},
  };
}

/**
 * Create metric data for testing observability features.
 *
 * @param options Metric options
 * @returns Complete metric data
 */
export function createMetricData(options: {
  projectId: string;
  deploymentId: string;
  name?: string;
  type?: 'counter' | 'gauge' | 'histogram';
  value?: number;
  unit?: string | null;
}): Metric {
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    name: options.name ?? 'test_metric',
    type: options.type ?? 'gauge',
    value: options.value ?? Math.random() * 100,
    unit: options.unit ?? null,
    labels: {},
    timestamp: new Date(),
  };
}

/**
 * Create score data for testing observability features.
 *
 * @param options Score options
 * @returns Complete score data
 */
export function createScoreData(options: {
  projectId: string;
  deploymentId: string;
  traceId?: string | null;
  name?: string;
  value?: number;
  normalizedValue?: number | null;
  comment?: string | null;
}): Score {
  const value = options.value ?? Math.random();
  return {
    id: randomUUID(),
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    traceId: options.traceId ?? null,
    name: options.name ?? 'test_score',
    value,
    normalizedValue: options.normalizedValue ?? value, // Assume value is already normalized 0-1
    comment: options.comment ?? null,
    timestamp: new Date(),
    metadata: {},
  };
}

/**
 * Create a complete trace with spans for testing.
 *
 * @param options Trace options
 * @param spanCount Number of spans to create
 * @returns Trace with associated spans
 */
export function createTraceWithSpans(
  options: {
    projectId: string;
    deploymentId: string;
    name?: string;
  },
  spanCount: number = 3,
): { trace: Trace; spans: Span[] } {
  const trace = createTraceData(options);
  const spans: Span[] = [];

  // Create root span
  const rootSpan = createSpanData({
    traceId: trace.traceId,
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    parentSpanId: null,
    name: 'root-span',
    kind: 'server',
  });
  spans.push(rootSpan);

  // Create child spans
  for (let i = 1; i < spanCount; i++) {
    const childSpan = createSpanData({
      traceId: trace.traceId,
      projectId: options.projectId,
      deploymentId: options.deploymentId,
      parentSpanId: rootSpan.spanId,
      name: `child-span-${i}`,
      kind: 'internal',
    });
    spans.push(childSpan);
  }

  return { trace, spans };
}

/**
 * Create bulk traces for testing.
 *
 * @param count Number of traces to create
 * @param options Base options for all traces
 * @returns Array of traces
 */
export function createBulkTraces(
  count: number,
  options: {
    projectId: string;
    deploymentId: string;
  },
): Trace[] {
  return Array.from({ length: count }, (_, i) =>
    createTraceData({
      ...options,
      name: `bulk-trace-${i}`,
    }),
  );
}

/**
 * Create bulk logs for testing.
 *
 * @param count Number of logs to create
 * @param options Base options for all logs
 * @returns Array of logs
 */
export function createBulkLogs(
  count: number,
  options: {
    projectId: string;
    deploymentId: string;
    traceId?: string;
  },
): Log[] {
  const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

  return Array.from({ length: count }, (_, i) =>
    createLogData({
      ...options,
      level: levels[i % levels.length],
      message: `Bulk log message ${i}`,
    }),
  );
}

/**
 * Create bulk metrics for testing.
 *
 * @param count Number of metrics to create
 * @param options Base options for all metrics
 * @returns Array of metrics
 */
export function createBulkMetrics(
  count: number,
  options: {
    projectId: string;
    deploymentId: string;
    name?: string;
  },
): Metric[] {
  return Array.from({ length: count }, (_, i) =>
    createMetricData({
      ...options,
      name: options.name ?? `bulk_metric_${i}`,
      value: Math.random() * 100,
    }),
  );
}
