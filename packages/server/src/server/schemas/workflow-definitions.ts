import { z } from 'zod';
import { createPagePaginationSchema, paginationInfoSchema } from './common';

// ============================================================================
// Storage Order By Schema
// ============================================================================

/**
 * Storage order by configuration for workflow definitions
 */
export const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

// ============================================================================
// Variable Reference Schemas
// ============================================================================

/**
 * Reference to a variable in the workflow context
 * Uses $ref to indicate a path to a value
 */
export const variableRefSchema = z.object({
  $ref: z.string(),
});

/**
 * Literal value wrapper
 * Uses $literal to wrap static values
 */
export const literalValueSchema = z.object({
  $literal: z.unknown(),
});

/**
 * Union of variable reference or literal value
 * Used in step inputs and conditions
 */
export const valueOrRefSchema = z.union([variableRefSchema, literalValueSchema]);

// ============================================================================
// Condition Schemas
// ============================================================================

/**
 * Comparison operators for conditions
 */
export const conditionOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'startsWith',
  'endsWith',
  'matches',
  'in',
  'isNull',
  'isNotNull',
]);

/**
 * Condition definition schema for API documentation.
 * Uses z.any() for nested conditions to avoid recursive reference warnings
 * in OpenAPI schema generation. The actual runtime validation happens
 * in the storage layer with proper recursive types.
 *
 * Supports:
 * - compare: Field comparison with operators
 * - and: Logical AND of multiple conditions
 * - or: Logical OR of multiple conditions
 * - not: Logical NOT of a condition
 * - expr: Expression string (escape hatch)
 */
export const conditionDefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('compare'),
    field: variableRefSchema,
    operator: conditionOperatorSchema,
    value: valueOrRefSchema.optional(),
  }),
  z.object({
    type: z.literal('and'),
    conditions: z.array(z.any()).describe('Array of nested condition objects'),
  }),
  z.object({
    type: z.literal('or'),
    conditions: z.array(z.any()).describe('Array of nested condition objects'),
  }),
  z.object({
    type: z.literal('not'),
    condition: z.any().describe('Nested condition object'),
  }),
  z.object({
    type: z.literal('expr'),
    expression: z.string(),
  }),
]);

// ============================================================================
// Step Definition Schemas
// ============================================================================

/**
 * Agent step definition
 * Executes an agent with a prompt and optional structured output
 */
export const agentStepDefSchema = z.object({
  type: z.literal('agent'),
  agentId: z.string(),
  input: z.object({
    prompt: variableRefSchema,
    instructions: z.union([z.string(), variableRefSchema]).optional(),
  }),
  structuredOutput: z.record(z.unknown()).optional(),
});

/**
 * Tool step definition
 * Executes a tool with input parameters
 */
export const toolStepDefSchema = z.object({
  type: z.literal('tool'),
  toolId: z.string(),
  input: z.record(valueOrRefSchema),
});

/**
 * Workflow step definition
 * Executes a nested workflow
 */
export const workflowStepDefSchema = z.object({
  type: z.literal('workflow'),
  workflowId: z.string(),
  input: z.record(valueOrRefSchema),
});

/**
 * Transform step definition
 * Transforms data and optionally updates state
 */
export const transformStepDefSchema = z.object({
  type: z.literal('transform'),
  output: z.record(valueOrRefSchema),
  outputSchema: z.record(z.unknown()),
  stateUpdates: z.record(valueOrRefSchema).optional(),
});

/**
 * Suspend step definition
 * Suspends workflow execution until resumed with data matching resumeSchema
 */
export const suspendStepDefSchema = z.object({
  type: z.literal('suspend'),
  resumeSchema: z.record(z.unknown()),
  payload: z.record(valueOrRefSchema).optional(),
});

/**
 * Discriminated union of all declarative step definitions
 */
export const declarativeStepDefSchema = z.discriminatedUnion('type', [
  agentStepDefSchema,
  toolStepDefSchema,
  workflowStepDefSchema,
  transformStepDefSchema,
  suspendStepDefSchema,
]);

// ============================================================================
// Step Graph Entry Schemas
// ============================================================================

/**
 * Reference to a step by ID
 */
export const stepRefSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
});

/**
 * Step flow entry for step graph
 * Represents different flow control types in the workflow
 */
