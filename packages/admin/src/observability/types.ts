/**
 * Trace represents a distributed trace spanning multiple services.
 */
export interface Trace {
  traceId: string;
  projectId: string;
  deploymentId: string;
  name: string;
  status: 'ok' | 'error' | 'unset';
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}

/**
 * Span represents a single operation within a trace.
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  projectId: string;
  deploymentId: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  status: 'ok' | 'error' | 'unset';
  startTime: Date;
  endTime: Date | null;
  durationMs: number | null;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

/**
 * Event within a span.
 */
export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes: Record<string, unknown>;
}

/**
 * Log entry from a running server.
 */
export interface Log {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  spanId: string | null;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  attributes: Record<string, unknown>;
}

/**
 * Metric data point.
 */
export interface Metric {
  id: string;
  projectId: string;
  deploymentId: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  unit: string | null;
  timestamp: Date;
  labels: Record<string, string>;
}

/**
 * Score for evaluation tracking.
 */
export interface Score {
  id: string;
  projectId: string;
  deploymentId: string;
  traceId: string | null;
  name: string;
  value: number;
  normalizedValue: number | null; // 0-1 range
  comment: string | null;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * Union type for all observability events.
 */
export type ObservabilityEvent =
  | { type: 'trace'; data: Trace }
  | { type: 'span'; data: Span }
  | { type: 'log'; data: Log }
  | { type: 'metric'; data: Metric }
  | { type: 'score'; data: Score };
