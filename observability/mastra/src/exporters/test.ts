/**
 * Test Exporter for Observability
 *
 * A full-featured exporter primarily designed for testing purposes that provides:
 * - In-memory event collection for ALL signals (Traces, Metrics, Logs, Scores, Feedback)
 * - File output support
 * - Span lifecycle tracking and validation
 * - Query methods for filtering spans by type, trace ID, span ID, etc.
 * - Query methods for filtering logs, metrics, scores, and feedback
 * - Statistics and analytics on all collected signals
 * - Internal metrics collection with summary on flush()
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lazily compute the snapshots directory to avoid CloudFlare Workers compatibility issues.
 * In non-Node.js environments (like CloudFlare Workers), import.meta.url may be undefined
 * at module load time, causing fileURLToPath to throw.
 */
let _snapshotsDir: string | undefined;
function getSnapshotsDir(): string {
  if (!_snapshotsDir) {
    if (typeof import.meta.url !== 'string') {
      throw new Error(
        'Snapshot functionality requires a Node.js environment. ' + 'import.meta.url is not available in this runtime.',
      );
    }
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    _snapshotsDir = join(__dirname, '..', '__snapshots__');
  }
  return _snapshotsDir;
}

import type {
  TracingEvent,
  TracingEventType,
  AnyExportedSpan,
  ExportedSpan,
  SpanType,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ExportedLog,
  ExportedMetric,
  ExportedScore,
  ExportedFeedback,
  LogLevel,
  MetricType,
} from '@mastra/core/observability';
import { TracingEventType as EventType } from '@mastra/core/observability';

import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

/**
 * Span state tracking for lifecycle validation
 */
interface SpanState {
  /** Whether SPAN_STARTED was received */
  hasStart: boolean;
  /** Whether SPAN_ENDED was received */
  hasEnd: boolean;
  /** Whether SPAN_UPDATED was received */
  hasUpdate: boolean;
  /** All events for this span in order */
  events: TracingEvent[];
  /** Whether this is an event span (zero duration) */
  isEventSpan?: boolean;
}

/**
 * Statistics about all collected signals
 */
export interface TestExporterStats {
  /** Total number of tracing events collected */
  totalTracingEvents: number;
  /** Number of unique spans */
  totalSpans: number;
  /** Number of unique traces */
  totalTraces: number;
  /** Number of completed spans */
  completedSpans: number;
  /** Number of incomplete spans (started but not ended) */
  incompleteSpans: number;
  /** Breakdown by tracing event type */
  byEventType: {
    started: number;
    updated: number;
    ended: number;
  };
  /** Breakdown by span type */
  bySpanType: Record<string, number>;
  /** Total number of log events collected */
  totalLogs: number;
  /** Breakdown of logs by level */
  logsByLevel: Record<string, number>;
  /** Total number of metric events collected */
  totalMetrics: number;
  /** Breakdown of metrics by type */
  metricsByType: Record<string, number>;
  /** Breakdown of metrics by name */
  metricsByName: Record<string, number>;
  /** Total number of score events collected */
  totalScores: number;
  /** Breakdown of scores by scorer name */
  scoresByScorer: Record<string, number>;
  /** Total number of feedback events collected */
  totalFeedback: number;
  /** Breakdown of feedback by type */
  feedbackByType: Record<string, number>;
  /** @deprecated Use totalTracingEvents instead */
  totalEvents: number;
}

/**
 * Internal metrics collected by the TestExporter while running.
 * Dumped as a summary on flush().
 */
export interface TestExporterInternalMetrics {
  /** Timestamp when the exporter was created */
  startedAt: Date;
  /** Timestamp of the last event received */
  lastEventAt: Date | null;
  /** Total events received across all signal types */
  totalEventsReceived: number;
  /** Breakdown by signal type */
  bySignal: {
    tracing: number;
    log: number;
    metric: number;
    score: number;
    feedback: number;
  };
  /** Number of flush() calls */
  flushCount: number;
  /** Total bytes of JSON output produced (estimated from toJSON) */
  estimatedJsonBytes: number;
}

/**
 * Span node in a tree structure with nested children
 */
export interface SpanTreeNode {
  /** The span data */
  span: AnyExportedSpan;
  /** Child spans nested under this span */
  children: SpanTreeNode[];
}

/**
 * Normalized span data for snapshot testing.
 * Dynamic fields (IDs, timestamps) are replaced with stable values.
 */
export interface NormalizedSpan {
  /** Stable ID like <span-1>, <span-2> */
  id: string;
  /** Normalized trace ID like <trace-1>, <trace-2> */
  traceId: string;
  /** Normalized parent ID, or undefined for root */
  parentId?: string;
  /** Span name */
  name: string;
  /** Span type */
  type: string;
  /** Entity type */
  entityType?: string;
  /** Entity ID */
  entityId?: string;
  /** Whether the span completed (had an endTime) */
  completed: boolean;
  /** Span attributes */
  attributes?: Record<string, unknown>;
  /** Span metadata */
  metadata?: Record<string, unknown>;
  /** Input data */
  input?: unknown;
  /** Output data */
  output?: unknown;
  /** Error info if span failed */
  errorInfo?: unknown;
  /** Is an event span */
  isEvent: boolean;
  /** Is root span */
  isRootSpan: boolean;
  /** Tags */
  tags?: string[];
}

/**
 * Normalized tree node for snapshot testing
 */
export interface NormalizedTreeNode {
  /** Normalized span data */
  span: NormalizedSpan;
  /** Child nodes (omitted if empty) */
  children?: NormalizedTreeNode[];
}

/**
 * Incomplete span information for debugging
 */
export interface IncompleteSpanInfo {
  spanId: string;
  span: AnyExportedSpan | undefined;
  state: {
    hasStart: boolean;
    hasUpdate: boolean;
    hasEnd: boolean;
  };
}

/**
 * Configuration for TestExporter
 */
export interface TestExporterConfig extends BaseExporterConfig {
  /**
   * Whether to validate span lifecycles in real-time.
   * When true, will log warnings for lifecycle violations.
   * @default true
   */
  validateLifecycle?: boolean;
  /**
   * Whether to store verbose logs for debugging.
   * @default true
   */
  storeLogs?: boolean;
  /**
   * Indentation for JSON output (number of spaces, or undefined for compact).
   * @default 2
   */
  jsonIndent?: number;
  /**
   * Whether to log a summary of internal metrics on flush().
   * @default true
   */
  logMetricsOnFlush?: boolean;
}

