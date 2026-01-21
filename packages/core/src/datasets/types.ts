import { z } from 'zod';
import { dbTimestamps, paginationInfoSchema } from '../storage/domains/shared';

// ============================================================================
// Dataset
// ============================================================================

export const datasetSchema = z.object({
  id: z.string().describe('Unique dataset identifier'),
  name: z.string().describe('Human-readable dataset name'),
  description: z.string().optional().describe('Dataset description'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
  ...dbTimestamps,
});

export type Dataset = z.infer<typeof datasetSchema>;

export const createDatasetPayloadSchema = datasetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDatasetPayload = z.infer<typeof createDatasetPayloadSchema>;

export const updateDatasetPayloadSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateDatasetPayload = z.infer<typeof updateDatasetPayloadSchema>;

// ============================================================================
// Dataset Item
// ============================================================================

export const datasetItemSchema = z.object({
  id: z.string().describe('Unique item identifier'),
  datasetId: z.string().describe('Parent dataset ID'),
  input: z.unknown().describe('Input data for evaluation'),
  expectedOutput: z.unknown().optional().describe('Expected output for comparison'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
  sourceTraceId: z.string().optional().describe('Trace ID if captured from production'),
  sourceSpanId: z.string().optional().describe('Span ID if captured from production'),
  archivedAt: z.date().nullable().optional().describe('Soft delete timestamp for versioning'),
  ...dbTimestamps,
});

export type DatasetItem = z.infer<typeof datasetItemSchema>;

export const createDatasetItemPayloadSchema = datasetItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export type CreateDatasetItemPayload = z.infer<typeof createDatasetItemPayloadSchema>;

export const updateDatasetItemPayloadSchema = z.object({
  input: z.unknown().optional(),
  expectedOutput: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateDatasetItemPayload = z.infer<typeof updateDatasetItemPayloadSchema>;

// ============================================================================
// Dataset Run
// ============================================================================

export const datasetRunTargetTypeSchema = z.enum(['AGENT', 'WORKFLOW', 'CUSTOM']);

export type DatasetRunTargetType = z.infer<typeof datasetRunTargetTypeSchema>;

export const datasetRunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type DatasetRunStatus = z.infer<typeof datasetRunStatusSchema>;

export const datasetRunSchema = z.object({
  id: z.string().describe('Unique run identifier'),
  datasetId: z.string().describe('Dataset being evaluated'),
  name: z.string().optional().describe('Optional run name'),
  targetType: datasetRunTargetTypeSchema.describe('Type of target being evaluated'),
  targetId: z.string().optional().describe('ID of the target (agent/workflow name)'),
  scorerIds: z.array(z.string()).describe('Scorers used in this run'),
  status: datasetRunStatusSchema.describe('Current run status'),
  itemCount: z.number().int().describe('Total items in dataset at run start'),
  completedCount: z.number().int().describe('Items processed so far'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
  createdAt: z.date().describe('Run start time'),
  completedAt: z.date().nullable().optional().describe('Run completion time'),
});

export type DatasetRun = z.infer<typeof datasetRunSchema>;

export const createDatasetRunPayloadSchema = datasetRunSchema.omit({
  id: true,
  createdAt: true,
  completedAt: true,
  completedCount: true,
  status: true,
});

export type CreateDatasetRunPayload = z.infer<typeof createDatasetRunPayloadSchema>;

export const updateDatasetRunPayloadSchema = z.object({
  status: datasetRunStatusSchema.optional(),
  completedCount: z.number().int().optional(),
  completedAt: z.date().nullable().optional(),
});

export type UpdateDatasetRunPayload = z.infer<typeof updateDatasetRunPayloadSchema>;

// ============================================================================
// Dataset Run Result
// ============================================================================

export const datasetRunResultStatusSchema = z.enum(['success', 'error']);

export type DatasetRunResultStatus = z.infer<typeof datasetRunResultStatusSchema>;

export const datasetRunResultSchema = z.object({
  id: z.string().describe('Unique result identifier'),
  runId: z.string().describe('Parent run ID'),
  itemId: z.string().describe('Dataset item ID'),
  actualOutput: z.unknown().nullable().describe('Output from target execution (null on error)'),
  traceId: z.string().optional().describe('Trace ID of execution'),
  spanId: z.string().optional().describe('Span ID of execution'),
  status: datasetRunResultStatusSchema.describe('Execution status'),
  error: z.string().optional().describe('Error message if failed'),
  durationMs: z.number().optional().describe('Execution duration in milliseconds'),
  createdAt: z.date().describe('Result creation time'),
});

export type DatasetRunResult = z.infer<typeof datasetRunResultSchema>;

export const createDatasetRunResultPayloadSchema = datasetRunResultSchema.omit({
  id: true,
  createdAt: true,
});

export type CreateDatasetRunResultPayload = z.infer<typeof createDatasetRunResultPayloadSchema>;

// ============================================================================
// List Responses
// ============================================================================

export const listDatasetsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  datasets: z.array(datasetSchema),
});

export type ListDatasetsResponse = z.infer<typeof listDatasetsResponseSchema>;

export const listDatasetItemsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  items: z.array(datasetItemSchema),
});

export type ListDatasetItemsResponse = z.infer<typeof listDatasetItemsResponseSchema>;

export const listDatasetRunsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  runs: z.array(datasetRunSchema),
});

