import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { LogLevel } from '@mastra/core/logger';
import { TracingEventType } from '@mastra/core/observability';
import type {
  TracingEvent,
  AnyExportedSpan,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import { fetchWithRetry } from '@mastra/core/utils';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

export interface CloudExporterConfig extends BaseExporterConfig {
  maxBatchSize?: number; // Default: 1000 spans
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number; // Default: 3

  // Cloud-specific configuration
  accessToken?: string; // Cloud access token (from env or config)
  endpoint?: string; // Legacy alias for tracesEndpoint
  tracesEndpoint?: string; // Cloud traces endpoint
  logsEndpoint?: string; // Cloud logs endpoint
  metricsEndpoint?: string; // Cloud metrics endpoint
  scoresEndpoint?: string; // Cloud scores endpoint
  feedbackEndpoint?: string; // Cloud feedback endpoint
}

type CloudSignal = 'traces' | 'logs' | 'metrics' | 'scores' | 'feedback';

const SIGNAL_PATH_SEGMENTS: Record<CloudSignal, string> = {
  traces: 'spans',
  logs: 'logs',
  metrics: 'metrics',
  scores: 'scores',
  feedback: 'feedback',
};

const SIGNAL_PAYLOAD_KEYS: Record<CloudSignal, string> = {
  traces: 'spans',
  logs: 'logs',
  metrics: 'metrics',
  scores: 'scores',
  feedback: 'feedback',
};

const DEFAULT_TRACES_ENDPOINT = 'https://api.mastra.ai/ai/spans/publish';
const CIRCULAR_REFERENCE_MARKER = '[Circular]';

function serializeError(error: Error, activeRefs: WeakSet<object>): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause !== undefined ? { cause: sanitizeForJson(error.cause, activeRefs) } : {}),
  };
}

function sanitizeForJson(value: unknown, activeRefs = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Error) {
    if (activeRefs.has(value)) {
      return CIRCULAR_REFERENCE_MARKER;
    }

    activeRefs.add(value);
    try {
      return serializeError(value, activeRefs);
    } finally {
      activeRefs.delete(value);
    }
  }

  if (Array.isArray(value)) {
    if (activeRefs.has(value)) {
      return CIRCULAR_REFERENCE_MARKER;
    }

    activeRefs.add(value);
    try {
      return value.map(item => sanitizeForJson(item, activeRefs));
    } finally {
      activeRefs.delete(value);
    }
  }

  if (value instanceof Map) {
    if (activeRefs.has(value)) {
      return CIRCULAR_REFERENCE_MARKER;
    }

    activeRefs.add(value);
    try {
      return Object.fromEntries(
        Array.from(value.entries(), ([key, entryValue]) => [String(key), sanitizeForJson(entryValue, activeRefs)]),
      );
    } finally {
      activeRefs.delete(value);
    }
  }

  if (value instanceof Set) {
    if (activeRefs.has(value)) {
      return CIRCULAR_REFERENCE_MARKER;
    }

    activeRefs.add(value);
    try {
      return Array.from(value.values(), item => sanitizeForJson(item, activeRefs));
    } finally {
      activeRefs.delete(value);
    }
  }

  switch (typeof value) {
    case 'bigint':
      return value.toString();
    case 'function':
      return `[Function ${value.name || 'anonymous'}]`;
    case 'symbol':
      return value.toString();
    case 'object': {
      if (activeRefs.has(value)) {
        return CIRCULAR_REFERENCE_MARKER;
      }

      activeRefs.add(value);
      try {
        return Object.fromEntries(
          Object.entries(value).map(([key, entryValue]) => [key, sanitizeForJson(entryValue, activeRefs)]),
        );
      } finally {
        activeRefs.delete(value);
      }
    }
    default:
      return value;
  }
}

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(sanitizeForJson(value));
}

