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
import { AuthFailureCooldown, fetchWithAuthFailureHandling, isAuthFailureError } from './auth-failure-cooldown';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

export interface MastraPlatformExporterConfig extends BaseExporterConfig {
  maxBatchSize?: number; // Default: 1000 spans
  maxBatchWaitMs?: number; // Default: 5000ms
  maxRetries?: number; // Default: 3

  accessToken?: string; // Mastra Observability access token (from env or config)
  projectId?: string; // Project ID for project-scoped collector routes
  endpoint?: string; // Base observability endpoint
  tracesEndpoint?: string; // Explicit traces endpoint override
  logsEndpoint?: string; // Explicit logs endpoint override
  metricsEndpoint?: string; // Explicit metrics endpoint override
  scoresEndpoint?: string; // Explicit scores endpoint override
  feedbackEndpoint?: string; // Explicit feedback endpoint override
}

type PlatformSignal = 'traces' | 'logs' | 'metrics' | 'scores' | 'feedback';

const SIGNAL_PUBLISH_SUFFIXES: Record<PlatformSignal, string> = {
  traces: '/spans/publish',
  logs: '/logs/publish',
  metrics: '/metrics/publish',
  scores: '/scores/publish',
  feedback: '/feedback/publish',
};

const DEFAULT_PLATFORM_SPAN_FILTER = (span: AnyExportedSpan): boolean => span.type !== SpanType.MODEL_CHUNK;

// Stop-signal contract: when the org's observability quota is exhausted, the
// collector rejects every publish route with 402 Payment Required plus the
// headers below. 402 is deliberately non-retryable: the exporter must drop the
// batch (no auto-retry), pause, and probe until the collector stops sending it.
const QUOTA_EXCEEDED_STATUS = 402;
const OBSERVABILITY_STATUS_HEADER = 'x-mastra-observability';
const OBSERVABILITY_DISABLED_VALUE = 'disabled';
const OBSERVABILITY_RETRY_AFTER_HEADER = 'x-mastra-observability-retry-after';
// Advertises that this exporter understands the quota-pause contract. The
// collector uses its presence to decide between 402 (capable clients pause and
// probe) and 204 (legacy clients that would otherwise blindly retry).
export const OBSERVABILITY_CAPABILITIES_HEADER = 'x-mastra-observability-capabilities';
export const QUOTA_PAUSE_CAPABILITY = 'quota-pause-v1';
const DEFAULT_QUOTA_PROBE_INTERVAL_SECONDS = 300;
// Node.js timers overflow above 2^31 - 1 ms and fire after ~1ms instead.
const MAX_QUOTA_PROBE_INTERVAL_SECONDS = Math.floor(0x7fffffff / 1000);

function isObservabilityDisabled(response: Response): boolean {
  return response.headers.get(OBSERVABILITY_STATUS_HEADER) === OBSERVABILITY_DISABLED_VALUE;
}

// The contract says either signal means pause; check both for robustness.
function isQuotaExceededResponse(response: Response): boolean {
  return response.status === QUOTA_EXCEEDED_STATUS || isObservabilityDisabled(response);
}

function parseQuotaRetryAfterSeconds(response: Response): number {
  const raw = response.headers.get(OBSERVABILITY_RETRY_AFTER_HEADER);
  if (!raw || !/^\d+$/.test(raw.trim())) {
    return DEFAULT_QUOTA_PROBE_INTERVAL_SECONDS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_QUOTA_PROBE_INTERVAL_SECONDS;
  }

  return Math.min(parsed, MAX_QUOTA_PROBE_INTERVAL_SECONDS);
}

