import { z } from 'zod/v4';

// ============================================================================
// Path params
// ============================================================================

export const storedWorkflowIdPathParams = z.object({
  storedWorkflowId: z.string().describe('Unique identifier for the stored workflow definition'),
});

// ============================================================================
// Query params
// ============================================================================

export const listStoredWorkflowsQuerySchema = z.object({
  status: z
    .enum(['active', 'archived'])
    .optional()
    .describe('Filter stored workflows by status (defaults to active when omitted by the handler)'),
  authorId: z.string().optional().describe('Filter stored workflows by author identifier'),
});

// ============================================================================
// Body schemas
// ============================================================================

/**
 * Body for `POST /stored/workflows` — upsert a static workflow definition.
 * Matches the input shape of `mastra.addStoredWorkflow()`.
 */
export const upsertStoredWorkflowBodySchema = z.object({
  id: z.string().describe('Workflow id — kebab-case, descriptive'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Schemas + graph are loose by design: the agent constructs them and this
  // is the same shape `mastra.addStoredWorkflow` expects.
  inputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow input'),
  outputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow output'),
  stateSchema: z.any().optional(),
  requestContextSchema: z.any().optional(),
  graph: z.array(z.any()).describe('Static workflow graph — SerializedStepFlowEntry[] with all refs as ids'),
});

// ============================================================================
// Response schemas
// ============================================================================

/**
 * Shape returned for any single stored workflow row.
 */
export const storedWorkflowResponseSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  inputSchema: z.any(),
  outputSchema: z.any(),
  stateSchema: z.any().optional(),
  requestContextSchema: z.any().optional(),
  graph: z.array(z.any()),
  status: z.enum(['active', 'archived']),
  source: z.literal('storage'),
  authorId: z.string().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export const listStoredWorkflowsResponseSchema = z.object({
  workflows: z.array(storedWorkflowResponseSchema),
  total: z.number(),
});

export const getStoredWorkflowResponseSchema = storedWorkflowResponseSchema;

export const upsertStoredWorkflowResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});

export const deleteStoredWorkflowResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