/**
 * Test Exporter for observability testing and debugging.
 *
 * Provides comprehensive in-memory event collection, querying, and JSON output
 * capabilities designed primarily for testing purposes but useful for debugging as well.
 *
 * @example
 * ```typescript
 * const exporter = new TestExporter();
 *
 * // Use with Mastra
 * const mastra = new Mastra({
 *   observability: {
 *     configs: {
 *       test: {
 *         serviceName: 'test',
 *         exporters: [exporter],
 *       },
 *     },
 *   },
 * });
 *
 * // Run some operations...
 *
 * // Query spans
 * const agentSpans = exporter.getSpansByType('agent_run');
 * const traceSpans = exporter.getByTraceId('abc123');
 *
 * // Get statistics
 * const stats = exporter.getStatistics();
 *
 * // Export to JSON
 * await exporter.writeToFile('./traces.json');
 * const jsonString = exporter.toJSON();
 * ```
 */
export class TestExporter extends BaseExporter {
  name = 'test-exporter';

  /** All collected tracing events */
  #tracingEvents: TracingEvent[] = [];

  /** Per-span state tracking */
  #spanStates = new Map<string, SpanState>();

  /** All collected log events */
  #logEvents: LogEvent[] = [];

  /** All collected metric events */
  #metricEvents: MetricEvent[] = [];

  /** All collected score events */
  #scoreEvents: ScoreEvent[] = [];

  /** All collected feedback events */
  #feedbackEvents: FeedbackEvent[] = [];

  /** Debug logs for the exporter itself */
  #debugLogs: string[] = [];

  /** Configuration */
  readonly #config: TestExporterConfig;

