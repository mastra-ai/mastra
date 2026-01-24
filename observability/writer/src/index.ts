/**
 * @mastra/observability-writer
 *
 * Observability event writer for MastraAdmin.
 * Batches and writes traces, spans, logs, metrics, and scores to file storage as JSONL files.
 *
 * @packageDocumentation
 */

// Types
export type {
  // Configuration
  ObservabilityWriterConfig,

  // Event types (re-exported from @mastra/admin)
  Trace,
  Span,
  SpanEvent,
  Log,
  Metric,
  Score,
  ObservabilityEvent,
  ObservabilityEventType,

  // File storage (re-exported from @mastra/admin)
  FileStorageProvider,
  FileInfo,

  // Writer types
  EventBuffer,
  FlushResult,
  FlushError,
  WriterStats,
} from './types.js';
