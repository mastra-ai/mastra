import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { LogLevel } from '@mastra/core/logger';
import { SpanType, TracingEventType } from '@mastra/core/observability';
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
  projectId?: string; // Project ID for project-scoped collector routes
  endpoint?: string; // Base cloud endpoint
  tracesEndpoint?: string; // Explicit cloud traces endpoint override
  logsEndpoint?: string; // Explicit cloud logs endpoint override
  metricsEndpoint?: string; // Explicit cloud metrics endpoint override
  scoresEndpoint?: string; // Explicit cloud scores endpoint override
  feedbackEndpoint?: string; // Explicit cloud feedback endpoint override
}

type CloudSignal = 'traces' | 'logs' | 'metrics' | 'scores' | 'feedback';

const SIGNAL_PUBLISH_SUFFIXES: Record<CloudSignal, string> = {
  traces: '/spans/publish',
  logs: '/logs/publish',
  metrics: '/metrics/publish',
  scores: '/scores/publish',
  feedback: '/feedback/publish',
};

const DEFAULT_CLOUD_SPAN_FILTER = (span: AnyExportedSpan): boolean => span.type !== SpanType.MODEL_CHUNK;

const SIGNAL_PUBLISH_SEGMENTS: Record<CloudSignal, string> = {
  traces: 'spans',
  logs: 'logs',
  metrics: 'metrics',
  scores: 'scores',
  feedback: 'feedback',
};

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end--;
  }
  return end === value.length ? value : value.slice(0, end);
}

function createInvalidEndpointError(endpoint: string, text: string, cause?: unknown): MastraError {
  return new MastraError(
    {
      id: `CLOUD_EXPORTER_INVALID_ENDPOINT`,
      text,
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.USER,
      details: {
        endpoint,
      },
    },
    cause,
  );
}

const VALID_PROJECT_ID = /^[a-zA-Z0-9_-]+$/;

function createInvalidProjectIdError(projectId: string): MastraError {
  return new MastraError({
    id: `CLOUD_EXPORTER_INVALID_PROJECT_ID`,
    text: 'CloudExporter projectId must only contain letters, numbers, hyphens, and underscores.',
    domain: ErrorDomain.MASTRA_OBSERVABILITY,
    category: ErrorCategory.USER,
    details: {
      projectId,
    },
  });
}

function resolveBaseEndpoint(baseEndpoint: string): string {
  const normalizedEndpoint = trimTrailingSlashes(baseEndpoint);
  const invalidText =
    'CloudExporter endpoint must be a base origin like "https://collector.example.com" with no path, search, or hash.';

  try {
    const parsedEndpoint = new URL(normalizedEndpoint);
    if (parsedEndpoint.pathname !== '/' || parsedEndpoint.search || parsedEndpoint.hash) {
      throw createInvalidEndpointError(baseEndpoint, invalidText);
    }
    return trimTrailingSlashes(parsedEndpoint.origin);
  } catch (error) {
    if (error instanceof MastraError) {
      throw error;
    }

    throw createInvalidEndpointError(baseEndpoint, invalidText, error);
  }
}

function buildSignalPath(signal: CloudSignal, projectId?: string): string {
  const signalSegment = SIGNAL_PUBLISH_SEGMENTS[signal];
  if (!projectId) {
    return `/ai/${signalSegment}/publish`;
  }

  return `/projects/${projectId}/ai/${signalSegment}/publish`;
}

function buildSignalEndpoint(baseEndpoint: string, signal: CloudSignal, projectId?: string): string {
  return `${baseEndpoint}${buildSignalPath(signal, projectId)}`;
}

function resolveExplicitSignalEndpoint(signal: CloudSignal, endpoint: string, projectId?: string): string {
  const normalizedEndpoint = trimTrailingSlashes(endpoint);
  const invalidText = `CloudExporter ${signal}Endpoint must be a base origin like "https://collector.example.com" or a full ${signal} publish URL ending in "${SIGNAL_PUBLISH_SUFFIXES[signal]}".`;

  try {
    const parsedEndpoint = new URL(normalizedEndpoint);
    if (parsedEndpoint.search || parsedEndpoint.hash) {
      throw createInvalidEndpointError(endpoint, invalidText);
    }

    const normalizedOrigin = trimTrailingSlashes(parsedEndpoint.origin);
    const normalizedPathname = trimTrailingSlashes(parsedEndpoint.pathname);

    if (!normalizedPathname || normalizedPathname === '/') {
      return buildSignalEndpoint(normalizedOrigin, signal, projectId);
    }

    if (normalizedPathname.endsWith(SIGNAL_PUBLISH_SUFFIXES[signal])) {
      return `${normalizedOrigin}${normalizedPathname}`;
    }

    throw createInvalidEndpointError(endpoint, invalidText);
  } catch (error) {
    if (error instanceof MastraError) {
      throw error;
    }

    throw createInvalidEndpointError(endpoint, invalidText, error);
  }
}