  /** Internal metrics tracking */
  #internalMetrics: {
    startedAt: Date;
    lastEventAt: Date | null;
    totalEventsReceived: number;
    bySignal: { tracing: number; log: number; metric: number; score: number; feedback: number };
    flushCount: number;
  };

  constructor(config: TestExporterConfig = {}) {
    super(config);
    this.#config = {
      validateLifecycle: true,
      storeLogs: true,
      jsonIndent: 2,
      logMetricsOnFlush: true,
      ...config,
    };
    this.#internalMetrics = {
      startedAt: new Date(),
      lastEventAt: null,
      totalEventsReceived: 0,
      bySignal: { tracing: 0, log: 0, metric: 0, score: 0, feedback: 0 },
      flushCount: 0,
    };
  }

  /**
   * Process incoming tracing events with lifecycle tracking
   */
  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    const span = event.exportedSpan;
    const spanId = span.id;

    // Track internal metrics
    this.#trackEvent('tracing');

    // Generate log message
    const logMessage = `[TestExporter] ${event.type}: ${span.type} "${span.name}" (entity: ${span.entityName ?? span.entityId ?? 'unknown'}, trace: ${span.traceId.slice(-8)}, span: ${spanId.slice(-8)})`;

    if (this.#config.storeLogs) {
      this.#debugLogs.push(logMessage);
    }

    // Get or create span state
    const state = this.#spanStates.get(spanId) || {
      hasStart: false,
      hasEnd: false,
      hasUpdate: false,
      events: [],
    };

    // Lifecycle validation
    if (this.#config.validateLifecycle) {
      this.#validateLifecycle(event, state, spanId);
    }

    // Update state based on event type
    if (event.type === EventType.SPAN_STARTED) {
      state.hasStart = true;
    } else if (event.type === EventType.SPAN_ENDED) {
      state.hasEnd = true;
      if (span.isEvent) {
        state.isEventSpan = true;
      }
    } else if (event.type === EventType.SPAN_UPDATED) {
      state.hasUpdate = true;
    }

    state.events.push(event);
    this.#spanStates.set(spanId, state);
    this.#tracingEvents.push(event);
  }

  // ============================================================================
  // Signal Handlers (Logs, Metrics, Scores, Feedback)
  // ============================================================================

  /**
   * Process incoming log events
   */
  async onLogEvent(event: LogEvent): Promise<void> {
    this.#trackEvent('log');

    if (this.#config.storeLogs) {
      const log = event.log;
      const logMessage = `[TestExporter] log.${log.level}: "${log.message}"${log.traceId ? ` (trace: ${log.traceId.slice(-8)})` : ''}`;
      this.#debugLogs.push(logMessage);
    }

    this.#logEvents.push(event);
  }

  /**
   * Process incoming metric events
   */
  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.#trackEvent('metric');

    if (this.#config.storeLogs) {
      const metric = event.metric;
      const labelsStr = Object.entries(metric.labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      const logMessage = `[TestExporter] metric.${metric.metricType}: ${metric.name}=${metric.value}${labelsStr ? ` {${labelsStr}}` : ''}`;
      this.#debugLogs.push(logMessage);
    }

    this.#metricEvents.push(event);
  }

  /**
   * Process incoming score events
   */
  async onScoreEvent(event: ScoreEvent): Promise<void> {
    this.#trackEvent('score');

    if (this.#config.storeLogs) {
      const score = event.score;
      const logMessage = `[TestExporter] score: ${score.scorerName}=${score.score} (trace: ${score.traceId.slice(-8)}${score.spanId ? `, span: ${score.spanId.slice(-8)}` : ''})`;
      this.#debugLogs.push(logMessage);
    }

    this.#scoreEvents.push(event);
  }

  /**
   * Process incoming feedback events
   */
  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    this.#trackEvent('feedback');

    if (this.#config.storeLogs) {
      const fb = event.feedback;
      const logMessage = `[TestExporter] feedback: ${fb.feedbackType} from ${fb.source}=${fb.value} (trace: ${fb.traceId.slice(-8)}${fb.spanId ? `, span: ${fb.spanId.slice(-8)}` : ''})`;
      this.#debugLogs.push(logMessage);
    }

    this.#feedbackEvents.push(event);
  }

  /**
   * Track an event for internal metrics
   */
  #trackEvent(signal: 'tracing' | 'log' | 'metric' | 'score' | 'feedback'): void {
    this.#internalMetrics.lastEventAt = new Date();
    this.#internalMetrics.totalEventsReceived++;
    this.#internalMetrics.bySignal[signal]++;
  }

  /**
   * Validate span lifecycle rules
   */
  #validateLifecycle(event: TracingEvent, state: SpanState, spanId: string): void {
    const span = event.exportedSpan;

    if (event.type === EventType.SPAN_STARTED) {
      if (state.hasStart) {
        this.logger.warn(`Span ${spanId} (${span.type} "${span.name}") started twice`);
      }
    } else if (event.type === EventType.SPAN_ENDED) {
      if (span.isEvent) {
        // Event spans should only emit SPAN_ENDED
        if (state.hasStart) {
          this.logger.warn(`Event span ${spanId} (${span.type} "${span.name}") incorrectly received SPAN_STARTED`);
        }
        if (state.hasUpdate) {
          this.logger.warn(`Event span ${spanId} (${span.type} "${span.name}") incorrectly received SPAN_UPDATED`);
        }
      } else {
        // Normal spans should have started before ending
        if (!state.hasStart) {
          this.logger.warn(`Normal span ${spanId} (${span.type} "${span.name}") ended without starting`);
        }
      }
    }
  }

  // ============================================================================
  // Tracing Query Methods
  // ============================================================================

  /**
   * Get all collected tracing events
   */
  get events(): TracingEvent[] {
    return [...this.#tracingEvents];
  }

  /**
   * Get completed spans by SpanType (e.g., 'agent_run', 'tool_call')
   *
   * @param type - The SpanType to filter by
   * @returns Array of completed exported spans of the specified type
   */
  getSpansByType<T extends SpanType>(type: T): ExportedSpan<T>[] {
    return Array.from(this.#spanStates.values())
      .filter(state => {
        if (!state.hasEnd) return false;
        const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
        return endEvent?.exportedSpan.type === type;
      })
      .map(state => {
        const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
        return endEvent?.exportedSpan;
      })
      .filter((span): span is ExportedSpan<T> => span !== undefined);
  }

  /**
   * Get events by TracingEventType (SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED)
   *
   * @param type - The TracingEventType to filter by
   * @returns Array of events of the specified type
   */
  getByEventType(type: TracingEventType): TracingEvent[] {
    return this.#tracingEvents.filter(e => e.type === type);
  }

  /**
   * Get all events and spans for a specific trace
   *
   * @param traceId - The trace ID to filter by
   * @returns Object containing tracing events, final spans, plus logs/scores/feedback for the trace
   */
  getByTraceId(traceId: string): {
    events: TracingEvent[];
    spans: AnyExportedSpan[];
    logs: ExportedLog[];
    scores: ExportedScore[];
    feedback: ExportedFeedback[];
  } {
    const events = this.#tracingEvents.filter(e => e.exportedSpan.traceId === traceId);
    const spans = this.#getUniqueSpansFromEvents(events);
    const logs = this.#logEvents.filter(e => e.log.traceId === traceId).map(e => e.log);
    const scores = this.#scoreEvents.filter(e => e.score.traceId === traceId).map(e => e.score);
    const feedback = this.#feedbackEvents.filter(e => e.feedback.traceId === traceId).map(e => e.feedback);
    return { events, spans, logs, scores, feedback };
  }

  /**
   * Get all events for a specific span
   *
   * @param spanId - The span ID to filter by
   * @returns Object containing events and final span state
   */
  getBySpanId(spanId: string): {
    events: TracingEvent[];
    span: AnyExportedSpan | undefined;
    state: SpanState | undefined;
  } {
    const state = this.#spanStates.get(spanId);
    if (!state) {
      return { events: [], span: undefined, state: undefined };
    }

    const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
    const span = endEvent?.exportedSpan ?? state.events[state.events.length - 1]?.exportedSpan;

    return { events: state.events, span, state };
  }

  /**
   * Get all unique spans (returns the final state of each span)
   */
  getAllSpans(): AnyExportedSpan[] {
    return Array.from(this.#spanStates.values())
      .map(state => {
        const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
        return endEvent?.exportedSpan ?? state.events[state.events.length - 1]?.exportedSpan;
      })
      .filter((span): span is AnyExportedSpan => span !== undefined);
  }

  /**
   * Get only completed spans (those that have received SPAN_ENDED)
   */
  getCompletedSpans(): AnyExportedSpan[] {
    return Array.from(this.#spanStates.values())
      .filter(state => state.hasEnd)
      .map(state => {
        const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
        return endEvent!.exportedSpan;
      });
  }

  /**
   * Get root spans only (spans with no parent)
   */
  getRootSpans(): AnyExportedSpan[] {
    return this.getAllSpans().filter(span => span.isRootSpan);
  }

  /**
   * Get incomplete spans (started but not yet ended)
   */
  getIncompleteSpans(): IncompleteSpanInfo[] {
    return Array.from(this.#spanStates.entries())
      .filter(([_, state]) => !state.hasEnd)
      .map(([spanId, state]) => ({
        spanId,
        span: state.events[0]?.exportedSpan,
        state: {
          hasStart: state.hasStart,
          hasUpdate: state.hasUpdate,
          hasEnd: state.hasEnd,
        },
      }));
  }

  /**
   * Get unique trace IDs from all collected signals
   */
  getTraceIds(): string[] {
    const traceIds = new Set<string>();
    for (const event of this.#tracingEvents) {
      traceIds.add(event.exportedSpan.traceId);
    }
    for (const event of this.#logEvents) {
      if (event.log.traceId) traceIds.add(event.log.traceId);
    }
    for (const event of this.#scoreEvents) {
      traceIds.add(event.score.traceId);
    }
    for (const event of this.#feedbackEvents) {
      traceIds.add(event.feedback.traceId);
    }
    return Array.from(traceIds);
  }

  // ============================================================================
  // Log Query Methods
  // ============================================================================

  /**
   * Get all collected log events
   */
  getLogEvents(): LogEvent[] {
    return [...this.#logEvents];
  }

  /**
   * Get all collected logs (unwrapped from events)
   */
  getAllLogs(): ExportedLog[] {
    return this.#logEvents.map(e => e.log);
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): ExportedLog[] {
    return this.#logEvents.filter(e => e.log.level === level).map(e => e.log);
  }

  /**
   * Get logs for a specific trace
   */
  getLogsByTraceId(traceId: string): ExportedLog[] {
    return this.#logEvents.filter(e => e.log.traceId === traceId).map(e => e.log);
  }

  // ============================================================================
  // Metric Query Methods
  // ============================================================================

  /**
   * Get all collected metric events
   */
  getMetricEvents(): MetricEvent[] {
    return [...this.#metricEvents];
  }

  /**
   * Get all collected metrics (unwrapped from events)
   */
  getAllMetrics(): ExportedMetric[] {
    return this.#metricEvents.map(e => e.metric);
  }

  /**
   * Get metrics filtered by name
   */
  getMetricsByName(name: string): ExportedMetric[] {
    return this.#metricEvents.filter(e => e.metric.name === name).map(e => e.metric);
  }

  /**
   * Get metrics filtered by type
   */
  getMetricsByType(metricType: MetricType): ExportedMetric[] {
    return this.#metricEvents.filter(e => e.metric.metricType === metricType).map(e => e.metric);
  }

  // ============================================================================
  // Score Query Methods
  // ============================================================================

  /**
   * Get all collected score events
   */
  getScoreEvents(): ScoreEvent[] {
    return [...this.#scoreEvents];
  }

  /**
   * Get all collected scores (unwrapped from events)
   */
  getAllScores(): ExportedScore[] {
    return this.#scoreEvents.map(e => e.score);
  }

  /**
   * Get scores filtered by scorer name
   */
  getScoresByScorer(scorerName: string): ExportedScore[] {
    return this.#scoreEvents.filter(e => e.score.scorerName === scorerName).map(e => e.score);
  }

  /**
   * Get scores for a specific trace
   */
  getScoresByTraceId(traceId: string): ExportedScore[] {
    return this.#scoreEvents.filter(e => e.score.traceId === traceId).map(e => e.score);
  }

  // ============================================================================
  // Feedback Query Methods
  // ============================================================================

  /**
   * Get all collected feedback events
   */
  getFeedbackEvents(): FeedbackEvent[] {
    return [...this.#feedbackEvents];
  }

  /**
   * Get all collected feedback (unwrapped from events)
   */
  getAllFeedback(): ExportedFeedback[] {
    return this.#feedbackEvents.map(e => e.feedback);
  }

  /**
   * Get feedback filtered by type
   */
  getFeedbackByType(feedbackType: string): ExportedFeedback[] {
    return this.#feedbackEvents.filter(e => e.feedback.feedbackType === feedbackType).map(e => e.feedback);
  }

  /**
   * Get feedback for a specific trace
   */
  getFeedbackByTraceId(traceId: string): ExportedFeedback[] {
    return this.#feedbackEvents.filter(e => e.feedback.traceId === traceId).map(e => e.feedback);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get comprehensive statistics about all collected signals
   */
  getStatistics(): TestExporterStats {
    const bySpanType: Record<string, number> = {};
    let completedSpans = 0;
    let incompleteSpans = 0;

    for (const state of this.#spanStates.values()) {
      if (state.hasEnd) {
        completedSpans++;
        const endEvent = state.events.find(e => e.type === EventType.SPAN_ENDED);
        const spanType = endEvent?.exportedSpan.type;
        if (spanType) {
          bySpanType[spanType] = (bySpanType[spanType] || 0) + 1;
        }
      } else {
        incompleteSpans++;
      }
    }

    // Log level breakdown
    const logsByLevel: Record<string, number> = {};
    for (const event of this.#logEvents) {
      const level = event.log.level;
      logsByLevel[level] = (logsByLevel[level] || 0) + 1;
    }

    // Metric breakdowns
    const metricsByType: Record<string, number> = {};
    const metricsByName: Record<string, number> = {};
    for (const event of this.#metricEvents) {
      const mType = event.metric.metricType;
      metricsByType[mType] = (metricsByType[mType] || 0) + 1;
      const mName = event.metric.name;
      metricsByName[mName] = (metricsByName[mName] || 0) + 1;
    }

    // Score breakdown by scorer
    const scoresByScorer: Record<string, number> = {};
    for (const event of this.#scoreEvents) {
      const scorer = event.score.scorerName;
      scoresByScorer[scorer] = (scoresByScorer[scorer] || 0) + 1;
    }

    // Feedback breakdown by type
    const feedbackByType: Record<string, number> = {};
    for (const event of this.#feedbackEvents) {
      const fbType = event.feedback.feedbackType;
      feedbackByType[fbType] = (feedbackByType[fbType] || 0) + 1;
    }

    return {
      totalTracingEvents: this.#tracingEvents.length,
      totalEvents: this.#tracingEvents.length, // deprecated alias
      totalSpans: this.#spanStates.size,
      totalTraces: this.getTraceIds().length,
      completedSpans,
      incompleteSpans,
      byEventType: {
        started: this.#tracingEvents.filter(e => e.type === EventType.SPAN_STARTED).length,
        updated: this.#tracingEvents.filter(e => e.type === EventType.SPAN_UPDATED).length,
        ended: this.#tracingEvents.filter(e => e.type === EventType.SPAN_ENDED).length,
      },
      bySpanType,
      totalLogs: this.#logEvents.length,
      logsByLevel,
      totalMetrics: this.#metricEvents.length,
      metricsByType,
      metricsByName,
      totalScores: this.#scoreEvents.length,
      scoresByScorer,
      totalFeedback: this.#feedbackEvents.length,
      feedbackByType,
    };
  }

  // ============================================================================
  // JSON Output
  // ============================================================================

  /**
   * Serialize all collected data to JSON string
   *
   * @param options - Serialization options
   * @returns JSON string of all collected data
   */
  toJSON(options?: { indent?: number; includeEvents?: boolean; includeStats?: boolean }): string {
    const indent = options?.indent ?? this.#config.jsonIndent;
    const includeEvents = options?.includeEvents ?? true;
    const includeStats = options?.includeStats ?? true;

    const data: Record<string, unknown> = {
      spans: this.getAllSpans(),
    };

    // Include log/metric/score/feedback data
    if (this.#logEvents.length > 0) {
      data.logs = this.getAllLogs();
    }
    if (this.#metricEvents.length > 0) {
      data.metrics = this.getAllMetrics();
    }
    if (this.#scoreEvents.length > 0) {
      data.scores = this.getAllScores();
    }
    if (this.#feedbackEvents.length > 0) {
      data.feedback = this.getAllFeedback();
    }

    if (includeEvents) {
      data.events = this.#tracingEvents;
    }

    if (includeStats) {
      data.statistics = this.getStatistics();
    }

    return JSON.stringify(data, this.#jsonReplacer, indent);
  }

  /**
   * Build a tree structure from spans, nesting children under their parents
   *
   * @returns Array of root span tree nodes (spans with no parent)
   */
  buildSpanTree(): SpanTreeNode[] {
    const spans = this.getAllSpans();
    const nodeMap = new Map<string, SpanTreeNode>();
    const roots: SpanTreeNode[] = [];

    // First pass: create nodes for all spans
    for (const span of spans) {
      nodeMap.set(span.id, { span, children: [] });
    }

    // Second pass: build parent-child relationships
    for (const span of spans) {
      const node = nodeMap.get(span.id)!;
      if (span.parentSpanId && nodeMap.has(span.parentSpanId)) {
        // Has a parent in our collection - add as child
        nodeMap.get(span.parentSpanId)!.children.push(node);
      } else {
        // No parent or parent not in collection - this is a root
        roots.push(node);
      }
    }

    // Sort children by startTime for consistent ordering
    const sortChildren = (node: SpanTreeNode) => {
      node.children.sort((a, b) => new Date(a.span.startTime).getTime() - new Date(b.span.startTime).getTime());
      node.children.forEach(sortChildren);
    };
    roots.forEach(sortChildren);

    return roots;
  }

  /**
   * Serialize spans as a tree structure to JSON string
   *
   * @param options - Serialization options
   * @returns JSON string with spans nested in tree format
   */
  toTreeJSON(options?: { indent?: number; includeStats?: boolean }): string {
    const indent = options?.indent ?? this.#config.jsonIndent;
    const includeStats = options?.includeStats ?? true;

    const data: Record<string, unknown> = {
      tree: this.buildSpanTree(),
    };

    if (includeStats) {
      data.statistics = this.getStatistics();
    }

    return JSON.stringify(data, this.#jsonReplacer, indent);
  }

  /**
   * Build a normalized tree structure suitable for snapshot testing.
   *
   * Normalizations applied:
   * - Span IDs replaced with stable placeholders (<span-1>, <span-2>, etc.)
   * - Trace IDs replaced with stable placeholders (<trace-1>, <trace-2>, etc.)
   * - parentSpanId replaced with normalized parent ID
   * - Timestamps replaced with durationMs (or null if not ended)
   * - Empty children arrays are omitted
   *
   * @returns Array of normalized root tree nodes
   */
  buildNormalizedTree(): NormalizedTreeNode[] {
    const tree = this.buildSpanTree();
    const spanIdMap = new Map<string, string>();
    const traceIdMap = new Map<string, string>();
    // Key-specific UUID maps: key -> (uuid -> placeholder)
    const uuidMapsByKey = new Map<string, Map<string, string>>();
    // Key-specific counters
    const uuidCountersByKey = new Map<string, number>();
    let spanIdCounter = 1;
    let traceIdCounter = 1;

    // UUID regex pattern (8-4-4-4-12 hex chars)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // 32-character hex string (traceId format without hyphens)
    const hexId32Regex = /^[0-9a-f]{32}$/i;
    // Prefixed UUID pattern (e.g., mapping_<uuid>, dowhile_<uuid>) - for exact match
    const prefixedUuidRegex = /^([a-z_]+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
    // Prefixed UUID pattern for embedded matches (global)
    const embeddedPrefixedUuidRegex = /([a-z_]+)_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

    // Helper to normalize a UUID with key-specific placeholders
    const normalizeUuid = (uuid: string, key: string): string => {
      if (!uuidMapsByKey.has(key)) {
        uuidMapsByKey.set(key, new Map());
        uuidCountersByKey.set(key, 1);
      }
      const keyMap = uuidMapsByKey.get(key)!;
      if (!keyMap.has(uuid)) {
        const counter = uuidCountersByKey.get(key)!;
        keyMap.set(uuid, `<${key}-${counter}>`);
        uuidCountersByKey.set(key, counter + 1);
      }
      return keyMap.get(uuid)!;
    };

    // Helper to normalize a value, replacing UUIDs and Dates with stable placeholders
    // The key parameter is used to create key-specific UUID placeholders
    const normalizeValue = (value: unknown, key?: string): unknown => {
      // Handle Date objects - just indicate a date exists, don't track specific values
      if (value instanceof Date) {
        return '<date>';
      }
      if (typeof value === 'string') {
        // Special handling for traceId - use the shared traceIdMap (handles both UUID and 32-char hex formats)
        if (key === 'traceId' && (uuidRegex.test(value) || hexId32Regex.test(value))) {
          if (!traceIdMap.has(value)) {
            traceIdMap.set(value, `<trace-${traceIdCounter++}>`);
          }
          return traceIdMap.get(value)!;
        }
        // Check for pure UUID (exact match)
        if (uuidRegex.test(value)) {
          // Use key-specific placeholder if key is provided, otherwise generic 'uuid'
          return normalizeUuid(value, key ?? 'uuid');
        }
        // Check for prefixed UUID (e.g., mapping_<uuid>) - exact match
        const prefixMatch = prefixedUuidRegex.exec(value);
        if (prefixMatch && prefixMatch[1] && prefixMatch[2]) {
          const prefix = prefixMatch[1];
          const uuid = prefixMatch[2];
          return `${prefix}_${normalizeUuid(uuid, prefix)}`;
        }
        // Check for embedded prefixed UUIDs (e.g., "workflow step: 'mapping_<uuid>'")
        if (embeddedPrefixedUuidRegex.test(value)) {
          // Reset lastIndex since we used test()
          embeddedPrefixedUuidRegex.lastIndex = 0;
          return value.replace(embeddedPrefixedUuidRegex, (_match, prefix, uuid) => {
            return `${prefix}_${normalizeUuid(uuid, prefix)}`;
          });
        }
      }
      if (Array.isArray(value)) {
        return value.map(v => normalizeValue(v, key));
      }
      if (value && typeof value === 'object') {
        const normalized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
          // Pass the key name when normalizing the value
          normalized[k] = normalizeValue(v, k);
        }
        return normalized;
      }
      return value;
    };

    // First pass: assign stable IDs in tree traversal order
    const assignIds = (nodes: SpanTreeNode[]) => {
      for (const node of nodes) {
        spanIdMap.set(node.span.id, `<span-${spanIdCounter++}>`);
        // Assign trace ID if not seen before
        if (!traceIdMap.has(node.span.traceId)) {
          traceIdMap.set(node.span.traceId, `<trace-${traceIdCounter++}>`);
        }
        assignIds(node.children);
      }
    };
    assignIds(tree);

    // Second pass: build normalized tree
    const normalizeNode = (node: SpanTreeNode): NormalizedTreeNode => {
      const span = node.span;
      const completed = span.endTime !== undefined && span.endTime !== null;

      const normalizedSpan: NormalizedSpan = {
        id: spanIdMap.get(span.id)!,
        traceId: traceIdMap.get(span.traceId)!,
        name: normalizeValue(span.name, 'name') as string,
        type: span.type,
        completed,
        isEvent: span.isEvent,
        isRootSpan: span.isRootSpan,
      };

      // Only include optional fields if they have values
      if (span.parentSpanId && spanIdMap.has(span.parentSpanId)) {
        normalizedSpan.parentId = spanIdMap.get(span.parentSpanId);
      }
      if (span.entityType) {
        normalizedSpan.entityType = span.entityType;
      }
      if (span.entityId) {
        normalizedSpan.entityId = normalizeValue(span.entityId, 'entityId') as string;
      }
      if (span.attributes && Object.keys(span.attributes).length > 0) {
        normalizedSpan.attributes = normalizeValue(span.attributes) as Record<string, unknown>;
      }
      if (span.metadata && Object.keys(span.metadata).length > 0) {
        normalizedSpan.metadata = normalizeValue(span.metadata) as Record<string, unknown>;
      }
      if (span.input !== undefined) {
        normalizedSpan.input = normalizeValue(span.input);
      }
      if (span.output !== undefined) {
        normalizedSpan.output = normalizeValue(span.output);
      }
      if (span.errorInfo) {
        normalizedSpan.errorInfo = span.errorInfo;
      }
      if (span.tags && span.tags.length > 0) {
        normalizedSpan.tags = span.tags;
      }

      const result: NormalizedTreeNode = { span: normalizedSpan };

      // Only include children if non-empty
      if (node.children.length > 0) {
        result.children = node.children.map(normalizeNode);
      }

      return result;
    };

    return tree.map(normalizeNode);
  }

  /**
   * Generate an ASCII tree structure graph for debugging.
   * Shows span type and name in a hierarchical format.
   *
   * @param nodes - Normalized tree nodes (defaults to current normalized tree)
   * @returns Array of strings representing the tree structure
   *
   * @example
   * ```
   * agent_run: "agent run: 'test-agent'"
   * ├── processor_run: "input processor: validator"
   * │   └── agent_run: "agent run: 'validator-agent'"
   * └── model_generation: "llm: 'mock-model-id'"
   * ```
   */
  generateStructureGraph(nodes?: NormalizedTreeNode[]): string[] {
    const tree = nodes ?? this.buildNormalizedTree();
    const lines: string[] = [];

    const buildLines = (node: NormalizedTreeNode, prefix: string, isLast: boolean, isRoot: boolean): void => {
      // Build the current line
      const connector = isRoot ? '' : isLast ? '└── ' : '├── ';
      const line = `${prefix}${connector}${node.span.type}: "${node.span.name}"`;
      lines.push(line);

      // Build lines for children
      const children = node.children ?? [];
      const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ');
      children.forEach((child, index) => {
        const childIsLast = index === children.length - 1;
        buildLines(child, childPrefix, childIsLast, false);
      });
    };

    // Process each root node
    tree.forEach((rootNode, index) => {
      if (index > 0) {
        lines.push(''); // Add blank line between multiple roots
      }
      buildLines(rootNode, '', true, true);
    });

    return lines;
  }

  /**
   * Serialize spans as a normalized tree structure for snapshot testing.
   * Includes a __structure__ field with an ASCII tree graph for readability.
   *
   * @param options - Serialization options
   * @returns JSON string with normalized spans in tree format
   */
  toNormalizedTreeJSON(options?: { indent?: number; includeStructure?: boolean }): string {
    const indent = options?.indent ?? this.#config.jsonIndent;
    const includeStructure = options?.includeStructure ?? true;
    const normalizedTree = this.buildNormalizedTree();

    if (includeStructure) {
      const structureGraph = this.generateStructureGraph(normalizedTree);
      const data = {
        __structure__: structureGraph,
        spans: normalizedTree,
      };
      return JSON.stringify(data, null, indent);
    }

    return JSON.stringify(normalizedTree, null, indent);
  }

  /**
   * Write collected data to a JSON file
   *
   * @param filePath - Path to write the JSON file
   * @param options - Serialization options
   */
  async writeToFile(
    filePath: string,
    options?: {
      indent?: number;
      includeEvents?: boolean;
      includeStats?: boolean;
      format?: 'flat' | 'tree' | 'normalized';
    },
  ): Promise<void> {
    const format = options?.format ?? 'flat';
    let json: string;

    if (format === 'normalized') {
      json = this.toNormalizedTreeJSON({ indent: options?.indent });
    } else if (format === 'tree') {
      json = this.toTreeJSON({ indent: options?.indent, includeStats: options?.includeStats });
    } else {
      json = this.toJSON(options);
    }

    await writeFile(filePath, json, 'utf-8');
    this.logger.info(`TestExporter: wrote ${this.#tracingEvents.length} tracing events to ${filePath}`);
  }

  /**
   * Assert that the current normalized tree matches a snapshot file.
   * Throws an error with a diff if they don't match.
   *
   * The snapshot format includes:
   * - `__structure__`: ASCII tree graph (compared first for quick validation)
   * - `spans`: The normalized span tree (detailed comparison)
   *
   * Supports special markers in the snapshot:
   * - `{"__or__": ["value1", "value2"]}` - matches if actual equals any listed value
   * - `{"__any__": "string"}` - matches any string value
   * - `{"__any__": "number"}` - matches any number value
   * - `{"__any__": "boolean"}` - matches any boolean value
   * - `{"__any__": "object"}` - matches any object value
   * - `{"__any__": "array"}` - matches any array value
   * - `{"__any__": true}` - matches any non-null/undefined value
   *
   * Environment variables:
   * Use `{ updateSnapshot: true }` option to update the snapshot instead of comparing
   *
   * @param snapshotName - Name of the snapshot file (resolved relative to __snapshots__ directory)
   * @param options - Options for snapshot comparison
   * @param options.updateSnapshot - If true, update the snapshot file instead of comparing
   * @throws Error if the snapshot doesn't match (and updateSnapshot is false)
   */
  async assertMatchesSnapshot(snapshotName: string, options?: { updateSnapshot?: boolean }): Promise<void> {
    // Resolve snapshot path relative to the __snapshots__ directory
    const snapshotPath = join(getSnapshotsDir(), snapshotName);
    const normalizedTree = this.buildNormalizedTree();
    const structureGraph = this.generateStructureGraph(normalizedTree);

    // Build current data with structure
    const currentData = {
      __structure__: structureGraph,
      spans: normalizedTree,
    };
    const currentJson = JSON.stringify(currentData, null, this.#config.jsonIndent);

    // Check option to update snapshot
    const shouldUpdate = options?.updateSnapshot;

    // If updating snapshot, write and return
    if (shouldUpdate) {
      await writeFile(snapshotPath, currentJson, 'utf-8');
      this.logger.info(`TestExporter: updated snapshot ${snapshotPath}`);
      return;
    }

    let snapshotData: { __structure__?: string[]; spans?: unknown } | unknown[];
    try {
      const snapshotContent = await readFile(snapshotPath, 'utf-8');
      snapshotData = JSON.parse(snapshotContent);
    } catch {
      throw new Error(`Snapshot file not found: ${snapshotPath}\n` + `Run with { updateSnapshot: true } to create it.`);
    }

    // Handle both old format (array) and new format (object with __structure__ and spans)
    let expectedSpans: unknown;
    let expectedStructure: string[] | undefined;

    if (Array.isArray(snapshotData)) {
      // Old format: just the spans array
      expectedSpans = snapshotData;
    } else if (snapshotData && typeof snapshotData === 'object' && 'spans' in snapshotData) {
      // New format: { __structure__, spans }
      expectedSpans = snapshotData.spans;
      expectedStructure = snapshotData.__structure__;
    } else {
      throw new Error(
        `Invalid snapshot format in ${snapshotPath}.\n` + `Expected an array or object with 'spans' property.`,
      );
    }

    // Compare structure first (quick validation)
    if (expectedStructure) {
      const structureMismatches = this.#compareStructure(structureGraph, expectedStructure);
      if (structureMismatches.length > 0) {
        throw new Error(
          `Structure mismatch in snapshot:\n\n` +
            `Expected:\n${expectedStructure.join('\n')}\n\n` +
            `Actual:\n${structureGraph.join('\n')}\n\n` +
            `Differences:\n${structureMismatches.join('\n')}\n\n` +
            `Snapshot: ${snapshotPath}\n` +
            `Run with { updateSnapshot: true } to update.`,
        );
      }
    }

    // Deep compare spans
    const mismatches: { path: string; expected: unknown; actual: unknown }[] = [];
    this.#deepCompareWithMarkers(normalizedTree, expectedSpans, '$.spans', mismatches);

    if (mismatches.length > 0) {
      const mismatchDetails = mismatches
        .map(
          (m, i) =>
            `${i + 1}. ${m.path}\n   Expected: ${JSON.stringify(m.expected)}\n   Actual:   ${JSON.stringify(m.actual)}`,
        )
        .join('\n\n');
      throw new Error(
        `Snapshot has ${mismatches.length} mismatch${mismatches.length > 1 ? 'es' : ''}:\n\n` +
          `${mismatchDetails}\n\n` +
          `Snapshot: ${snapshotPath}\n` +
          `Run with { updateSnapshot: true } to update.`,
      );
    }
  }

  /**
   * Compare two structure graphs and return differences
   */
  #compareStructure(actual: string[], expected: string[]): string[] {
    const diffs: string[] = [];

    const maxLen = Math.max(actual.length, expected.length);
    for (let i = 0; i < maxLen; i++) {
      const actualLine = actual[i];
      const expectedLine = expected[i];

      if (actualLine !== expectedLine) {
        if (actualLine === undefined) {
          diffs.push(`Line ${i + 1}: Missing in actual`);
          diffs.push(`  Expected: ${expectedLine}`);
        } else if (expectedLine === undefined) {
          diffs.push(`Line ${i + 1}: Extra in actual`);
          diffs.push(`  Actual: ${actualLine}`);
        } else {
          diffs.push(`Line ${i + 1}:`);
          diffs.push(`  Expected: ${expectedLine}`);
          diffs.push(`  Actual:   ${actualLine}`);
        }
      }
    }

    return diffs;
  }

  /**
   * Deep compare two values, supporting special markers like __or__ and __any__.
   * Collects all mismatches into the provided array.
   */
  #deepCompareWithMarkers(
    actual: unknown,
    expected: unknown,
    path: string,
    mismatches: { path: string; expected: unknown; actual: unknown }[],
  ): void {
    // Handle __or__ marker
    if (this.#isOrMarker(expected)) {
      const allowedValues = (expected as { __or__: unknown[] }).__or__;
      const matches = allowedValues.some(allowed => {
        const tempMismatches: { path: string; expected: unknown; actual: unknown }[] = [];
        this.#deepCompareWithMarkers(actual, allowed, path, tempMismatches);
        return tempMismatches.length === 0;
      });
      if (!matches) {
        mismatches.push({ path, expected: { __or__: allowedValues }, actual });
      }
      return;
    }

    // Handle __any__ marker
    if (this.#isAnyMarker(expected)) {
      const typeConstraint = (expected as { __any__: string | boolean }).__any__;

      // Check for null/undefined
      if (actual === null || actual === undefined) {
        mismatches.push({ path, expected: { __any__: typeConstraint }, actual });
        return;
      }

      // If typeConstraint is true, any non-null value matches
      if (typeConstraint === true) {
        return;
      }

      // Check type constraint
      const actualType = Array.isArray(actual) ? 'array' : typeof actual;
      if (actualType !== typeConstraint) {
        mismatches.push({
          path,
          expected: { __any__: typeConstraint },
          actual: `(${actualType}) ${JSON.stringify(actual).slice(0, 50)}...`,
        });
      }
      return;
    }

    // Handle arrays
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        mismatches.push({ path, expected, actual });
        return;
      }
      if (actual.length !== expected.length) {
        mismatches.push({ path: `${path}.length`, expected: expected.length, actual: actual.length });
        return;
      }
      for (let i = 0; i < expected.length; i++) {
        this.#deepCompareWithMarkers(actual[i], expected[i], `${path}[${i}]`, mismatches);
      }
      return;
    }

    // Handle objects
    if (expected !== null && typeof expected === 'object') {
      if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
        mismatches.push({ path, expected, actual });
        return;
      }
      const expectedObj = expected as Record<string, unknown>;
      const actualObj = actual as Record<string, unknown>;

      // Check all expected keys exist and match (skip metadata keys like __placeholder__)
      for (const key of Object.keys(expectedObj)) {
        // Skip metadata keys (e.g., __placeholder__, __structure__)
        if (this.#isMetadataKey(key)) {
          continue;
        }
        if (!(key in actualObj)) {
          // Only report if expected value is not undefined
          if (expectedObj[key] !== undefined) {
            mismatches.push({ path: `${path}.${key}`, expected: expectedObj[key], actual: undefined });
          }
          continue;
        }
        this.#deepCompareWithMarkers(actualObj[key], expectedObj[key], `${path}.${key}`, mismatches);
      }

      // Check for extra keys in actual (skip metadata keys)
      for (const key of Object.keys(actualObj)) {
        if (this.#isMetadataKey(key)) {
          continue;
        }
        if (!(key in expectedObj)) {
          // Only report if actual value is not undefined
          if (actualObj[key] !== undefined) {
            mismatches.push({ path: `${path}.${key}`, expected: undefined, actual: actualObj[key] });
          }
        }
      }
      return;
    }

    // Handle primitives
    if (actual !== expected) {
      mismatches.push({ path, expected, actual });
    }
  }

  /**
   * Check if a value is an __or__ marker object
   */
  #isOrMarker(value: unknown): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      '__or__' in value &&
      Array.isArray((value as { __or__: unknown }).__or__)
    );
  }

  /**
   * Check if a value is an __any__ marker object
   */
  #isAnyMarker(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    if (!('__any__' in value)) {
      return false;
    }
    const constraint = (value as { __any__: unknown }).__any__;
    // Valid constraints: true, or type strings
    return constraint === true || ['string', 'number', 'boolean', 'object', 'array'].includes(constraint as string);
  }

  /**
   * Check if a key should be skipped during comparison (metadata keys like __structure__)
   */
  #isMetadataKey(key: string): boolean {
    return key.startsWith('__') && key.endsWith('__');
  }

  /**
   * Custom JSON replacer to handle Date objects and other special types
   */
  #jsonReplacer = (_key: string, value: unknown): unknown => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  };

  // ============================================================================
  // Debugging Helpers
  // ============================================================================

  /**
   * Get all stored debug logs (internal exporter logging, not signal logs)
   */
  getLogs(): string[] {
    return [...this.#debugLogs];
  }

  /**
   * Dump debug logs to console for debugging (uses console.error for visibility in test output)
   */
  dumpLogs(): void {
    console.error('\n=== TestExporter Logs ===');
    this.#debugLogs.forEach(log => console.error(log));
    console.error('=== End Logs ===\n');
  }

  /**
   * Validate final state - useful for test assertions
   *
   * @returns Object with validation results
   */
  validateFinalState(): {
    valid: boolean;
    singleTraceId: boolean;
    allSpansComplete: boolean;
    traceIds: string[];
    incompleteSpans: IncompleteSpanInfo[];
  } {
    const traceIds = this.getTraceIds();
    const incompleteSpans = this.getIncompleteSpans();

    const singleTraceId = traceIds.length === 1;
    const allSpansComplete = incompleteSpans.length === 0;

    return {
      valid: singleTraceId && allSpansComplete,
      singleTraceId,
      allSpansComplete,
      traceIds,
      incompleteSpans,
    };
  }

  // ============================================================================
  // Reset & Lifecycle
  // ============================================================================

  /**
   * Clear all collected events and state across all signals
   */
  clearEvents(): void {
    this.#tracingEvents = [];
    this.#spanStates.clear();
    this.#logEvents = [];
    this.#metricEvents = [];
    this.#scoreEvents = [];
    this.#feedbackEvents = [];
    this.#debugLogs = [];
  }

  /**
   * Alias for clearEvents (compatibility with TestExporter)
   */
  reset(): void {
    this.clearEvents();
  }

  /**
   * Get internal metrics about the exporter's own activity.
   */
  getInternalMetrics(): TestExporterInternalMetrics {
    const json = this.toJSON({ includeEvents: false, includeStats: false });
    return {
      startedAt: this.#internalMetrics.startedAt,
      lastEventAt: this.#internalMetrics.lastEventAt,
      totalEventsReceived: this.#internalMetrics.totalEventsReceived,
      bySignal: { ...this.#internalMetrics.bySignal },
      flushCount: this.#internalMetrics.flushCount,
      estimatedJsonBytes: new TextEncoder().encode(json).byteLength,
    };
  }

  /**
   * Flush buffered data and log internal metrics summary.
   */
  async flush(): Promise<void> {
    this.#internalMetrics.flushCount++;

    if (this.#config.logMetricsOnFlush) {
      const metrics = this.getInternalMetrics();
      const uptimeMs = Date.now() - metrics.startedAt.getTime();
      const summary = [
        `[TestExporter] flush #${metrics.flushCount} summary:`,
        `  uptime: ${(uptimeMs / 1000).toFixed(1)}s`,
        `  total events received: ${metrics.totalEventsReceived}`,
        `  by signal: tracing=${metrics.bySignal.tracing}, log=${metrics.bySignal.log}, metric=${metrics.bySignal.metric}, score=${metrics.bySignal.score}, feedback=${metrics.bySignal.feedback}`,
        `  buffered: spans=${this.#spanStates.size}, logs=${this.#logEvents.length}, metrics=${this.#metricEvents.length}, scores=${this.#scoreEvents.length}, feedback=${this.#feedbackEvents.length}`,
        `  estimated JSON size: ${(metrics.estimatedJsonBytes / 1024).toFixed(1)}KB`,
      ].join('\n');
      this.logger.info(summary);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.logger.info('TestExporter shutdown');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Extract unique spans from a list of events
   */
  #getUniqueSpansFromEvents(events: TracingEvent[]): AnyExportedSpan[] {
    const spanMap = new Map<string, AnyExportedSpan>();

    for (const event of events) {
      const span = event.exportedSpan;
      // Prefer SPAN_ENDED events as they contain the final state
      if (event.type === EventType.SPAN_ENDED || !spanMap.has(span.id)) {
        spanMap.set(span.id, span);
      }
    }

    return Array.from(spanMap.values());
  }
}

// ============================================================================
// Deprecated Aliases
// ============================================================================

/**
 * @deprecated Use `TestExporter` instead. This alias will be removed in a future version.
 */
export const JsonExporter = TestExporter;
/**
 * @deprecated Use `TestExporter` instead. This is a type alias for backward compatibility.
 */
export type JsonExporter = TestExporter;

/**
 * @deprecated Use `TestExporterConfig` instead.
 */
export type JsonExporterConfig = TestExporterConfig;

/**
 * @deprecated Use `TestExporterStats` instead.
 */
export type JsonExporterStats = TestExporterStats;

/**
 * @deprecated Use `TestExporterInternalMetrics` instead.
 */
export type JsonExporterInternalMetrics = TestExporterInternalMetrics;
