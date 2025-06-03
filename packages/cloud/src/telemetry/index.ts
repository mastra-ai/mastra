import type { IMastraLogger } from '@mastra/core/logger';
import { ExportResultCode } from '@opentelemetry/core';
import type { ExportResult } from '@opentelemetry/core';
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

import { fetchWithRetry } from '../utils/fetchWithRetry';

export type MastraCloudExporterOptions = {
  accessToken?: string;
  endpoint?: string;
  logger?: IMastraLogger;
};

class MastraCloudExporter implements SpanExporter {
  private queue: { data: any[]; resultCallback: (result: ExportResult) => void }[] = [];
  private serializer: typeof JsonTraceSerializer;
  private activeFlush: Promise<void> | undefined = undefined;
  private accessToken: string;
  private endpoint: string;
  private logger?: IMastraLogger;

  constructor({ accessToken, endpoint, logger }: MastraCloudExporterOptions = {}) {
    if (!accessToken && !process.env.MASTRA_CLOUD_ACCESS_TOKEN) {
      throw new Error('Mastra Cloud Access Token is required');
    }

    if (!endpoint && !process.env.MASTRA_CLOUD_ENDPOINT) {
      throw new Error('Mastra Cloud Endpoint is required');
    }

    this.accessToken = accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN!;
    this.endpoint = endpoint ?? process.env.MASTRA_CLOUD_ENDPOINT!;
    this.serializer = JsonTraceSerializer;

    if (logger) {
      this.logger = logger;
    }
  }

  export(internalRepresentation: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const serializedRequest = this.serializer.serializeRequest(internalRepresentation);
    // @ts-ignore
    const payload = JSON.parse(Buffer.from(serializedRequest.buffer, 'utf8'));
    const items = payload?.resourceSpans?.[0]?.scopeSpans;
    this.logger?.debug(`Exporting telemetry: ${items.length} scope spans to be processed [trace batch]`);

    this.queue.push({ data: items, resultCallback });

    if (!this.activeFlush) {
      this.activeFlush = this.flush();
    }
  }

  shutdown(): Promise<void> {
    return this.forceFlush();
  }

  private async batchInsert({ records }: { records: any[] }): Promise<void> {
    const url = this.endpoint;
    if (!url) {
      this.logger?.error('Mastra Cloud telemetry endpoint is not defined');
      return;
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify({ records }),
    };

    fetchWithRetry(url, options, 3).catch(error => {
      this.logger?.error(`Telemetry batch upload failed: ${error.message}`);
    });
  }

  flush(): Promise<void> {
    const items = this.queue.shift();
    if (!items) return Promise.resolve();

    return this.batchInsert({
      records: items.data,
    })
      .then(() => {
        items.resultCallback({
          code: ExportResultCode.SUCCESS,
        });
      })
      .catch(e => {
        this.logger?.error('span err:' + e?.message);
        items.resultCallback({
          code: ExportResultCode.FAILED,
          error: e,
        });
      })
      .finally(() => {
        this.activeFlush = undefined;
      });
  }
  async forceFlush(): Promise<void> {
    if (!this.queue.length) {
      return;
    }

    await this.activeFlush;
    while (this.queue.length) {
      await this.flush();
    }
  }

  __setLogger(logger: IMastraLogger) {
    this.logger = logger;
  }
}

export { MastraCloudExporter };