function deriveSignalEndpointFromTracesEndpoint(signal: CloudSignal, tracesEndpoint: string): string {
  if (signal === 'traces') {
    return tracesEndpoint;
  }

  const normalizedTracesEndpoint = trimTrailingSlashes(tracesEndpoint);
  const invalidText =
    'CloudExporter tracesEndpoint must be a base origin like "https://collector.example.com" or a full traces publish URL ending in "/spans/publish".';

  try {
    const parsedEndpoint = new URL(normalizedTracesEndpoint);
    const normalizedOrigin = trimTrailingSlashes(parsedEndpoint.origin);
    const normalizedPathname = trimTrailingSlashes(parsedEndpoint.pathname);

    if (!normalizedPathname.endsWith(SIGNAL_PUBLISH_SUFFIXES.traces)) {
      throw createInvalidEndpointError(tracesEndpoint, invalidText);
    }

    const basePath = normalizedPathname.slice(0, -SIGNAL_PUBLISH_SUFFIXES.traces.length);
    return `${normalizedOrigin}${basePath}${SIGNAL_PUBLISH_SUFFIXES[signal]}`;
  } catch (error) {
    if (error instanceof MastraError) {
      throw error;
    }

    throw createInvalidEndpointError(tracesEndpoint, invalidText, error);
  }
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

type ResolvedCloudConfig = {
  logger: BaseExporterConfig['logger'];
  logLevel: NonNullable<BaseExporterConfig['logLevel']>;
  maxBatchSize: number;
  maxBatchWaitMs: number;
  maxRetries: number;
  accessToken: string;
  tracesEndpoint: string;
  logsEndpoint: string;
  metricsEndpoint: string;
  scoresEndpoint: string;
  feedbackEndpoint: string;
};

export class CloudExporter extends BaseExporter {
  name = 'mastra-cloud-observability-exporter';

  private readonly cloudConfig: Readonly<ResolvedCloudConfig>;
  private buffer: MastraCloudBuffer;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlightFlushes = new Set<Promise<void>>();

  constructor(config: CloudExporterConfig = {}) {
    super(config);

    if (config.projectId !== undefined && !VALID_PROJECT_ID.test(config.projectId)) {
      throw createInvalidProjectIdError(config.projectId);
    }

    const accessToken = config.accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    const rawProjectId = config.projectId ?? process.env.MASTRA_PROJECT_ID;
    const projectId = rawProjectId && VALID_PROJECT_ID.test(rawProjectId) ? rawProjectId : undefined;
    if (!accessToken) {
      this.setDisabled('MASTRA_CLOUD_ACCESS_TOKEN environment variable not set.', 'debug');
    }

    const tracesEndpointOverride = config.tracesEndpoint ?? process.env.MASTRA_CLOUD_TRACES_ENDPOINT;
    let baseEndpoint: string | undefined;
    let tracesEndpoint: string;

    if (tracesEndpointOverride) {
      tracesEndpoint = resolveExplicitSignalEndpoint('traces', tracesEndpointOverride, projectId);
    } else {
      baseEndpoint = resolveBaseEndpoint(config.endpoint ?? 'https://observability.mastra.ai');
      tracesEndpoint = buildSignalEndpoint(baseEndpoint, 'traces', projectId);
    }

    const resolveConfiguredSignalEndpoint = (
      signal: Exclude<CloudSignal, 'traces'>,
      explicitEndpoint?: string,
    ): string => {
      if (explicitEndpoint) {
        return resolveExplicitSignalEndpoint(signal, explicitEndpoint, projectId);
      }

      if (tracesEndpointOverride) {
        return deriveSignalEndpointFromTracesEndpoint(signal, tracesEndpoint);
      }

      return buildSignalEndpoint(baseEndpoint!, signal, projectId);
    };

    this.cloudConfig = {
      logger: this.logger,
      logLevel: config.logLevel ?? LogLevel.INFO,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
      accessToken: accessToken || '',
      tracesEndpoint,
      logsEndpoint: resolveConfiguredSignalEndpoint('logs', config.logsEndpoint),
      metricsEndpoint: resolveConfiguredSignalEndpoint('metrics', config.metricsEndpoint),
      scoresEndpoint: resolveConfiguredSignalEndpoint('scores', config.scoresEndpoint),
      feedbackEndpoint: resolveConfiguredSignalEndpoint('feedback', config.feedbackEndpoint),
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

    if (!DEFAULT_CLOUD_SPAN_FILTER(event.exportedSpan)) {
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
      body: JSON.stringify({ [SIGNAL_PUBLISH_SEGMENTS[signal]]: records }),
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

        const flushPromise = this.flushBuffer();
        this.inFlightFlushes.add(flushPromise);

        try {
          await flushPromise;
        } finally {
          this.inFlightFlushes.delete(flushPromise);
        }

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