export const definitionStepFlowEntrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('step'),
    step: stepRefSchema,
  }),
  z.object({
    type: z.literal('sleep'),
    id: z.string(),
    duration: z.number(),
  }),
  z.object({
    type: z.literal('sleepUntil'),
    id: z.string(),
    timestamp: valueOrRefSchema,
  }),
  z.object({
    type: z.literal('parallel'),
    steps: z.array(
      z.object({
        type: z.literal('step'),
        step: stepRefSchema,
      }),
    ),
  }),
  z.object({
    type: z.literal('conditional'),
    branches: z.array(
      z.object({
        condition: conditionDefSchema,
        stepId: z.string(),
      }),
    ),
    default: z.string().optional(),
  }),
  z.object({
    type: z.literal('loop'),
    stepId: z.string(),
    condition: conditionDefSchema,
    loopType: z.enum(['dowhile', 'dountil']),
  }),
  z.object({
    type: z.literal('foreach'),
    stepId: z.string(),
    collection: variableRefSchema,
    concurrency: z.number().optional(),
  }),
  z.object({
    type: z.literal('map'),
    output: z.record(valueOrRefSchema),
  }),
]);

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameter for workflow definition ID
 */
export const workflowDefinitionIdPathParams = z.object({
  workflowDefinitionId: z.string().describe('Unique identifier for the workflow definition'),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * Retry configuration for workflow definitions
 */
export const retryConfigSchema = z.object({
  attempts: z.number().optional(),
  delay: z.number().optional(),
});

/**
 * POST /api/storage/workflow-definitions - Create workflow definition body
 */
export const createWorkflowDefinitionBodySchema = z.object({
  id: z.string().describe('Unique identifier for the workflow definition'),
  name: z.string().describe('Name of the workflow definition'),
  description: z.string().optional().describe('Description of the workflow definition'),
  inputSchema: z.record(z.unknown()).describe('JSON Schema for workflow input'),
  outputSchema: z.record(z.unknown()).describe('JSON Schema for workflow output'),
  stateSchema: z.record(z.unknown()).optional().describe('JSON Schema for workflow state'),
  stepGraph: z.array(definitionStepFlowEntrySchema).describe('Array of step flow entries defining execution order'),
  steps: z.record(declarativeStepDefSchema).describe('Map of step ID to step definition'),
  retryConfig: retryConfigSchema.optional().describe('Retry configuration for the workflow'),
  metadata: z.record(z.unknown()).optional().describe('Additional metadata for the workflow definition'),
});

/**
 * PATCH /api/storage/workflow-definitions/:workflowDefinitionId - Update workflow definition body
 */
export const updateWorkflowDefinitionBodySchema = createWorkflowDefinitionBodySchema.partial().omit({ id: true });

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Workflow definition object schema (full response)
 */
export const workflowDefinitionResponseSchema = createWorkflowDefinitionBodySchema.extend({
  ownerId: z.string().optional().describe('Owner ID for multi-tenant scenarios'),
  activeVersionId: z.string().optional().describe('ID of the currently active version'),
  createdAt: z.string().describe('ISO timestamp when the definition was created'),
  updatedAt: z.string().describe('ISO timestamp when the definition was last updated'),
});

/**
 * GET /api/storage/workflow-definitions - List workflow definitions query params
 */
export const listWorkflowDefinitionsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  ownerId: z.string().optional().describe('Filter by owner ID'),
});

/**
 * Response for GET /api/storage/workflow-definitions
 */
export const listWorkflowDefinitionsResponseSchema = paginationInfoSchema.extend({
  definitions: z.array(workflowDefinitionResponseSchema),
});

/**
 * Response for GET /api/storage/workflow-definitions/:workflowDefinitionId
 */
export const getWorkflowDefinitionResponseSchema = workflowDefinitionResponseSchema;

/**
 * Response for POST /api/storage/workflow-definitions
 */
export const createWorkflowDefinitionResponseSchema = workflowDefinitionResponseSchema;

/**
 * Response for PATCH /api/storage/workflow-definitions/:workflowDefinitionId
 */
export const updateWorkflowDefinitionResponseSchema = workflowDefinitionResponseSchema;

/**
 * Response for DELETE /api/storage/workflow-definitions/:workflowDefinitionId
 */
export const deleteWorkflowDefinitionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
