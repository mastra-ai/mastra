// ============================================================================
// Storage Strategy Types
// ============================================================================

/** @deprecated Use ObservabilityStorageStrategy instead. */
export type TracingStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only' | 'event-sourced';

/** Strategy for how observability data is persisted to storage. */
export type ObservabilityStorageStrategy = 'realtime' | 'batch-with-updates' | 'insert-only' | 'event-sourced';