const SIGNAL_PUBLISH_SEGMENTS: Record<PlatformSignal, string> = {
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
      id: `MASTRA_PLATFORM_EXPORTER_INVALID_ENDPOINT`,
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
    id: `MASTRA_PLATFORM_EXPORTER_INVALID_PROJECT_ID`,
    text: 'MastraPlatformExporter projectId must only contain letters, numbers, hyphens, and underscores.',
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
    'MastraPlatformExporter endpoint must be a base origin like "https://collector.example.com" with no path, search, or hash.';

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

function buildSignalPath(signal: PlatformSignal, projectId?: string): string {
  const signalSegment = SIGNAL_PUBLISH_SEGMENTS[signal];
  if (!projectId) {
    return `/ai/${signalSegment}/publish`;
  }

  return `/projects/${projectId}/ai/${signalSegment}/publish`;
}

function buildSignalEndpoint(baseEndpoint: string, signal: PlatformSignal, projectId?: string): string {
  return `${baseEndpoint}${buildSignalPath(signal, projectId)}`;
}

function resolveExplicitSignalEndpoint(signal: PlatformSignal, endpoint: string, projectId?: string): string {
  const normalizedEndpoint = trimTrailingSlashes(endpoint);
  const invalidText = `MastraPlatformExporter ${signal}Endpoint must be a base origin like "https://collector.example.com" or a full ${signal} publish URL ending in "${SIGNAL_PUBLISH_SUFFIXES[signal]}".`;

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

function deriveSignalEndpointFromTracesEndpoint(signal: PlatformSignal, tracesEndpoint: string): string {
  if (signal === 'traces') {
    return tracesEndpoint;
  }

  const normalizedTracesEndpoint = trimTrailingSlashes(tracesEndpoint);
  const invalidText =
    'MastraPlatformExporter tracesEndpoint must be a base origin like "https://collector.example.com" or a full traces publish URL ending in "/spans/publish".';

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

interface MastraPlatformBuffer {
  spans: MastraPlatformSpanRecord[];
  logs: MastraPlatformLogRecord[];
  metrics: MastraPlatformMetricRecord[];
  scores: MastraPlatformScoreRecord[];
  feedback: MastraPlatformFeedbackRecord[];
  firstEventTime?: Date;
  totalSize: number;
}

type MastraPlatformSpanRecord = AnyExportedSpan & {
  spanId: string;
  spanType: string;
  startedAt: Date;
  endedAt: Date | null;
  error: AnyExportedSpan['errorInfo'] | null;
  createdAt: Date;
  updatedAt: Date | null;
};

type MastraPlatformLogRecord = LogEvent['log'];
type MastraPlatformMetricRecord = MetricEvent['metric'];
type MastraPlatformScoreRecord = ScoreEvent['score'];
type MastraPlatformFeedbackRecord = FeedbackEvent['feedback'];

type ResolvedPlatformConfig = {
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

export class MastraPlatformExporter extends BaseExporter {
  name = 'mastra-platform-exporter';

  private readonly platformConfig: Readonly<ResolvedPlatformConfig>;
  private readonly authFailureCooldown: AuthFailureCooldown;
  private buffer: MastraPlatformBuffer;
  private flushTimer: NodeJS.Timeout | null = null;
  private inFlightFlushes = new Set<Promise<void>>();
  private quotaPaused = false;
  private quotaProbeTimer: NodeJS.Timeout | null = null;
  private quotaProbeIntervalSeconds = DEFAULT_QUOTA_PROBE_INTERVAL_SECONDS;
  private shuttingDown = false;

  constructor(config: MastraPlatformExporterConfig = {}) {
    super(config);

    if (config.projectId !== undefined && !VALID_PROJECT_ID.test(config.projectId)) {
      throw createInvalidProjectIdError(config.projectId);
    }

    const accessToken =
      config.accessToken || process.env.MASTRA_PLATFORM_ACCESS_TOKEN || process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    // Treat an empty MASTRA_PROJECT_ID as unset so deployments that always
    // export the variable (e.g. CI templates) don't have to special-case it.
    const envProjectId = process.env.MASTRA_PROJECT_ID === '' ? undefined : process.env.MASTRA_PROJECT_ID;
    const rawProjectId = config.projectId ?? envProjectId;
    if (rawProjectId !== undefined && !VALID_PROJECT_ID.test(rawProjectId)) {
      throw createInvalidProjectIdError(rawProjectId);
    }
    const projectId = rawProjectId;
    if (!accessToken) {
      this.setDisabled('MASTRA_PLATFORM_ACCESS_TOKEN environment variable not set.', 'debug');
    }

    // MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT is the documented override (also
    // consumed by Studio); MASTRA_CLOUD_TRACES_ENDPOINT is the legacy name.
    // `||` lets an empty legacy value fall through to the platform variable.
    const tracesEndpointOverride =
      config.tracesEndpoint ??
      (process.env.MASTRA_CLOUD_TRACES_ENDPOINT || process.env.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT || undefined);
    let baseEndpoint: string | undefined;
    let tracesEndpoint: string;

    if (tracesEndpointOverride) {
      tracesEndpoint = resolveExplicitSignalEndpoint('traces', tracesEndpointOverride, projectId);
    } else {
      baseEndpoint = resolveBaseEndpoint(config.endpoint ?? 'https://observability.mastra.ai');
      tracesEndpoint = buildSignalEndpoint(baseEndpoint, 'traces', projectId);
    }

    const resolveConfiguredSignalEndpoint = (
      signal: Exclude<PlatformSignal, 'traces'>,
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

    this.platformConfig = {
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

    this.authFailureCooldown = new AuthFailureCooldown('MastraPlatformExporter', () => this.logger);

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
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    if (!DEFAULT_PLATFORM_SPAN_FILTER(event.exportedSpan)) {
      return;
    }

    if (this.quotaPaused || this.authFailureCooldown.dropEventIfCoolingDown()) {
      return;
    }

    this.addToBuffer(event);

    await this.handleBufferedEvent();
  }

  async onLogEvent(event: LogEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    if (this.quotaPaused || this.authFailureCooldown.dropEventIfCoolingDown()) {
      return;
    }

    this.addLogToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onMetricEvent(event: MetricEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    if (this.quotaPaused || this.authFailureCooldown.dropEventIfCoolingDown()) {
      return;
    }

    this.addMetricToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onScoreEvent(event: ScoreEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    if (this.quotaPaused || this.authFailureCooldown.dropEventIfCoolingDown()) {
      return;
    }

    this.addScoreToBuffer(event);
    await this.handleBufferedEvent();
  }

  async onFeedbackEvent(event: FeedbackEvent): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    if (this.quotaPaused || this.authFailureCooldown.dropEventIfCoolingDown()) {
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

  private formatSpan(span: AnyExportedSpan): MastraPlatformSpanRecord {
    const spanRecord: MastraPlatformSpanRecord = {
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

  private formatLog(log: LogEvent['log']): MastraPlatformLogRecord {
    return {
      ...log,
    };
  }

  private formatMetric(metric: MetricEvent['metric']): MastraPlatformMetricRecord {
    return {
      ...metric,
    };
  }

  private formatScore(score: ScoreEvent['score']): MastraPlatformScoreRecord {
    return {
      ...score,
    };
  }

  private formatFeedback(feedback: FeedbackEvent['feedback']): MastraPlatformFeedbackRecord {
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
    if (this.buffer.totalSize >= this.platformConfig.maxBatchSize) {
      return true;
    }

    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.platformConfig.maxBatchWaitMs) {
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
            id: `MASTRA_PLATFORM_EXPORTER_FAILED_TO_SCHEDULE_FLUSH`,
            domain: ErrorDomain.MASTRA_OBSERVABILITY,
            category: ErrorCategory.USER,
          },
          error,
        );
        this.logger.trackException(mastraError);
        this.logger.error('Scheduled flush failed', mastraError);
      });
    }, this.platformConfig.maxBatchWaitMs);
  }

  private async flushBuffer(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.totalSize === 0) {
      return;
    }

    if (this.quotaPaused) {
      this.resetBuffer();
      return;
    }

    if (this.authFailureCooldown.dropEventsIfCoolingDown(this.buffer.totalSize)) {
      this.resetBuffer();
      return;
    }

    const startTime = Date.now();
    const spansCopy = [...this.buffer.spans];
    const logsCopy = [...this.buffer.logs];
    const metricsCopy = [...this.buffer.metrics];
    const scoresCopy = [...this.buffer.scores];
    const feedbackCopy = [...this.buffer.feedback];
    const batchSize = this.buffer.totalSize;
    const flushReason = this.buffer.totalSize >= this.platformConfig.maxBatchSize ? 'size' : 'time';

    this.resetBuffer();

    const results = await Promise.all([
      this.flushSignalBatch('traces', spansCopy),
      this.flushSignalBatch('logs', logsCopy),
      this.flushSignalBatch('metrics', metricsCopy),
      this.flushSignalBatch('scores', scoresCopy),
      this.flushSignalBatch('feedback', feedbackCopy),
    ]);

    const failedSignals = results.filter(result => !result.succeeded).map(result => result.signal);
    const authFailure = results.find(result => result.authFailureStatus !== undefined);

    const elapsed = Date.now() - startTime;

    if (failedSignals.length === 0) {
      const droppedEventsDuringAuthCooldown = this.authFailureCooldown.reset();
      const logData: Record<string, number | string> = {
        batchSize,
        flushReason,
        durationMs: elapsed,
      };

      if (droppedEventsDuringAuthCooldown > 0) {
        logData.droppedEventsDuringAuthCooldown = droppedEventsDuringAuthCooldown;
      }

      this.logger.debug('Batch flushed successfully', logData);
      return;
    }

    if (authFailure?.authFailureStatus !== undefined) {
      this.authFailureCooldown.recordFailure({
        status: authFailure.authFailureStatus,
        failedSignals,
        droppedBatchSize: batchSize,
      });
    }

    this.logger.warn('Batch flush completed with dropped signal batches', {
      batchSize,
      flushReason,
      durationMs: elapsed,
      failedSignals,
    });
  }

  /**
   * Uploads a signal batch to the configured Mastra Observability API using fetchWithRetry.
   */
  private buildPublishHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.platformConfig.accessToken}`,
      'Content-Type': 'application/json',
      [OBSERVABILITY_CAPABILITIES_HEADER]: QUOTA_PAUSE_CAPABILITY,
    };
  }

  private buildPublishBody<T>(signal: PlatformSignal, records: T[]): string {
    return JSON.stringify({ [SIGNAL_PUBLISH_SEGMENTS[signal]]: records });
  }

  private async batchUpload<T>(signal: PlatformSignal, records: T[]): Promise<void> {
    const endpointMap: Record<PlatformSignal, string> = {
      traces: this.platformConfig.tracesEndpoint,
      logs: this.platformConfig.logsEndpoint,
      metrics: this.platformConfig.metricsEndpoint,
      scores: this.platformConfig.scoresEndpoint,
      feedback: this.platformConfig.feedbackEndpoint,
    };

    const options: RequestInit = {
      method: 'POST',
      headers: this.buildPublishHeaders(),
      body: this.buildPublishBody(signal, records),
    };

    // Capture a quota-exceeded response in the retry predicate: returning
    // false makes fetchWithRetry throw without retrying (the 402'd batch must
    // never be re-sent), but the thrown error loses the Response and its
    // retry-after header, so we keep a reference here.
    let quotaResponse: Response | undefined;
    let response: Response;

    try {
      response = await fetchWithAuthFailureHandling(
        endpointMap[signal],
        options,
        this.platformConfig.maxRetries,
        res => {
          if (isQuotaExceededResponse(res)) {
            quotaResponse = res;
            return false;
          }

          return true;
        },
      );
    } catch (error) {
      if (quotaResponse) {
        // Quota exhaustion is the pause signal, not an upload failure: drop
        // the batch silently (the pause transition logs once) and pause.
        this.enterQuotaPause(parseQuotaRetryAfterSeconds(quotaResponse));
        return;
      }

      throw error;
    }

    if (isObservabilityDisabled(response)) {
      this.enterQuotaPause(parseQuotaRetryAfterSeconds(response));
    }
  }

  /**
   * Enter the quota-exhausted paused state: drop buffered events, stop the
   * flush timer, and start probing until the collector stops rejecting with
   * 402. The gate is per-org, so a signal on any publish route pauses all
   * five signal types.
   */
  private enterQuotaPause(retryAfterSeconds: number): void {
    this.quotaProbeIntervalSeconds = retryAfterSeconds;

    if (this.quotaPaused) {
      return;
    }

    this.quotaPaused = true;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.resetBuffer();

    this.logger.warn(
      `Mastra observability export paused: platform quota exhausted (OBSERVABILITY_QUOTA_EXCEEDED). Dropping telemetry and retrying in ${retryAfterSeconds} seconds. Check Platform billing/usage to restore telemetry.`,
    );

    this.scheduleQuotaProbe();
  }

  private scheduleQuotaProbe(): void {
    if (this.shuttingDown) {
      return;
    }

    if (this.quotaProbeTimer) {
      clearTimeout(this.quotaProbeTimer);
    }

    this.quotaProbeTimer = setTimeout(() => {
      this.quotaProbeTimer = null;
      void this.probeQuotaStatus();
    }, this.quotaProbeIntervalSeconds * 1000);

    // Don't keep the process alive just to probe; no activity means no egress burn either.
    this.quotaProbeTimer.unref?.();
  }

  /**
   * Send an empty spans batch as a free probe. The collector treats an empty
   * batch as a no-op, and an exhausted org still gets the 402 on it. A 402
   * throws out of fetchWithRetry without the Response, so the retry predicate
   * captures it to keep the retry-after hint.
   */
  private async probeQuotaStatus(): Promise<void> {
    if (this.shuttingDown || !this.quotaPaused) {
      return;
    }

    let quotaResponse: Response | undefined;

    try {
      const response = await fetchWithRetry(
        this.platformConfig.tracesEndpoint,
        {
          method: 'POST',
          headers: this.buildPublishHeaders(),
          body: this.buildPublishBody('traces', []),
        },
        1,
        {
          shouldRetryResponse: res => {
            if (isQuotaExceededResponse(res)) {
              quotaResponse = res;
            }

            // Probes are best-effort; never retry them.
            return false;
          },
        },
      );

      if (this.shuttingDown) {
        return;
      }

      if (!isObservabilityDisabled(response)) {
        this.quotaPaused = false;
        this.quotaProbeIntervalSeconds = DEFAULT_QUOTA_PROBE_INTERVAL_SECONDS;
        this.logger.warn('Mastra observability resumed: quota restored, exports re-enabled');
        return;
      }

      this.quotaProbeIntervalSeconds = parseQuotaRetryAfterSeconds(response);
    } catch {
      if (quotaResponse) {
        // Still exhausted (402); honor the collector's updated probe hint.
        this.quotaProbeIntervalSeconds = parseQuotaRetryAfterSeconds(quotaResponse);
      }
      // Otherwise the probe failed (network error or non-402 failure); stay
      // paused and try again later.
    }

    this.scheduleQuotaProbe();
  }

  private async flushSignalBatch<T>(
    signal: PlatformSignal,
    records: T[],
  ): Promise<{ signal: PlatformSignal; succeeded: boolean; authFailureStatus?: number }> {
    if (records.length === 0) {
      return { signal, succeeded: true };
    }

    try {
      await this.batchUpload(signal, records);
      return { signal, succeeded: true };
    } catch (error) {
      if (isAuthFailureError(error)) {
        return { signal, succeeded: false, authFailureStatus: error.status };
      }

      const errorId = `MASTRA_PLATFORM_EXPORTER_FAILED_TO_BATCH_UPLOAD_${signal.toUpperCase()}` as Uppercase<string>;
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
   * Force flush any buffered events without shutting down the exporter.
   * This is useful in serverless environments where you need to ensure events
   * are exported before the runtime instance is terminated.
   */
  async flush(): Promise<void> {
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
    this.shuttingDown = true;

    if (this.isDisabled) {
      return;
    }

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.quotaProbeTimer) {
      clearTimeout(this.quotaProbeTimer);
      this.quotaProbeTimer = null;
    }

    try {
      await this.flush();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `MASTRA_PLATFORM_EXPORTER_FAILED_TO_FLUSH_REMAINING_EVENTS_DURING_SHUTDOWN`,
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

    this.logger.info('MastraPlatformExporter shutdown complete');
  }
}
