import type { SpanType } from '@mastra/core/observability';

/** String values accepted by Mastra's canonical SpanType enum. */
export type TraceImportSpanType = `${SpanType}`;

/**
 * Provider-neutral span shape accepted by the trace import pipeline.
 *
 * Provider adapters must convert their source records into this shape before
 * yielding them. The shared importer never reads provider-specific records.
 */
export interface TraceImportSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: TraceImportSpanType;
  startedAt: string;
  endedAt: string;
  isEvent: boolean;
  attributes?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  tags?: string[];
  input?: unknown;
  output?: unknown;
  error?: {
    message: string;
    name?: string;
    details?: Record<string, unknown>;
  } | null;
}

/** A complete source trace after conversion into Mastra spans. */
export interface TraceImportTrace {
  /** Original provider trace ID, retained for reporting and debugging. */
  sourceTraceId: string;
  spans: TraceImportSpan[];
}

/** A source trace that an adapter could not safely convert. */
export interface SkippedTrace {
  sourceTraceId: string | null;
  spanCount: number;
  reason: string;
  detail?: string;
  traceName?: string;
  sourceSpanIds?: string[];
}

/** The only two record kinds visible to the shared importer. */
export type TraceImportRecord =
  | { kind: 'trace'; trace: TraceImportTrace; warnings?: string[] }
  | { kind: 'skipped'; skipped: SkippedTrace };

export interface TraceImportWindow {
  cutoffAt: string;
  snapshotAt: string;
}

/**
 * Non-secret source identity persisted with an import so resume can confirm it
 * is still reading the same project with the same ID strategy.
 */
export interface TraceImportSourceIdentity {
  provider: string;
  baseUrl: string;
  projectId: string;
  idAlgorithmVersion: string;
}

export interface TraceImportCounts {
  readSpans: number;
  preparedTraces: number;
  preparedSpans: number;
  skippedTraces: number;
  skippedSpans: number;
  sourceRetries: number;
  skipReasons: Record<string, number>;
}

export interface TraceImportManifest {
  schemaVersion: 1;
  importId: string;
  createdAt: string;
  updatedAt: string;
  source: TraceImportSourceIdentity;
  targetProjectId: string;
  window: TraceImportWindow;
  phase: 'preparing' | 'prepared' | 'uploading' | 'complete';
  counts: TraceImportCounts;
  preparedBytes: number;
  acknowledgedTraces: number;
  acknowledgedSpans: number;
  warnings: string[];
  skippedTraceSamples: SkippedTrace[];
  completedAt?: string;
}

/** A batch of complete traces ready for a single upload request. */
export interface PreparedTraceBatch {
  /** Zero-based index of the first trace in this batch's prepared file. */
  firstTraceIndex: number;
  traces: TraceImportTrace[];
  spanCount: number;
  payloadBytes: number;
}
