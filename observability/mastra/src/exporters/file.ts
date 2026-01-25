/**
 * File Exporter for Observability
 *
 * Writes span/trace data to JSONL files for file-based observability persistence.
 * Used by AdminBundler to inject observability into deployed servers that write
 * to files that can be read by Admin Worker and inserted into ClickHouse.
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';

export interface FileExporterConfig extends BaseExporterConfig {
  /** Directory path to write observability files */
  outputPath: string;
  /** Project ID for file organization */
  projectId?: string;
  /** Deployment ID for file organization */
  deploymentId?: string;
  /** Maximum batch size before flush (default: 100) */
  maxBatchSize?: number;
  /** Maximum wait time before flush in ms (default: 5000) */
  maxBatchWaitMs?: number;
}

interface SpanRecord {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  type: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  status: 'ok' | 'error' | 'unset';
  input?: unknown;
  output?: unknown;
  errorInfo?: unknown;
  attributes: Record<string, unknown>;
  metadata: Record<string, unknown>;
  projectId?: string;
  deploymentId?: string;
  timestamp: string;
}

export class FileExporter extends BaseExporter {
  name = 'file-exporter';

  private outputPath: string;
  private projectId?: string;
  private deploymentId?: string;
  private maxBatchSize: number;
  private maxBatchWaitMs: number;
  private buffer: SpanRecord[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentFilePath: string | null = null;

  constructor(config: FileExporterConfig) {
    super(config);

    if (!config.outputPath) {
      this.setDisabled('No outputPath provided');
      // Set defaults to avoid undefined errors
      this.outputPath = '';
      this.maxBatchSize = 100;
      this.maxBatchWaitMs = 5000;
      return;
    }

    this.outputPath = config.outputPath;
    this.projectId = config.projectId;
    this.deploymentId = config.deploymentId;
    this.maxBatchSize = config.maxBatchSize ?? 100;
    this.maxBatchWaitMs = config.maxBatchWaitMs ?? 5000;

    // Ensure output directory exists
    this.ensureDirectory(this.outputPath);

    // Start flush timer
    this.startFlushTimer();

    this.logger.info(`FileExporter initialized: ${this.outputPath}`);
  }

  private ensureDirectory(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      this.flushBuffer().catch(err => {
        this.logger.error(`FileExporter flush timer error: ${err}`);
      });
    }, this.maxBatchWaitMs);
  }

  private generateFilePath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `spans-${timestamp}.jsonl`;
    return join(this.outputPath, 'spans', filename);
  }

  private convertSpanToRecord(span: AnyExportedSpan): SpanRecord {
    const startTime = span.startTime instanceof Date ? span.startTime : new Date(span.startTime);
    const endTime = span.endTime instanceof Date ? span.endTime : span.endTime ? new Date(span.endTime) : undefined;

    return {
      spanId: span.id,
      traceId: span.traceId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      type: span.type,
      startTime: startTime.toISOString(),
      endTime: endTime?.toISOString(),
      durationMs: endTime && startTime ? endTime.getTime() - startTime.getTime() : undefined,
      status: span.errorInfo ? 'error' : endTime ? 'ok' : 'unset',
      input: span.input,
      output: span.output,
      errorInfo: span.errorInfo,
      attributes: (span.attributes as Record<string, unknown>) || {},
      metadata: (span.metadata as Record<string, unknown>) || {},
      projectId: this.projectId,
      deploymentId: this.deploymentId,
      timestamp: new Date().toISOString(),
    };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only export ended spans (complete data)
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    const record = this.convertSpanToRecord(event.exportedSpan);
    this.buffer.push(record);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBatchSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const records = this.buffer;
    this.buffer = [];

    try {
      // Ensure spans directory exists
      const spansDir = join(this.outputPath, 'spans');
      this.ensureDirectory(spansDir);

      // Generate file path if needed
      if (!this.currentFilePath) {
        this.currentFilePath = this.generateFilePath();
      }

      // Ensure file's parent directory exists
      this.ensureDirectory(dirname(this.currentFilePath));

      // Append records as JSONL
      const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
      appendFileSync(this.currentFilePath, lines);

      this.logger.debug(`Flushed ${records.length} spans to ${this.currentFilePath}`);
    } catch (err) {
      this.logger.error(`Failed to flush spans: ${err}`);
      // Re-add records to buffer for retry
      this.buffer.unshift(...records);
    }
  }

  async flush(): Promise<void> {
    await this.flushBuffer();
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushBuffer();
    this.logger.info('FileExporter shut down');
  }
}
