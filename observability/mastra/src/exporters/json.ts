/**
 * Backward-compatibility re-exports.
 *
 * The TestExporter (formerly JsonExporter) now lives in test.ts.
 * This file preserves imports from './json' for existing consumers.
 */
export {
  TestExporter,
  JsonExporter,
  type TestExporterConfig,
  type TestExporterStats,
  type TestExporterInternalMetrics,
  type JsonExporterConfig,
  type JsonExporterStats,
  type JsonExporterInternalMetrics,
  type SpanTreeNode,
  type NormalizedSpan,
  type NormalizedTreeNode,
  type IncompleteSpanInfo,
} from './test';
