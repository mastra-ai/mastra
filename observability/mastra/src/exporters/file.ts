/**
 * File Exporter for Observability
 *
 * Writes span/trace data to JSONL files for file-based observability persistence.
 * Used by AdminBundler to inject observability into deployed servers that write
 * to files that can be read by Admin Worker and inserted into ClickHouse.
 *
 * File format follows the @mastra/observability-writer convention:
 * - Path: {basePath}/span/{projectId}/{timestamp}_{uuid}.jsonl
 * - Each line: { "type": "span", "data": { ...Span } }
 *
 * This format is compatible with the IngestionWorker in @mastra/observability-clickhouse.
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

/**
 * Span record format matching @mastra/admin Span interface.
 * This is the data portion of the ObservabilityEvent envelope.
 */
interface SpanData {
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
  events: Array<{ name: string; timestamp: Date; attributes: Record<string, unknown> }>;
}

/**
 * ObservabilityEvent envelope format for JSONL files.
 * This matches the format expected by @mastra/observability-clickhouse IngestionWorker.
 */
interface SpanEvent {
  type: 'span';
  data: SpanData;
}

export class FileExporter extends BaseExporter {
  name = 'file-exporter';

  private outputPath: string;
  private projectId: string;
  private deploymentId: string;
  private maxBatchSize: number;
  private maxBatchWaitMs: number;
  private buffer: SpanEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private currentFilePath: string | null = null;

  constructor(config: FileExporterConfig) {
    super(config);

    if (!config.outputPath) {
      this.setDisabled('No outputPath provided');
      // Set defaults to avoid undefined errors
      this.outputPath = '';
      this.projectId = '';
      this.deploymentId = '';
      this.maxBatchSize = 100;
      this.maxBatchWaitMs = 5000;
      return;
    }

    if (!config.projectId) {
      this.setDisabled('No projectId provided');
      this.outputPath = '';
      this.projectId = '';
      this.deploymentId = '';
      this.maxBatchSize = 100;
      this.maxBatchWaitMs = 5000;
      return;
    }

    this.outputPath = config.outputPath;
    this.projectId = config.projectId;
    this.deploymentId = config.deploymentId ?? '';
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

  /**
   * Generate a UUID v4 (simplified implementation)
   */
  private generateUuid(): string {
    // Using crypto.randomUUID if available (Node.js 14.17+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    }

    // Fallback for older environments
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  /**
   * Format a date as ISO 8601 basic format (no separators)
   * Example: 20250123T120000Z
   */
  private formatTimestamp(date: Date): string {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  /**
   * Generate file path following @mastra/observability-writer convention:
   * {basePath}/span/{projectId}/{timestamp}_{uuid}.jsonl
   */
  private generateFilePath(): string {
    const timestamp = this.formatTimestamp(new Date());
    const uuid = this.generateUuid();
    const filename = `${timestamp}_${uuid}.jsonl`;
    return join(this.outputPath, 'span', this.projectId, filename);
  }

  /**
   * Map span type to kind. Default to 'internal' for most agent spans.
   */
  private mapTypeToKind(type: string): SpanData['kind'] {
    // Map common span types to OpenTelemetry-style kinds
    switch (type.toLowerCase()) {
      case 'server':
      case 'http_request':
      case 'request':
        return 'server';
      case 'client':
      case 'http_call':
      case 'external':
        return 'client';
      case 'producer':
      case 'publish':
        return 'producer';
      case 'consumer':
      case 'subscribe':
        return 'consumer';
      default:
        // Most Mastra spans (agent, tool, workflow) are internal operations
        return 'internal';
    }
  }

  /**
   * Convert an AnyExportedSpan to the SpanEvent format expected by IngestionWorker.
   * Wraps the span data in a { type: 'span', data: {...} } envelope.
   */
  private convertSpanToEvent(span: AnyExportedSpan): SpanEvent {
    const startTime = span.startTime instanceof Date ? span.startTime : new Date(span.startTime);
    const endTime = span.endTime instanceof Date ? span.endTime : span.endTime ? new Date(span.endTime) : null;

    // Build attributes including input/output/errorInfo for debugging
    const attributes: Record<string, unknown> = {
      ...((span.attributes as Record<string, unknown>) || {}),
      'mastra.span.type': span.type,
    };

    // Include input/output in attributes if present
    if (span.input !== undefined) {
      attributes['mastra.input'] = span.input;
    }
    if (span.output !== undefined) {
      attributes['mastra.output'] = span.output;
    }
    if (span.errorInfo !== undefined) {
      attributes['mastra.error'] = span.errorInfo;
    }
    if (span.metadata) {
      attributes['mastra.metadata'] = span.metadata;
    }

    const spanData: SpanData = {
      spanId: span.id,
      traceId: span.traceId,
      parentSpanId: span.parentSpanId ?? null,
      projectId: this.projectId,
      deploymentId: this.deploymentId,
      name: span.name,
      kind: this.mapTypeToKind(span.type),
      status: span.errorInfo ? 'error' : endTime ? 'ok' : 'unset',
      startTime,
      endTime,
      durationMs: endTime && startTime ? endTime.getTime() - startTime.getTime() : null,
      attributes,
      events: [], // Mastra spans don't typically have sub-events
    };

    return {
      type: 'span',
      data: spanData,
    };
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only export ended spans (complete data)
    if (event.type !== TracingEventType.SPAN_ENDED) {
      return;
    }

    const spanEvent = this.convertSpanToEvent(event.exportedSpan);
    this.buffer.push(spanEvent);

    // Flush if buffer is full
    if (this.buffer.length >= this.maxBatchSize) {
      await this.flushBuffer();
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const events = this.buffer;
    this.buffer = [];

    try {
      // Ensure span directory for this project exists
      // Path: {basePath}/span/{projectId}/
      const spanDir = join(this.outputPath, 'span', this.projectId);
      this.ensureDirectory(spanDir);

      // Generate file path if needed
      if (!this.currentFilePath) {
        this.currentFilePath = this.generateFilePath();
      }

      // Ensure file's parent directory exists
      this.ensureDirectory(dirname(this.currentFilePath));

      // Append events as JSONL (one JSON object per line)
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      appendFileSync(this.currentFilePath, lines);

      this.logger.debug(`Flushed ${events.length} spans to ${this.currentFilePath}`);
    } catch (err) {
      this.logger.error(`Failed to flush spans: ${err}`);
      // Re-add events to buffer for retry
      this.buffer.unshift(...events);
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
