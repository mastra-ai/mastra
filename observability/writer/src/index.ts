/**
 * @mastra/observability-writer
 *
 * Observability event writer for MastraAdmin.
 * Batches and writes traces, spans, logs, metrics, and scores to file storage as JSONL files.
 *
 * @packageDocumentation
 */

// Main class
export { ObservabilityWriter } from './writer.js';

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

// Serializer utilities (for advanced usage and testing)
export {
  serializeEvent,
  serializeEvents,
  serializeEventsToBuffer,
  estimateEventSize,
  parseJsonl,
} from './serializer.js';

// File naming utilities (for advanced usage and testing)
export {
  generateFilePath,
  generateDirectoryPath,
  parseFilePath,
  isPendingFile,
  getProcessedFilePath,
} from './file-naming.js';

// Batcher (for advanced usage)
export { EventBatcher, type EventBatcherConfig } from './batcher.js';
