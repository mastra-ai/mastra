import { EventBatcher } from './batcher.js';

import type { EventBatcherConfig } from './batcher.js';
import type {
  Trace,
  Span,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityWriterConfig,
  FlushResult,
  WriterStats,
} from './types.js';

/**
 * Default configuration values
 */
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_BASE_PATH = 'observability';

/**
 * ObservabilityWriter is the main class for recording observability events.
 *
 * It provides a simple API for recording traces, spans, logs, metrics, and scores.
 * Events are buffered in memory and periodically flushed to file storage as JSONL files.
 *
 * @example
 * ```typescript
 * import { ObservabilityWriter } from '@mastra/observability-writer';
 * import { LocalFileStorage } from '@mastra/observability-file-local';
 *
 * const writer = new ObservabilityWriter({
 *   fileStorage: new LocalFileStorage({ basePath: '/var/mastra/observability' }),
 *   projectId: 'proj_123',
 *   deploymentId: 'deploy_456',
 *   batchSize: 500,
 *   flushIntervalMs: 10000,
 * });
 *
 * // Record events
 * writer.recordTrace({ traceId: 'trace_1', projectId: 'proj_123', ... });
 * writer.recordSpan({ spanId: 'span_1', traceId: 'trace_1', ... });
 * writer.recordLog({ id: 'log_1', level: 'info', message: 'Hello', ... });
 *
 * // Graceful shutdown
 * await writer.shutdown();
 * ```
 */
export class ObservabilityWriter {
  private readonly batcher: EventBatcher;
  private readonly config: Required<ObservabilityWriterConfig>;

  constructor(config: ObservabilityWriterConfig) {
    // Apply defaults
    this.config = {
      fileStorage: config.fileStorage,
      projectId: config.projectId,
      deploymentId: config.deploymentId,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      flushIntervalMs: config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
      maxFileSize: config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
      basePath: config.basePath ?? DEFAULT_BASE_PATH,
      debug: config.debug ?? false,
    };

    // Validate configuration
    this.validateConfig();

    // Create the event batcher
    const batcherConfig: EventBatcherConfig = {
      fileStorage: this.config.fileStorage,
      projectId: this.config.projectId,
      batchSize: this.config.batchSize,
      flushIntervalMs: this.config.flushIntervalMs,
      maxFileSize: this.config.maxFileSize,
      basePath: this.config.basePath,
      debug: this.config.debug,
    };

    this.batcher = new EventBatcher(batcherConfig);
  }

  /**
   * Validate the configuration
   */
  private validateConfig(): void {
    if (!this.config.fileStorage) {
      throw new Error('fileStorage is required');
    }

    if (!this.config.projectId || typeof this.config.projectId !== 'string') {
      throw new Error('projectId is required and must be a string');
    }

    if (!this.config.deploymentId || typeof this.config.deploymentId !== 'string') {
      throw new Error('deploymentId is required and must be a string');
    }

    if (this.config.batchSize <= 0) {
      throw new Error('batchSize must be greater than 0');
    }

    if (this.config.flushIntervalMs < 0) {
      throw new Error('flushIntervalMs must be greater than or equal to 0');
    }

    if (this.config.maxFileSize <= 0) {
      throw new Error('maxFileSize must be greater than 0');
    }
  }

  /**
   * Record a trace event.
   *
   * Traces represent a complete request/operation from start to finish.
   * They contain spans which represent individual operations within the trace.
   *
   * @param trace - The trace event to record
   */
  recordTrace(trace: Trace): void {
    const event: ObservabilityEvent = {
      type: 'trace',
      data: trace,
    };
    this.batcher.add(event);
  }

  /**
   * Record a span event.
   *
   * Spans represent individual operations within a trace (e.g., LLM call, tool execution).
   *
   * @param span - The span event to record
   */
  recordSpan(span: Span): void {
    const event: ObservabilityEvent = {
      type: 'span',
      data: span,
    };
    this.batcher.add(event);
  }

  /**
   * Record a log event.
   *
   * Logs capture textual information with severity levels.
   *
   * @param log - The log event to record
   */
  recordLog(log: Log): void {
    const event: ObservabilityEvent = {
      type: 'log',
      data: log,
    };
    this.batcher.add(event);
  }

  /**
   * Record a metric event.
   *
   * Metrics capture numeric measurements (e.g., token counts, latency, costs).
   *
   * @param metric - The metric event to record
   */
  recordMetric(metric: Metric): void {
    const event: ObservabilityEvent = {
      type: 'metric',
      data: metric,
    };
    this.batcher.add(event);
  }

  /**
   * Record a score event.
   *
   * Scores capture evaluation results (e.g., quality scores, relevance scores).
   *
   * @param score - The score event to record
   */
  recordScore(score: Score): void {
    const event: ObservabilityEvent = {
      type: 'score',
      data: score,
    };
    this.batcher.add(event);
  }

  /**
   * Record multiple events at once.
   *
   * This is more efficient when you have multiple events to record
   * as it reduces function call overhead.
   *
   * @param events - Array of observability events to record
   */
  recordEvents(events: ObservabilityEvent[]): void {
    this.batcher.addMany(events);
  }

  /**
   * Force flush all buffered events to storage.
   *
   * This is useful when you need to ensure events are persisted immediately,
   * for example before a deployment or at the end of a request.
   *
   * @returns Result of the flush operation including event counts and any errors
   */
  async flush(): Promise<FlushResult> {
    return this.batcher.flush();
  }

  /**
   * Shutdown the writer gracefully.
   *
   * This stops the flush timer and flushes all remaining buffered events.
   * After calling shutdown(), the writer cannot accept new events.
   *
   * @returns Result of the final flush operation
   */
  async shutdown(): Promise<FlushResult> {
    return this.batcher.shutdown();
  }

  /**
   * Get current writer statistics.
   *
   * Useful for monitoring and debugging.
   *
   * @returns Statistics about buffered and written events
   */
  getStats(): WriterStats {
    return this.batcher.getStats();
  }

  /**
   * Check if the writer has been shutdown.
   */
  isShutdown(): boolean {
    return this.batcher.isShutdownComplete();
  }

  /**
   * Get the project ID this writer is configured for.
   */
  getProjectId(): string {
    return this.config.projectId;
  }

  /**
   * Get the deployment ID this writer is configured for.
   */
  getDeploymentId(): string {
    return this.config.deploymentId;
  }
}
