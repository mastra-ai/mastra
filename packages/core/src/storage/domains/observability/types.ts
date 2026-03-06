// ============================================================================
// Storage Strategy Types
// ============================================================================

/** Strategy for how tracing data is persisted to storage */
export type TracingStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only' | 'span-events';

/** Strategy for how log data is persisted to storage */
export type LogsStorageStrategy = 'realtime' | 'batch';

/** Strategy for how metric data is persisted to storage */
export type MetricsStorageStrategy = 'realtime' | 'batch';

/** Strategy for how score data is persisted to storage */
export type ScoresStorageStrategy = 'realtime';

/** Strategy for how feedback data is persisted to storage */
export type FeedbackStorageStrategy = 'realtime';

// ============================================================================
// Re-export all tracing schemas for backward compatibility
// ============================================================================

export * from './tracing';
