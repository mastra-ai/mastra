import { z } from 'zod/v4';
import { paginationInfoSchema } from './common';

// ============================================================================
// JSON Schema Types (for inputSchema/groundTruthSchema fields)
// ============================================================================

// JSON Schema type (simplified for storage - full spec too complex)
const jsonSchemaObject: z.ZodType<Record<string, unknown>> = z.lazy(() => z.record(z.string(), z.unknown()));

// JSON Schema field (object or null to disable)
const jsonSchemaField = z.union([jsonSchemaObject, z.null()]).optional();

// ============================================================================
// Trajectory Expectation Schema (2 levels deep, children at level 2 use z.any())
// ============================================================================

// Shared base fields for expected steps (level 2 — children typed as z.any())
const expectedStepBase = {
  name: z.string().describe('Step name to match'),
  durationMs: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  children: z.any().optional().describe('Nested trajectory expectation (untyped at this depth)'),
};

// Typed step variants keyed by stepType
const expectedToolCallStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('tool_call'),
  toolArgs: z.record(z.string(), z.unknown()).optional(),
  toolResult: z.record(z.string(), z.unknown()).optional(),
  success: z.boolean().optional(),
});

const expectedMcpToolCallStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('mcp_tool_call'),
  toolArgs: z.record(z.string(), z.unknown()).optional(),
  toolResult: z.record(z.string(), z.unknown()).optional(),
  mcpServer: z.string().optional(),
  success: z.boolean().optional(),
});

const expectedModelGenerationStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('model_generation'),
  modelId: z.string().optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  finishReason: z.string().optional(),
});

const expectedAgentRunStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('agent_run'),
  agentId: z.string().optional(),
});

const expectedWorkflowStepStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_step'),
  stepId: z.string().optional(),
  status: z.string().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
});

const expectedWorkflowRunStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_run'),
  workflowId: z.string().optional(),
  status: z.string().optional(),
});

const expectedWorkflowConditionalStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_conditional'),
  conditionCount: z.number().optional(),
  selectedSteps: z.array(z.string()).optional(),
});

const expectedWorkflowParallelStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_parallel'),
  branchCount: z.number().optional(),
  parallelSteps: z.array(z.string()).optional(),
});

const expectedWorkflowLoopStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_loop'),
  loopType: z.string().optional(),
  totalIterations: z.number().optional(),
});

const expectedWorkflowSleepStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_sleep'),
  sleepDurationMs: z.number().optional(),
  sleepType: z.string().optional(),
});

const expectedWorkflowWaitEventStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('workflow_wait_event'),
  eventName: z.string().optional(),
  eventReceived: z.boolean().optional(),
});

const expectedProcessorRunStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.literal('processor_run'),
  processorId: z.string().optional(),
});

// Generic step (no stepType — matches by name only)
const expectedGenericStepSchema = z.object({
  ...expectedStepBase,
  stepType: z.undefined().optional(),
});

// Union of all expected step types
const expectedStepSchema = z.union([
  z.discriminatedUnion('stepType', [
    expectedToolCallStepSchema,
    expectedMcpToolCallStepSchema,
    expectedModelGenerationStepSchema,
    expectedAgentRunStepSchema,
    expectedWorkflowStepStepSchema,
    expectedWorkflowRunStepSchema,
    expectedWorkflowConditionalStepSchema,
    expectedWorkflowParallelStepSchema,
    expectedWorkflowLoopStepSchema,
    expectedWorkflowSleepStepSchema,
    expectedWorkflowWaitEventStepSchema,
    expectedProcessorRunStepSchema,
  ]),
  expectedGenericStepSchema,
]);