function deriveSiblingEndpoint(tracesEndpoint: string, signal: Exclude<CloudSignal, 'traces'>): string {
  const tracePath = `/${SIGNAL_PATH_SEGMENTS.traces}/publish`;
  const signalPath = `/${SIGNAL_PATH_SEGMENTS[signal]}/publish`;

  if (tracesEndpoint.includes(tracePath)) {
    return tracesEndpoint.replace(tracePath, signalPath);
  }

  return tracesEndpoint;
}

function resolveSignalEndpoint(
  signal: Exclude<CloudSignal, 'traces'>,
  tracesEndpoint: string,
  explicitEndpoint?: string,
): string {
  if (explicitEndpoint) {
    return explicitEndpoint;
  }

  return deriveSiblingEndpoint(tracesEndpoint, signal);
}

interface MastraCloudBuffer {
  spans: MastraCloudSpanRecord[];
  logs: MastraCloudLogRecord[];
  metrics: MastraCloudMetricRecord[];
  scores: MastraCloudScoreRecord[];
  feedback: MastraCloudFeedbackRecord[];
  firstEventTime?: Date;
  totalSize: number;
}

type MastraCloudSpanRecord = AnyExportedSpan & {
  spanId: string;
  spanType: string;
  startedAt: Date;
  endedAt: Date | null;
  error: AnyExportedSpan['errorInfo'] | null;
  createdAt: Date;
  updatedAt: Date | null;
};

type MastraCloudLogRecord = LogEvent['log'];
type MastraCloudMetricRecord = MetricEvent['metric'];
type MastraCloudScoreRecord = ScoreEvent['score'];
type MastraCloudFeedbackRecord = FeedbackEvent['feedback'];

/** Config type with required fields resolved (excludes optional BaseExporterConfig fields) */
type ResolvedCloudConfig = Required<Omit<CloudExporterConfig, keyof BaseExporterConfig | 'endpoint'>> & {
  logger: BaseExporterConfig['logger'];
  logLevel: NonNullable<BaseExporterConfig['logLevel']>;
};

export class CloudExporter extends BaseExporter {
  name = 'mastra-cloud-observability-exporter';

  private cloudConfig: ResolvedCloudConfig;
  private buffer: MastraCloudBuffer;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlightFlushes = new Set<Promise<void>>();

  constructor(config: CloudExporterConfig = {}) {
    super(config);

    const accessToken = config.accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    if (!accessToken) {
      this.setDisabled('MASTRA_CLOUD_ACCESS_TOKEN environment variable not set.');
    }

    const tracesEndpoint =
      config.tracesEndpoint ?? config.endpoint ?? process.env.MASTRA_CLOUD_TRACES_ENDPOINT ?? DEFAULT_TRACES_ENDPOINT;

    this.cloudConfig = {
      logger: this.logger,
      logLevel: config.logLevel ?? LogLevel.INFO,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      accessToken: accessToken || '',
      tracesEndpoint,
      logsEndpoint: resolveSignalEndpoint(
        'logs',
        tracesEndpoint,
        config.logsEndpoint ?? process.env.MASTRA_CLOUD_LOGS_ENDPOINT,
      ),
      metricsEndpoint: resolveSignalEndpoint(
        'metrics',
        tracesEndpoint,
        config.metricsEndpoint ?? process.env.MASTRA_CLOUD_METRICS_ENDPOINT,
      ),
      scoresEndpoint: resolveSignalEndpoint(
        'scores',
        tracesEndpoint,
        config.scoresEndpoint ?? process.env.MASTRA_CLOUD_SCORES_ENDPOINT,
      ),
      feedbackEndpoint: resolveSignalEndpoint(
        'feedback',
        tracesEndpoint,
        config.feedbackEndpoint ?? process.env.MASTRA_CLOUD_FEEDBACK_ENDPOINT,
      ),
    };

    this.buffer = {
      spans: [],
      logs: [],
      metrics: [],
      scores: [],
      feedback: [],
      totalSize: 0,
    };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Cloud Observability only process SPAN_ENDED events
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    this.addToBuffer(event);

    await this.handleBufferedEvent();
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.addLogToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.addMetricToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.addScoreToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    this.addFeedbackToBuffer(event);
    await this.handleBufferedEvent();
  }