export type ListDatasetRunsResponse = z.infer<typeof listDatasetRunsResponseSchema>;

export const listDatasetRunResultsResponseSchema = z.object({
  pagination: paginationInfoSchema,
  results: z.array(datasetRunResultSchema),
});

export type ListDatasetRunResultsResponse = z.infer<typeof listDatasetRunResultsResponseSchema>;

// ============================================================================
// Query Options
// ============================================================================

export type ListDatasetItemsOptions = {
  datasetId: string;
  /** Point-in-time query - returns items as they existed at this timestamp */
  asOf?: Date;
  /** Include archived items (default: false) */
  includeArchived?: boolean;
};

export type ListDatasetRunsOptions = {
  datasetId?: string;
  status?: DatasetRunStatus;
};

export type ListDatasetRunResultsOptions = {
  runId: string;
  status?: DatasetRunResultStatus;
};

// ============================================================================
// Trace Capture Types
// ============================================================================

export type SpanFilterFn = (span: {
  spanId: string;
  spanType?: string;
  name?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}) => boolean;

export type CaptureToDatasetOptions = {
  datasetId: string;
  /** Filter which spans to capture */
  spanFilter?: SpanFilterFn;
  /** Transform span data before saving */
  transform?: (span: { input: unknown; output: unknown; metadata?: Record<string, unknown> }) => {
    input: unknown;
    expectedOutput?: unknown;
    metadata?: Record<string, unknown>;
  };
};

// ============================================================================
// Run Dataset Types
// ============================================================================

export type DatasetRunTarget =
  | { type: 'agent'; agentId: string }
  | { type: 'workflow'; workflowId: string }
  | { type: 'custom'; fn: (input: unknown) => Promise<unknown> };

export type RunDatasetOptions = {
  datasetId: string;
  target: DatasetRunTarget;
  scorerIds?: string[];
  /** Run name for identification */
  name?: string;
  /** Progress callback */
  onProgress?: (completed: number, total: number) => void;
  /** Concurrency limit (default: 1) */
  concurrency?: number;
  /** Point-in-time - run against dataset as it existed at this timestamp */
  asOf?: Date;
  /** Custom metadata for the run */
  metadata?: Record<string, unknown>;
};

export type RunDatasetResult = {
  run: DatasetRun;
  results: DatasetRunResult[];
  /** Aggregated scores by scorer ID */
  scores?: Record<string, { mean: number; count: number }>;
};