// Full TrajectoryExpectation schema
const trajectoryExpectationSchema = z
  .object({
    // Accuracy
    steps: z.array(expectedStepSchema).optional().describe('Expected steps for accuracy checking'),
    ordering: z
      .enum(['strict', 'relaxed', 'unordered'])
      .optional()
      .describe('How to compare step ordering (default: relaxed)'),
    allowRepeatedSteps: z.boolean().optional().describe('Whether to allow repeated steps (default: true)'),

    // Efficiency
    maxSteps: z.number().int().optional().describe('Maximum number of steps allowed'),
    maxTotalTokens: z.number().int().optional().describe('Maximum total tokens across all model_generation steps'),
    maxTotalDurationMs: z.number().optional().describe('Maximum total duration in milliseconds'),
    noRedundantCalls: z
      .boolean()
      .optional()
      .describe('Whether to penalize redundant calls (same tool + same args consecutively, default: true)'),

    // Blacklist
    blacklistedTools: z.array(z.string()).optional().describe('Tool names that should never appear'),
    blacklistedSequences: z
      .array(z.array(z.string()))
      .optional()
      .describe('Tool name sequences that should never appear'),

    // Tool failure tolerance
    maxRetriesPerTool: z.number().int().optional().describe('Maximum retries per tool before penalizing (default: 2)'),
  })
  .optional()
  .nullable()
  .describe('Expected trajectory configuration for trajectory scoring');

// Dataset item source tracking
const datasetItemSourceSchema = z
  .object({
    type: z.enum(['csv', 'json', 'trace', 'llm', 'experiment-result']).describe('How this item was created'),
    referenceId: z.string().optional().describe('Reference identifier (e.g., trace id, csv filename)'),
  })
  .optional()
  .describe('Source/provenance of this dataset item');

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

export const experimentResultIdPathParams = z.object({
  datasetId: z.string().describe('Unique identifier for the dataset'),
  experimentId: z.string().describe('Unique identifier for the experiment'),
  resultId: z.string().describe('Unique identifier for the experiment result'),
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
  requestContextSchema: jsonSchemaField.describe('JSON Schema describing expected request context shape'),
  targetType: z.string().optional().describe('Target entity type (e.g. agent, workflow, scorer)'),
  targetIds: z.array(z.string()).optional().describe('IDs of target entities this dataset is attached to'),
  scorerIds: z.array(z.string()).optional().describe('IDs of scorers attached to this dataset'),
});

