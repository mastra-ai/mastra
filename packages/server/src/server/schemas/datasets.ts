import z from 'zod';
import { paginationInfoSchema } from './common';

// ============================================================================
// JSON Schema Types (for inputSchema/outputSchema fields)
// ============================================================================

// JSON Schema type (simplified for storage - full spec too complex)
const jsonSchemaObject: z.ZodType<Record<string, unknown>> = z.lazy(() => z.record(z.unknown()));

// JSON Schema field (object or null to disable)
const jsonSchemaField = z.union([jsonSchemaObject, z.null()]).optional();

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const datasetIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
});

export const runIdPathParams = z.object({
  runId: z.string().describe('Unique identifier for the run'),
});

export const itemIdPathParams = z.object({
  itemId: z.string().describe('Unique identifier for the dataset item'),
});

export const datasetAndRunIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  runId: z.string().describe('Unique identifier for the run'),
});

export const datasetAndItemIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  itemId: z.string().describe('Unique identifier for the dataset item'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
});

export const listItemsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  version: z.coerce.date().optional(), // Optional version filter for snapshot semantics
  search: z.string().optional(), // Optional search term for input/expectedOutput
});

// ============================================================================
// Request Body Schemas
// ============================================================================

export const createDatasetBodySchema = z.object({
  name: z.string().describe('Name of the dataset'),
  description: z.string().optional().describe('Description of the dataset'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  inputSchema: jsonSchemaField.describe('JSON Schema for validating item input'),
  outputSchema: jsonSchemaField.describe('JSON Schema for validating item expectedOutput'),
});

export const updateDatasetBodySchema = z.object({
  name: z.string().optional().describe('Name of the dataset'),
  description: z.string().optional().describe('Description of the dataset'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  inputSchema: jsonSchemaField.describe('JSON Schema for validating item input'),
  outputSchema: jsonSchemaField.describe('JSON Schema for validating item expectedOutput'),
});

export const addItemBodySchema = z.object({
  input: z.unknown().describe('Input data for the dataset item'),
  expectedOutput: z.unknown().optional().describe('Expected output for comparison'),
  context: z.record(z.string(), z.unknown()).optional().describe('Additional context'),
});

export const updateItemBodySchema = z.object({
  input: z.unknown().optional().describe('Input data for the dataset item'),
  expectedOutput: z.unknown().optional().describe('Expected output for comparison'),
  context: z.record(z.string(), z.unknown()).optional().describe('Additional context'),
});

export const triggerRunBodySchema = z.object({
  targetType: z.enum(['agent', 'workflow', 'scorer']).describe('Type of target to run against'),
  targetId: z.string().describe('ID of the target'),
  scorerIds: z.array(z.string()).optional().describe('IDs of scorers to apply'),
  version: z.coerce.date().optional().describe('Pin to specific dataset version'),
  maxConcurrency: z.number().optional().describe('Maximum concurrent executions'),
});

export const compareRunsBodySchema = z.object({
  runIdA: z.string().describe('ID of baseline run'),
  runIdB: z.string().describe('ID of candidate run'),
  thresholds: z
    .record(
      z.string(),
      z.object({
        value: z.number().describe('Threshold value for regression detection'),
        direction: z.enum(['higher-is-better', 'lower-is-better']).optional().describe('Score direction'),
      }),
    )
    .optional()
    .describe('Per-scorer threshold configuration'),
});

// ============================================================================
// Response Schemas
// ============================================================================

// Dataset entity schema
export const datasetResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  inputSchema: z.record(z.unknown()).optional().nullable(),
  outputSchema: z.record(z.unknown()).optional().nullable(),
  version: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Dataset item entity schema
export const datasetItemResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.coerce.date(),
  input: z.unknown(),
  expectedOutput: z.unknown().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Run entity schema
export const runResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  datasetVersion: z.coerce.date(),
  targetType: z.enum(['agent', 'workflow', 'scorer', 'processor']),
  targetId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  totalItems: z.number(),
  succeededCount: z.number(),
  failedCount: z.number(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Scorer result schema
export const scorerResultSchema = z.object({
  scorerId: z.string(),
  scorerName: z.string(),
  score: z.number().nullable(),
  reason: z.string().nullable(),
  error: z.string().nullable(),
});

// Run result entity schema
export const runResultResponseSchema = z.object({
  id: z.string(),
  runId: z.string(),
  itemId: z.string(),
  itemVersion: z.coerce.date(),
  input: z.unknown(),
  output: z.unknown().nullable(),
  expectedOutput: z.unknown().nullable(),
  latency: z.number(),
  error: z.string().nullable(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  retryCount: z.number(),
  traceId: z.string().nullable(),
  scores: z.array(scorerResultSchema),
  createdAt: z.coerce.date(),
});

// Scorer stats schema
const scorerStatsSchema = z.object({
  errorRate: z.number(),
  errorCount: z.number(),
  passRate: z.number(),
  passCount: z.number(),
  avgScore: z.number(),
  scoreCount: z.number(),
  totalItems: z.number(),
});

// Scorer comparison schema
const scorerComparisonSchema = z.object({
  statsA: scorerStatsSchema,
  statsB: scorerStatsSchema,
  delta: z.number(),
  regressed: z.boolean(),
  threshold: z.number(),
});

// Item comparison schema
const itemComparisonSchema = z.object({
  itemId: z.string(),
  inBothRuns: z.boolean(),
  scoresA: z.record(z.string(), z.number().nullable()),
  scoresB: z.record(z.string(), z.number().nullable()),
});

// Comparison result schema
export const comparisonResponseSchema = z.object({
  runA: z.object({
    id: z.string(),
    datasetVersion: z.coerce.date(),
  }),
  runB: z.object({
    id: z.string(),
    datasetVersion: z.coerce.date(),
  }),
  versionMismatch: z.boolean(),
  hasRegression: z.boolean(),
  scorers: z.record(z.string(), scorerComparisonSchema),
  items: z.array(itemComparisonSchema),
  warnings: z.array(z.string()),
});

// Run summary schema (returned by trigger run)
// Note: completedAt is nullable for pending/running runs (async trigger)
export const runSummaryResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  totalItems: z.number(),
  succeededCount: z.number(),
  failedCount: z.number(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  results: z.array(
    z.object({
      itemId: z.string(),
      itemVersion: z.coerce.date(),
      input: z.unknown(),
      output: z.unknown().nullable(),
      expectedOutput: z.unknown().nullable(),
      latency: z.number(),
      error: z.string().nullable(),
      startedAt: z.coerce.date(),
      completedAt: z.coerce.date(),
      retryCount: z.number(),
      scores: z.array(
        z.object({
          scorerId: z.string(),
          scorerName: z.string(),
          score: z.number().nullable(),
          reason: z.string().nullable(),
          error: z.string().nullable(),
        }),
      ),
    }),
  ),
});

// ============================================================================
// List Response Schemas
// ============================================================================

export const listDatasetsResponseSchema = z.object({
  datasets: z.array(datasetResponseSchema),
  pagination: paginationInfoSchema,
});

export const listItemsResponseSchema = z.object({
  items: z.array(datasetItemResponseSchema),
  pagination: paginationInfoSchema,
});

export const listRunsResponseSchema = z.object({
  runs: z.array(runResponseSchema),
  pagination: paginationInfoSchema,
});

export const listResultsResponseSchema = z.object({
  results: z.array(runResultResponseSchema),
  pagination: paginationInfoSchema,
});

// ============================================================================
// Version Schemas
// ============================================================================

// Path params for item version routes
export const datasetItemVersionPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  itemId: z.string().describe('Unique identifier for the dataset item'),
  versionNumber: z.coerce.number().describe('Version number of the item'),
});

// Item version response schema
export const itemVersionResponseSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  datasetId: z.string(),
  versionNumber: z.number(),
  datasetVersion: z.coerce.date(),
  snapshot: z.object({
    input: z.unknown(),
    expectedOutput: z.unknown().optional(),
    context: z.record(z.unknown()).optional(),
  }),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
});

export const listItemVersionsResponseSchema = z.object({
  versions: z.array(itemVersionResponseSchema),
  pagination: paginationInfoSchema,
});

// Dataset version response schema
export const datasetVersionResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export const listDatasetVersionsResponseSchema = z.object({
  versions: z.array(datasetVersionResponseSchema),
  pagination: paginationInfoSchema,
});

// ============================================================================
// Bulk Operation Schemas
// ============================================================================

export const bulkAddItemsBodySchema = z.object({
  items: z.array(
    z.object({
      input: z.unknown(),
      expectedOutput: z.unknown().optional(),
      context: z.record(z.unknown()).optional(),
    }),
  ),
});

export const bulkAddItemsResponseSchema = z.object({
  items: z.array(datasetItemResponseSchema),
  count: z.number(),
});

export const bulkDeleteItemsBodySchema = z.object({
  itemIds: z.array(z.string()),
});

export const bulkDeleteItemsResponseSchema = z.object({
  success: z.boolean(),
  deletedCount: z.number(),
});
