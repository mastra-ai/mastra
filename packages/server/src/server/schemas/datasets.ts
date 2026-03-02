import z from 'zod';
import { paginationInfoSchema } from './common';

// ============================================================================
// JSON Schema Types (for inputSchema/groundTruthSchema fields)
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

export const experimentIdPathParams = z.object({
  experimentId: z.string().describe('Unique identifier for the experiment'),
});

export const itemIdPathParams = z.object({
  itemId: z.string().describe('Unique identifier for the dataset item'),
});

export const datasetAndExperimentIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  experimentId: z.string().describe('Unique identifier for the experiment'),
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
  version: z.coerce.number().int().optional(), // Optional version filter for snapshot semantics
  search: z.string().optional(),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

export const createDatasetBodySchema = z.object({
  name: z.string().describe('Name of the dataset'),
  description: z.string().optional().describe('Description of the dataset'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  inputSchema: jsonSchemaField.describe('JSON Schema for validating item input'),
  groundTruthSchema: jsonSchemaField.describe('JSON Schema for validating item groundTruth'),
  defaultRequestContext: z.unknown().optional().describe('Default request context for experiment execution'),
  requestContextSchema: jsonSchemaField.describe('JSON Schema for validating item requestContext'),
});

export const updateDatasetBodySchema = z.object({
  name: z.string().optional().describe('Name of the dataset'),
  description: z.string().optional().describe('Description of the dataset'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  inputSchema: jsonSchemaField.describe('JSON Schema for validating item input'),
  groundTruthSchema: jsonSchemaField.describe('JSON Schema for validating item groundTruth'),
  defaultRequestContext: z.unknown().optional().describe('Default request context for experiment execution'),
  requestContextSchema: jsonSchemaField.describe('JSON Schema for validating item requestContext'),
});

export const addItemBodySchema = z.object({
  input: z.unknown().describe('Input data for the dataset item'),
  groundTruth: z.unknown().optional().describe('Expected output for comparison'),
  requestContext: z.unknown().optional().describe('Request context for experiment execution'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

export const updateItemBodySchema = z.object({
  input: z.unknown().optional().describe('Input data for the dataset item'),
  groundTruth: z.unknown().optional().describe('Expected output for comparison'),
  requestContext: z.unknown().optional().describe('Request context for experiment execution'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

export const triggerExperimentBodySchema = z.object({
  targetType: z.enum(['agent', 'workflow', 'scorer']).describe('Type of target to run against'),
  targetId: z.string().describe('ID of the target'),
  scorerIds: z.array(z.string()).optional().describe('IDs of scorers to apply'),
  version: z.coerce.number().int().optional().describe('Pin to specific dataset version'),
  maxConcurrency: z.number().optional().describe('Maximum concurrent executions'),
});

export const compareExperimentsBodySchema = z.object({
  experimentIdA: z.string().describe('ID of baseline experiment'),
  experimentIdB: z.string().describe('ID of candidate experiment'),
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
  inputSchema: z.record(z.unknown()).optional(),
  groundTruthSchema: z.record(z.unknown()).optional(),
  defaultRequestContext: z.unknown().optional(),
  requestContextSchema: z.record(z.unknown()).optional(),
  version: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Dataset item entity schema
export const datasetItemResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  datasetVersion: z.number().int(),
  input: z.unknown(),
  groundTruth: z.unknown().optional(),
  requestContext: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Experiment entity schema
export const experimentResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string().nullable(),
  datasetVersion: z.number().int().nullable(),
  targetType: z.enum(['agent', 'workflow', 'scorer', 'processor']),
  targetId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  totalItems: z.number(),
  succeededCount: z.number(),
  failedCount: z.number(),
  skippedCount: z.number(),
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

// Experiment result entity schema
export const experimentResultResponseSchema = z.object({
  id: z.string(),
  experimentId: z.string(),
  itemId: z.string(),
  itemDatasetVersion: z.number().int().nullable(),
  input: z.unknown(),
  output: z.unknown().nullable(),
  groundTruth: z.unknown().nullable(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional(),
    })
    .nullable(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  retryCount: z.number(),
  traceId: z.string().nullable(),
  createdAt: z.coerce.date(),
});

// Comparison item schema (MVP shape)
const comparisonItemSchema = z.object({
  itemId: z.string(),
  input: z.unknown().nullable(),
  groundTruth: z.unknown().nullable(),
  results: z.record(
    z.string(),
    z
      .object({
        output: z.unknown().nullable(),
        scores: z.record(z.string(), z.number().nullable()),
      })
      .nullable(),
  ),
});

// Comparison result schema
export const comparisonResponseSchema = z.object({
  baselineId: z.string(),
  items: z.array(comparisonItemSchema),
});

// Experiment summary schema (returned by trigger experiment)
// Note: completedAt is nullable for pending/running experiments (async trigger)
export const experimentSummaryResponseSchema = z.object({
  experimentId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  totalItems: z.number(),
  succeededCount: z.number(),
  failedCount: z.number(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  results: z.array(
    z.object({
      itemId: z.string(),
      itemDatasetVersion: z.number().int().nullable(),
      input: z.unknown(),
      output: z.unknown().nullable(),
      groundTruth: z.unknown().nullable(),
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

export const listExperimentsResponseSchema = z.object({
  experiments: z.array(experimentResponseSchema),
  pagination: paginationInfoSchema,
});

export const listExperimentResultsResponseSchema = z.object({
  results: z.array(experimentResultResponseSchema),
  pagination: paginationInfoSchema,
});

// ============================================================================
// Version Schemas
// ============================================================================

// Path params for item version routes
export const datasetItemVersionPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  itemId: z.string().describe('Unique identifier for the dataset item'),
  datasetVersion: z.coerce.number().int().describe('Dataset version number'),
});

// Item history row response schema (SCD-2 DatasetItemRow shape)
export const itemVersionResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  datasetVersion: z.number().int(),
  input: z.unknown(),
  groundTruth: z.unknown().optional(),
  requestContext: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  validTo: z.number().int().nullable(),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const listItemVersionsResponseSchema = z.object({
  history: z.array(itemVersionResponseSchema),
});

// Dataset version response schema
export const datasetVersionResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string(),
  version: z.number().int(),
  createdAt: z.coerce.date(),
});

export const listDatasetVersionsResponseSchema = z.object({
  versions: z.array(datasetVersionResponseSchema),
  pagination: paginationInfoSchema,
});

// ============================================================================
// Batch Operation Schemas
// ============================================================================

export const batchInsertItemsBodySchema = z.object({
  items: z.array(
    z.object({
      input: z.unknown(),
      groundTruth: z.unknown().optional(),
      requestContext: z.unknown().optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  ),
});

export const batchInsertItemsResponseSchema = z.object({
  items: z.array(datasetItemResponseSchema),
  count: z.number(),
});

export const batchDeleteItemsBodySchema = z.object({
  itemIds: z.array(z.string()),
});

export const batchDeleteItemsResponseSchema = z.object({
  success: z.boolean(),
  deletedCount: z.number(),
});
