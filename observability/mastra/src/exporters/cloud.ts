import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { LogLevel } from '@mastra/core/logger';
import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import { fetchWithRetry } from '@mastra/core/utils';
import type { BufferedExporterConfig } from './buffered';
import { BufferedExporter } from './buffered';

export interface CloudExporterConfig extends BufferedExporterConfig {
  // Cloud-specific configuration
  accessToken?: string; // Cloud access token (from env or config)
  endpoint?: string; // Cloud observability endpoint
}

interface MastraCloudSpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  attributes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  startedAt: Date;
  endedAt: Date | null;
  input: any;
  output: any;
  error: any;
  isEvent: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export class CloudExporter extends BufferedExporter<MastraCloudSpanRecord> {
  name = 'mastra-cloud-observability-exporter';

  private accessToken: string;
  private endpoint: string;
  private buffer: MastraCloudSpanRecord[] = [];
  private cloudMaxRetries: number;

  constructor(config: CloudExporterConfig = {}) {
    // Set base class maxRetries to 0 to disable base retry logic
    // CloudExporter handles retries via fetchWithRetry instead
    super({
      ...config,
      maxBatchSize: config.maxBatchSize ?? 1000,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5000,
      maxRetries: 0, // Disable base class retry - we use fetchWithRetry
      logLevel: config.logLevel ?? LogLevel.INFO,
    });

    // Store maxRetries for use with fetchWithRetry
    this.cloudMaxRetries = config.maxRetries ?? 3;

    const accessToken = config.accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    if (!accessToken) {
      this.setDisabled(
        'MASTRA_CLOUD_ACCESS_TOKEN environment variable not set.\n' +
          '🚀 Sign up at https://cloud.mastra.ai to see your AI traces online and obtain your access token.',
      );
    }

    this.accessToken = accessToken || '';
    this.endpoint =
      config.endpoint ?? process.env.MASTRA_CLOUD_TRACES_ENDPOINT ?? 'https://api.mastra.ai/ai/spans/publish';
  }

  /**
   * Process an event - only SPAN_ENDED events are sent to Cloud.
   */
  protected processEvent(event: TracingEvent): boolean {
    // Cloud Observability only processes SPAN_ENDED events
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return false;
    }

    const spanRecord = this.formatSpan(event.exportedSpan);
    this.buffer.push(spanRecord);
    this.updateBufferSize(this.buffer.length);
    return true;
  }

  /**
   * Send a batch of spans to the cloud API.
   */
  protected async sendBatch(spans: MastraCloudSpanRecord[]): Promise<void> {
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify({ spans }),
    };

    try {
      await fetchWithRetry(this.endpoint, options, this.cloudMaxRetries);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `CLOUD_EXPORTER_FAILED_TO_BATCH_UPLOAD`,
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.USER,
          details: {
            droppedBatchSize: spans.length,
          },
        },
        error,
      );
      this.logger.trackException(mastraError);
      throw mastraError;
    }
  }

  /**
   * Get the current buffer size.
   */
  protected getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Extract and reset the buffer.
   */
  protected extractAndResetBuffer(): MastraCloudSpanRecord[] {
    const spans = this.buffer;
    this.buffer = [];
    return spans;
  }

  /**
   * Format a span for the cloud API.
   */
  private formatSpan(span: AnyExportedSpan): MastraCloudSpanRecord {
    return {
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      spanType: span.type,
      attributes: span.attributes ?? null,
      metadata: span.metadata ?? null,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      input: span.input ?? null,
      output: span.output ?? null,
      error: span.errorInfo,
      isEvent: span.isEvent,
      createdAt: new Date(),
      updatedAt: null,
    };
  }

  async shutdown(): Promise<void> {
    // Skip if disabled
    if (this.isDisabled) {
      return;
    }

    try {
      await super.shutdown();
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `CLOUD_EXPORTER_FAILED_TO_FLUSH_REMAINING_EVENTS_DURING_SHUTDOWN`,
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.USER,
          details: {
            remainingEvents: this.getBufferSize(),
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