export const updateDatasetBodySchema = z.object({
  name: z.string().optional().describe('Name of the dataset'),
  description: z.string().optional().describe('Description of the dataset'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  inputSchema: jsonSchemaField.describe('JSON Schema for validating item input'),
  groundTruthSchema: jsonSchemaField.describe('JSON Schema for validating item groundTruth'),
  requestContextSchema: jsonSchemaField.describe('JSON Schema describing expected request context shape'),
  tags: z.array(z.string()).optional().describe('Tag definitions for categorizing experiment results'),
  targetType: z.string().optional().describe('Target entity type (e.g. agent, workflow, scorer)'),
  targetIds: z.array(z.string()).optional().describe('IDs of target entities this dataset is attached to'),
  scorerIds: z.array(z.string()).optional().nullable().describe('IDs of scorers attached to this dataset'),
});

export const addItemBodySchema = z.object({
  input: z.unknown().describe('Input data for the dataset item'),
  groundTruth: z.unknown().optional().describe('Expected output for comparison'),
  expectedTrajectory: trajectoryExpectationSchema,
  requestContext: z.record(z.string(), z.unknown()).optional().describe('Request context preset for this item'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  source: datasetItemSourceSchema,
});

export const updateItemBodySchema = z.object({
  input: z.unknown().optional().describe('Input data for the dataset item'),
  groundTruth: z.unknown().optional().describe('Expected output for comparison'),
  expectedTrajectory: trajectoryExpectationSchema,
  requestContext: z.record(z.string(), z.unknown()).optional().describe('Request context preset for this item'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
  source: datasetItemSourceSchema,
});

export const triggerExperimentBodySchema = z.object({
  targetType: z.enum(['agent', 'workflow', 'scorer']).describe('Type of target to run against'),
  targetId: z.string().describe('ID of the target'),
  scorerIds: z.array(z.string()).optional().describe('IDs of scorers to apply'),
  version: z.coerce.number().int().optional().describe('Pin to specific dataset version'),
  agentVersion: z.string().optional().describe('Agent version ID to use for experiment'),
  maxConcurrency: z.number().optional().describe('Maximum concurrent executions'),
  requestContext: z.record(z.string(), z.unknown()).optional().describe('Global request context passed to the target'),
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
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  groundTruthSchema: z.record(z.string(), z.unknown()).optional(),
  requestContextSchema: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional().nullable(),
  targetType: z.string().optional().nullable(),
  targetIds: z.array(z.string()).optional().nullable(),
  scorerIds: z.array(z.string()).optional().nullable(),
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
  expectedTrajectory: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source: datasetItemSourceSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Experiment entity schema
export const experimentResponseSchema = z.object({
  id: z.string(),
  datasetId: z.string().nullable(),
  datasetVersion: z.number().int().nullable(),
  agentVersion: z.string().nullable().optional(),
  targetType: z.enum(['agent', 'workflow', 'scorer', 'processor']),
  targetId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  expectedTrajectory: z.unknown().optional(),
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
  status: z.enum(['needs-review', 'reviewed', 'complete']).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  createdAt: z.coerce.date(),
});

export const updateExperimentResultBodySchema = z.object({
  status: z.enum(['needs-review', 'reviewed', 'complete']).nullable().optional(),
  tags: z.array(z.string()).optional(),
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

export const experimentReviewCountsSchema = z.object({
  experimentId: z.string(),
  total: z.number().int(),
  needsReview: z.number().int(),
  reviewed: z.number().int(),
  complete: z.number().int(),
});

export const reviewSummaryResponseSchema = z.object({
  counts: z.array(experimentReviewCountsSchema),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
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
      expectedTrajectory: trajectoryExpectationSchema,
      requestContext: z.record(z.string(), z.unknown()).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      source: datasetItemSourceSchema,
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

// ============================================================================
// AI Generation Schemas
// ============================================================================

export const generateItemsBodySchema = z.object({
  modelId: z.string().describe('Model identifier in "provider/model" format (e.g., "openai/gpt-4o")'),
  prompt: z.string().describe('Description of the kind of test data to generate'),
  count: z.number().int().min(1).max(50).default(5).describe('Number of items to generate'),
  agentContext: z
    .object({
      description: z.string().optional(),
      instructions: z.string().optional(),
      tools: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Context about the agent to generate relevant test data'),
});

const generatedItemSchema = z.object({
  input: z.unknown(),
  groundTruth: z.unknown().optional(),
});

export const generateItemsResponseSchema = z.object({
  items: z.array(generatedItemSchema),
});

// ============================================================================
// Cluster Failures
// ============================================================================

export const clusterFailuresBodySchema = z.object({
  modelId: z.string().describe('Model identifier in "provider/model" format (e.g., "openai/gpt-4o")'),
  items: z
    .array(
      z.object({
        id: z.string(),
        input: z.unknown(),
        output: z.unknown().optional(),
        error: z.string().optional(),
        scores: z.record(z.string(), z.number()).optional(),
        existingTags: z.array(z.string()).optional().describe('Tags already applied to this item'),
      }),
    )
    .min(1)
    .max(200)
    .describe('Failure items to cluster'),
  availableTags: z
    .array(z.string())
    .optional()
    .describe('Existing tag vocabulary from the dataset. The LLM should prefer reusing these tags when applicable.'),
  prompt: z
    .string()
    .optional()
    .describe('Optional user instructions to guide the analysis (e.g., "focus on tool usage failures")'),
});

const failureClusterSchema = z.object({
  id: z.string().describe('A unique cluster identifier'),
  label: z.string().describe('Short label for this failure pattern'),
  description: z.string().describe('Description of the common pattern'),
  itemIds: z.array(z.string()).describe('IDs of items belonging to this cluster'),
});

export const clusterFailuresResponseSchema = z.object({
  clusters: z.array(failureClusterSchema),
  /** Per-item proposed tag assignments. Each entry maps an item ID to the tags the LLM suggests adding. */
  proposedTags: z
    .array(
      z.object({
        itemId: z.string(),
        tags: z.array(z.string()),
        reason: z.string().describe('Brief explanation of why these tags were assigned to this item'),
      }),
    )
    .optional(),
});
