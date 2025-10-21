import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import { fetchWithRetry } from '../../utils';
import { AITracingEventType } from '../types';
import type { AITracingEvent, AnyExportedAISpan } from '../types';
import { BufferedAITracingExporter } from './base';
import type { BufferedExporterConfig } from './base';

export interface CloudExporterConfig extends BufferedExporterConfig {
  // Cloud-specific configuration
  accessToken?: string; // Cloud access token (from env or config)
  endpoint?: string; // Cloud AI tracing endpoint
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

export class CloudExporter extends BufferedAITracingExporter<MastraCloudSpanRecord> {
  name = 'mastra-cloud-ai-tracing-exporter';

  private accessToken: string;
  private endpoint: string;

  constructor(config: CloudExporterConfig = {}) {
    super(config);

    const accessToken = config.accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    if (!accessToken) {
      this.setDisabled(
        'MASTRA_CLOUD_ACCESS_TOKEN environment variable not set. ' +
          '🚀 Sign up for Mastra Cloud at https://cloud.mastra.ai to see your AI traces online and obtain your access token.',
      );
      this.accessToken = '';
      this.endpoint = '';
      return;
    }

    this.accessToken = accessToken;
    this.endpoint =
      config.endpoint ?? process.env.MASTRA_CLOUD_AI_TRACES_ENDPOINT ?? 'https://api.mastra.ai/ai/spans/publish';
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    // Skip if disabled due to missing token
    if (this.isDisabled) {
      return;
    }

    // Cloud AI Observability only process SPAN_ENDED events
    if (event.type !== AITracingEventType.SPAN_ENDED) {
      return;
    }

    const spanRecord = this.formatSpan(event.exportedSpan);
    this.addToBuffer(spanRecord);

    if (this.shouldFlush()) {
      this.flush().catch(error => {
        this.logger.error('Batch flush failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    } else if (this.buffer.length === 1) {
      this.scheduleFlush();
    }
  }

  private formatSpan(span: AnyExportedAISpan): MastraCloudSpanRecord {
    const spanRecord: MastraCloudSpanRecord = {
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

    return spanRecord;
  }

  /**
   * Flush buffer implementation - uploads spans to cloud API
   */
  protected async flushBuffer(spans: MastraCloudSpanRecord[]): Promise<void> {
    try {
      await this.batchUpload(spans);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `CLOUD_AI_TRACING_FAILED_TO_BATCH_UPLOAD`,
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.USER,
          details: {
            droppedBatchSize: spans.length,
          },
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error('Batch upload failed after all retries, dropping batch', mastraError);
      throw error;
    }
  }

  /**
   * Uploads spans to cloud API using fetchWithRetry for all retry logic
   */
  private async batchUpload(spans: MastraCloudSpanRecord[]): Promise<void> {
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify({ spans }),
    };

    await fetchWithRetry(this.endpoint, options, this.config.maxRetries);
  }
}