  private addToBuffer(event: TracingEvent): void {
    this.markBufferStart();

    const spanRecord = this.formatSpan(event.exportedSpan);
    this.buffer.spans.push(spanRecord);
    this.buffer.totalSize++;
  }

  private addLogToBuffer(event: LogEvent): void {
    this.markBufferStart();

    this.buffer.logs.push(this.formatLog(event.log));
    this.buffer.totalSize++;
  }

  private addMetricToBuffer(event: MetricEvent): void {
    this.markBufferStart();

    this.buffer.metrics.push(this.formatMetric(event.metric));
    this.buffer.totalSize++;
  }

  private addScoreToBuffer(event: ScoreEvent): void {
    this.markBufferStart();

    this.buffer.scores.push(this.formatScore(event.score));
    this.buffer.totalSize++;
  }

  private addFeedbackToBuffer(event: FeedbackEvent): void {
    this.markBufferStart();

    this.buffer.feedback.push(this.formatFeedback(event.feedback));
    this.buffer.totalSize++;
  }

  private markBufferStart(): void {
    if (this.buffer.totalSize === 0) {
      this.buffer.firstEventTime = new Date();
    }
  }

  private formatSpan(span: AnyExportedSpan): MastraCloudSpanRecord {
    const spanRecord: MastraCloudSpanRecord = {
      ...span,
      spanId: span.id,
      spanType: span.type,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      error: span.errorInfo ?? null,
      createdAt: new Date(),
      updatedAt: null,
    };

    return spanRecord;
  }

  private formatLog(log: LogEvent['log']): MastraCloudLogRecord {
    return {
      ...log,
    };
  }

  private formatMetric(metric: MetricEvent['metric']): MastraCloudMetricRecord {
    return {
      ...metric,
    };
  }

  private formatScore(score: ScoreEvent['score']): MastraCloudScoreRecord {
    return {
      ...score,
    };
  }

  private formatFeedback(feedback: FeedbackEvent['feedback']): MastraCloudFeedbackRecord {
    return {
      ...feedback,
    };
  }

  private async handleBufferedEvent(): Promise<void> {
    if (this.shouldFlush()) {
      void this.flush().catch(error => {
        this.logger.error('Batch flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else if (this.buffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }

  private shouldFlush(): boolean {
    // Size-based flush
    if (this.buffer.totalSize >= this.cloudConfig.maxBatchSize) {
      return true;
    }

    // Time-based flush
    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.cloudConfig.maxBatchWaitMs) {
        return true;
      }
    }

    return false;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      void this.flush().catch(error => {
        const mastraError = new MastraError(
          {
            id: `CLOUD_EXPORTER_FAILED_TO_SCHEDULE_FLUSH`,
            domain: ErrorDomain.MASTRA_OBSERVABILITY,
            category: ErrorCategory.USER,
          },
          error,
        );
        this.logger.trackException(mastraError);
        this.logger.error('Scheduled flush failed', mastraError);
      });
    }, this.cloudConfig.maxBatchWaitMs);
  }

  private startTrackedFlush(): Promise<void> {
    const flushPromise = this.flushBuffer();
    this.inFlightFlushes.add(flushPromise);
    void flushPromise.then(
      () => {
        this.inFlightFlushes.delete(flushPromise);
      },
      () => {
        this.inFlightFlushes.delete(flushPromise);
      },
    );
    return flushPromise;
  }

  private async flushBuffer(): Promise<void> {
    // Clear timer since we're flushing
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.totalSize === 0) {
      return; // Nothing to flush
    }

    const startTime = Date.now();
    const spansCopy = [...this.buffer.spans];
    const logsCopy = [...this.buffer.logs];
    const metricsCopy = [...this.buffer.metrics];
    const scoresCopy = [...this.buffer.scores];
    const feedbackCopy = [...this.buffer.feedback];
    const batchSize = this.buffer.totalSize;
    const flushReason = this.buffer.totalSize >= this.cloudConfig.maxBatchSize ? 'size' : 'time';

    // Reset buffer immediately to prevent blocking new events
    this.resetBuffer();

    const results = await Promise.all([
      this.flushSignalBatch('traces', spansCopy),
      this.flushSignalBatch('logs', logsCopy),
      this.flushSignalBatch('metrics', metricsCopy),
      this.flushSignalBatch('scores', scoresCopy),
      this.flushSignalBatch('feedback', feedbackCopy),
    ]);

    const failedSignals = results.filter(result => !result.succeeded).map(result => result.signal);

    const elapsed = Date.now() - startTime;

    if (failedSignals.length === 0) {
      this.logger.debug('Batch flushed successfully', {
        batchSize,
        flushReason,
        durationMs: elapsed,
      });
      return;
    }

    this.logger.warn('Batch flush completed with dropped signal batches', {
      batchSize,
      flushReason,
      durationMs: elapsed,
      failedSignals,
    });
  }

