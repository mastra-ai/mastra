import z from 'zod';
import {
  datasetSchema,
  datasetItemSchema,
  datasetRunSchema,
  datasetRunResultSchema,
  datasetRunStatusSchema,
  datasetRunResultStatusSchema,
  listDatasetsResponseSchema,
  listDatasetItemsResponseSchema,
  listDatasetRunsResponseSchema,
  listDatasetRunResultsResponseSchema,
} from '@mastra/core/datasets';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const datasetIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
});

export const datasetItemIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  itemId: z.string().describe('Unique identifier for the dataset item'),
});

export const datasetRunIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  runId: z.string().describe('Unique identifier for the dataset run'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const listDatasetsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
});

export const listDatasetItemsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  asOf: z.coerce.date().optional(),
  includeArchived: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export const listDatasetRunsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  status: datasetRunStatusSchema.optional(),
});

export const listDatasetRunResultsQuerySchema = z.object({
  page: z.coerce.number().optional().default(0),
  perPage: z.coerce.number().optional().default(10),
  status: datasetRunResultStatusSchema.optional(),
});

// Extended result schema that includes item input for UI display
export const datasetRunResultWithInputSchema = datasetRunResultSchema.extend({
  itemInput: z.unknown().describe('Input from the dataset item'),
});

export const listDatasetRunResultsWithInputResponseSchema = z.object({
  pagination: z.object({
    total: z.number().describe('Total number of items available'),
    page: z.number().describe('Current page'),
    perPage: z
      .union([z.number(), z.literal(false)])
      .describe('Number of items per page, or false if pagination is disabled'),
    hasMore: z.boolean().describe('True if more pages are available'),
  }),
  results: z.array(datasetRunResultWithInputSchema),
});

// ============================================================================
// Body Schemas
// ============================================================================

export const createDatasetBodySchema = z.object({
  name: z.string().describe('Human-readable dataset name'),
  description: z.string().optional().describe('Dataset description'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
});

export const updateDatasetBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createDatasetItemsBodySchema = z.object({
  items: z.array(
    z.object({
      input: z.unknown().describe('Input data for evaluation'),
      expectedOutput: z.unknown().optional().describe('Expected output for comparison'),
      metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
    }),
  ),
});

export const updateDatasetItemBodySchema = z.object({
  input: z.unknown().optional().describe('Input data for evaluation'),
  expectedOutput: z.unknown().optional().describe('Expected output for comparison'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Custom metadata'),
});

export const createDatasetRunBodySchema = z.object({
  agentId: z.string().describe('ID of the agent to run against the dataset'),
  name: z.string().optional().describe('Optional name for this run'),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const datasetResponseSchema = z.object({
  dataset: datasetSchema,
});

export const datasetItemsResponseSchema = z.object({
  items: z.array(datasetItemSchema),
});

export const datasetItemResponseSchema = z.object({
  item: datasetItemSchema,
});

export const deleteDatasetResponseSchema = z.object({
  success: z.literal(true),
});

export const datasetRunResponseSchema = z.object({
  run: datasetRunSchema,
});

// Re-export for convenience
export {
  datasetSchema,
  datasetItemSchema,
  datasetRunSchema,
  datasetRunResultSchema,
  listDatasetsResponseSchema,
  listDatasetItemsResponseSchema,
  listDatasetRunsResponseSchema,
  listDatasetRunResultsResponseSchema,
};
