import type { LangfuseObservation } from './providers/langfuse/schema.js';
import type { CollectorSpan } from './target/collector-schema.js';

export const TRACE_IMPORT_SCHEMA_VERSION = 1;
export const TRACE_IMPORT_MAPPER_VERSION = 'langfuse-api-v2@1';
export const TRACE_IMPORT_ID_ALGORITHM_VERSION = 'langfuse-sha256-v1';
export const TRACE_IMPORT_SHARD_COUNT = 64;
export const TRACE_IMPORT_FIELDS = 'core,basic,time,io,metadata,model,usage,prompt,metrics,trace_context';
export const DEFAULT_SOURCE_PAGE_SIZE = 1000;
export const DEFAULT_TARGET_BATCH_SIZE = 100;
export const MAX_TARGET_BATCH_SIZE = 1000;
export const DEFAULT_TARGET_BATCH_BYTES = 4 * 1024 * 1024;
export const DEFAULT_MAX_SOURCE_SPOOL_BYTES = 5 * 1024 * 1024 * 1024;
export const DEFAULT_RETENTION_DAYS = 30;
export const DEFAULT_VERIFICATION_SAMPLE_SIZE = 10;
export const DEFAULT_VERIFICATION_MAX_ATTEMPTS = 6;

export type TraceSkipReason =
  | 'missing_trace_id'
  | 'mixed_project_ids'
  | 'duplicate_observation_id'
  | 'missing_root'
  | 'multiple_roots'
  | 'missing_parent'
  | 'cycle'
  | 'invalid_timestamp'
  | 'incomplete_duration'
  | 'completed_after_snapshot'
  | 'root_outside_window'
  | 'oversized_span';

export interface AssembledTrace {
  sourceTraceId: string;
  projectId: string;
  observations: LangfuseObservation[];
}

export interface SkippedTrace {
  sourceTraceId: string | null;
  observationCount: number;
  reason: TraceSkipReason;
  detail?: string;
}

export interface TraceAssemblyResult {
  traces: AssembledTrace[];
  skipped: SkippedTrace[];
}

export interface ImportBatchManifest {
  index: number;
  file: string;
  spanCount: number;
  byteLength: number;
  sha256: string;
  status: 'pending' | 'acknowledged';
  attempts: number;
  acknowledgedAt?: string;
}

export interface TraceVerificationSample {
  traceId: string;
  spanIds: string[];
}

export interface TraceImportVerification {
  status: 'not-performed' | 'verified' | 'partial' | 'timed-out' | 'unavailable';
  reason?: string;
  sampledTraces: number;
  verifiedTraces: number;
  attempts: number;
  samples: TraceVerificationSample[];
}

export interface TraceImportManifest {
  schemaVersion: number;
  mapperVersion: string;
  idAlgorithmVersion: string;
  shardCount: number;
  importId: string;
  provider: 'langfuse';
  createdAt: string;
  updatedAt: string;
  snapshotAt: string;
  cutoffAt: string;
  fields: string;
  source: {
    baseUrl: string;
    projectId?: string;
    cursor?: string;
    complete: boolean;
    pageCount: number;
    observationCount: number;
    spoolBytes: number;
    unknownObservationTypes: string[];
  };
  target: {
    projectId: string;
    collectorOrigin: string;
    environment?: string;
    warnings: Array<{ code: string; message: string; count?: number }>;
  };
  phase: 'reading' | 'planned' | 'uploading' | 'complete' | 'paused';
  counts: {
    readSpans: number;
    eligibleTraces: number;
    eligibleSpans: number;
    skippedTraces: number;
    skippedSpans: number;
    enqueuedSpans: number;
    verifiedTraces: number;
    truncationRiskSpans: number;
    sourceRetries: number;
    targetRetries: number;
    skipReasons: Partial<Record<TraceSkipReason, number>>;
  };
  estimatedPayloadBytes: number;
  batches: ImportBatchManifest[];
  verification: TraceImportVerification;
  lastError?: {
    stage: 'source' | 'target';
    message: string;
    at: string;
  };
}

export interface TraceImportReport {
  importId: string;
  stateDirectory: string;
  snapshotAt: string;
  cutoffAt: string;
  sourceBaseUrl: string;
  sourceProjectId?: string;
  targetProjectId: string;
  collectorOrigin: string;
  environment?: string;
  counts: TraceImportManifest['counts'];
  estimatedPayloadBytes: number;
  status: 'dry-run' | 'cancelled' | 'complete' | 'paused';
  verification: Omit<TraceImportVerification, 'samples'>;
  warnings: string[];
  consistencyWarning: string;
}

export interface PlannedTrace {
  sourceTraceId: string;
  spans: CollectorSpan[];
}