  /**
   * Uploads a signal batch to the configured cloud API using fetchWithRetry.
   */
  private async batchUpload<T>(signal: CloudSignal, records: T[]): Promise<void> {
    const headers = {
      Authorization: `Bearer ${this.cloudConfig.accessToken}`,
      'Content-Type': 'application/json',
    };

    const endpointMap: Record<CloudSignal, string> = {
      traces: this.cloudConfig.tracesEndpoint,
      logs: this.cloudConfig.logsEndpoint,
      metrics: this.cloudConfig.metricsEndpoint,
      scores: this.cloudConfig.scoresEndpoint,
      feedback: this.cloudConfig.feedbackEndpoint,
    };

    const options: RequestInit = {
      method: 'POST',
      headers,
      body: safeJsonStringify({ [SIGNAL_PAYLOAD_KEYS[signal]]: records }),
    };

    await fetchWithRetry(endpointMap[signal], options, this.cloudConfig.maxRetries);
  }

  private async flushSignalBatch<T>(
    signal: CloudSignal,
    records: T[],
  ): Promise<{ signal: CloudSignal; succeeded: boolean }> {
    if (records.length === 0) {
      return { signal, succeeded: true };
    }

    try {
      await this.batchUpload(signal, records);
      return { signal, succeeded: true };
    } catch (error) {
      const errorId = `CLOUD_EXPORTER_FAILED_TO_BATCH_UPLOAD_${signal.toUpperCase()}` as Uppercase<string>;
      const mastraError = new MastraError(
        {
          id: errorId,
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.USER,
          details: {
            signal,
            droppedBatchSize: records.length,
          },
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Batch upload failed after all retries, dropping batch', mastraError);
      return { signal, succeeded: false };
    }
  }

  private resetBuffer(): void {
    this.buffer.spans = [];
    this.buffer.logs = [];
    this.buffer.metrics = [];
    this.buffer.scores = [];
    this.buffer.feedback = [];
    this.buffer.firstEventTime = undefined;
    this.buffer.totalSize = 0;
  }

  /**
   * Force flush any buffered spans without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure spans
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
    // Skip if disabled
    if (this.isDisabled) {
      return;
    }

    while (this.buffer.totalSize > 0 || this.inFlightFlushes.size > 0) {
      if (this.buffer.totalSize > 0) {
        this.logger.debug('Flushing buffered events', {
          bufferedEvents: this.buffer.totalSize,
        });
        await this.startTrackedFlush();
        continue;
      }

      await Promise.allSettled([...this.inFlightFlushes]);
    }
  }

  async shutdown(): Promise<void> {
    // Skip if disabled
    if (this.isDisabled) {
      return;
    }

    // Clear any pending timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush any remaining events
    try {
      await this.flush();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `CLOUD_EXPORTER_FAILED_TO_FLUSH_REMAINING_EVENTS_DURING_SHUTDOWN`,
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.USER,
          details: {
            remainingEvents: this.buffer.totalSize,
          },
        },
        error,
      );

      this.logger.trackException(mastraError);
      this.logger.error('Failed to flush remaining events during shutdown', mastraError);
    }

    this.logger.info('CloudExporter shutdown complete');
  }
}
