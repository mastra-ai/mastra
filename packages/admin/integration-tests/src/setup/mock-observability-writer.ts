import type { ObservabilityWriterInterface, Trace, Span, Log, Metric, Score, ObservabilityEvent } from '@mastra/admin';
import type { LocalFileStorage } from './mock-file-storage.js';

/**
 * Observability writer implementation for integration testing.
 *
 * Writes observability events to JSONL files via the file storage provider.
 * Events are buffered and written in batches for efficiency.
 */
export class MockObservabilityWriter implements ObservabilityWriterInterface {
  private fileStorage: LocalFileStorage;
  private batchSize: number;
  private flushIntervalMs: number;
  private maxFileSize: number;

  // Event buffers by type
  private traceBuffer: Trace[] = [];
  private spanBuffer: Span[] = [];
  private logBuffer: Log[] = [];
  private metricBuffer: Metric[] = [];
  private scoreBuffer: Score[] = [];

  // File counters for unique file names
  private fileCounters: Record<string, number> = {};

  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: {
    fileStorage: LocalFileStorage;
    batchSize?: number;
    flushIntervalMs?: number;
    maxFileSize?: number;
  }) {
    this.fileStorage = config.fileStorage;
    this.batchSize = config.batchSize ?? 100;
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;
    this.maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB

    // Start auto-flush timer if interval > 0
    if (this.flushIntervalMs > 0) {
      this.startAutoFlush();
    }
  }

  /**
   * Record a trace event.
   */
  recordTrace(trace: Trace): void {
    if (this.isShuttingDown) return;
    this.traceBuffer.push(trace);
    this.checkBufferSize('trace', this.traceBuffer);
  }

  /**
   * Record a span event.
   */
  recordSpan(span: Span): void {
    if (this.isShuttingDown) return;
    this.spanBuffer.push(span);
    this.checkBufferSize('span', this.spanBuffer);
  }

  /**
   * Record a log event.
   */
  recordLog(log: Log): void {
    if (this.isShuttingDown) return;
    this.logBuffer.push(log);
    this.checkBufferSize('log', this.logBuffer);
  }

  /**
   * Record a metric event.
   */
  recordMetric(metric: Metric): void {
    if (this.isShuttingDown) return;
    this.metricBuffer.push(metric);
    this.checkBufferSize('metric', this.metricBuffer);
  }

  /**
   * Record a score event.
   */
  recordScore(score: Score): void {
    if (this.isShuttingDown) return;
    this.scoreBuffer.push(score);
    this.checkBufferSize('score', this.scoreBuffer);
  }

  /**
   * Record multiple events at once.
   */
  recordEvents(events: ObservabilityEvent[]): void {
    if (this.isShuttingDown) return;

    for (const event of events) {
      switch (event.type) {
        case 'trace':
          this.recordTrace(event.data);
          break;
        case 'span':
          this.recordSpan(event.data);
          break;
        case 'log':
          this.recordLog(event.data);
          break;
        case 'metric':
          this.recordMetric(event.data);
          break;
        case 'score':
          this.recordScore(event.data);
          break;
      }
    }
  }

  /**
   * Force flush all pending events to file storage.
   */
  async flush(): Promise<void> {
    await Promise.all([
      this.flushBuffer('trace', this.traceBuffer),
      this.flushBuffer('span', this.spanBuffer),
      this.flushBuffer('log', this.logBuffer),
      this.flushBuffer('metric', this.metricBuffer),
      this.flushBuffer('score', this.scoreBuffer),
    ]);

    // Clear buffers
    this.traceBuffer = [];
    this.spanBuffer = [];
    this.logBuffer = [];
    this.metricBuffer = [];
    this.scoreBuffer = [];
  }

  /**
   * Gracefully shutdown the writer.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Check if buffer has reached batch size and trigger async flush.
   */
  private checkBufferSize(type: string, buffer: unknown[]): void {
    if (buffer.length >= this.batchSize) {
      // Trigger async flush
      void this.flushBuffer(type, buffer).then(() => {
        // Clear the buffer after flush
        buffer.length = 0;
      });
    }
  }

  /**
   * Flush a specific buffer to file storage.
   */
  private async flushBuffer(type: string, buffer: unknown[]): Promise<void> {
    if (buffer.length === 0) return;

    // Group events by projectId
    const eventsByProject = new Map<string, unknown[]>();

    for (const event of buffer) {
      const projectId = (event as { projectId: string }).projectId;
      const existing = eventsByProject.get(projectId) ?? [];
      existing.push(event);
      eventsByProject.set(projectId, existing);
    }

    // Write each project's events to a file
    for (const [projectId, events] of eventsByProject) {
      const filePath = this.generateFilePath(type, projectId);
      const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      await this.fileStorage.append(filePath, content);
    }
  }

  /**
   * Generate a file path for a batch of events.
   */
  private generateFilePath(type: string, projectId: string): string {
    const key = `${type}/${projectId}`;
    const counter = this.fileCounters[key] ?? 0;
    this.fileCounters[key] = counter + 1;

    const timestamp = Date.now();
    return `${type}/${projectId}/${timestamp}-${counter}.jsonl`;
  }

  /**
   * Start the auto-flush timer.
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Get buffer sizes (for testing).
   */
  getBufferSizes(): Record<string, number> {
    return {
      trace: this.traceBuffer.length,
      span: this.spanBuffer.length,
      log: this.logBuffer.length,
      metric: this.metricBuffer.length,
      score: this.scoreBuffer.length,
    };
  }

  /**
   * Check if any buffers have pending events (for testing).
   */
  hasPendingEvents(): boolean {
    return (
      this.traceBuffer.length > 0 ||
      this.spanBuffer.length > 0 ||
      this.logBuffer.length > 0 ||
      this.metricBuffer.length > 0 ||
      this.scoreBuffer.length > 0
    );
  }
}
