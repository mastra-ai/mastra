import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameter for stored scorer ID
 */
export const storedScorerIdPathParams = z.object({
  storedScorerId: z.string().describe('Unique identifier for the stored scorer'),
});

/**
 * Path parameters for agent-scorer assignment (agentId and scorerId)
 */
export const agentScorerPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
  scorerId: z.string().describe('Unique identifier for the scorer'),
});

/**
 * Path parameter for assignment ID
 */
export const assignmentIdPathParams = z.object({
  assignmentId: z.string().describe('Unique identifier for the agent-scorer assignment'),
});

/**
 * Path parameter for agent ID (for listing assignments)
 */
export const agentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Storage order by configuration
 */
const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

/**
 * GET /api/stored/scorers - List stored scorers
 */
export const listStoredScorersQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
});

/**
 * GET /api/stored/scorers/agents/:agentId/assignments - List agent scorer assignments
 */
export const listAgentScorerAssignmentsQuerySchema = createPagePaginationSchema(100).extend({
  enabledOnly: z.coerce.boolean().optional(),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Top-level judge configuration for scorer (instructions required)
 */
const judgeConfigSchema = z.object({
  model: z.string().describe('Model identifier (e.g., "openai:gpt-4")'),
  instructions: z.string().describe('System instructions for the judge model'),
});

/**
 * Step-level judge configuration (instructions optional, inherits from top-level)
 */
const stepJudgeConfigSchema = z.object({
  model: z.string().describe('Model identifier (e.g., "openai:gpt-4")'),
  instructions: z.string().optional().describe('Optional instructions override for this step'),
});

/**
 * Scorer step configuration
 */
const scorerStepConfigSchema = z.object({
  name: z
    .enum(['preprocess', 'analyze', 'generateScore', 'generateReason'])
    .describe('Step name in the scorer pipeline'),
  description: z.string().describe('Human-readable description of what this step does'),
  outputSchema: z.record(z.string(), z.unknown()).optional().describe('JSON Schema for step output validation'),
  promptTemplate: z.string().describe('Prompt template with {{variable}} placeholders'),
  judge: stepJudgeConfigSchema.optional().describe('Optional step-specific judge configuration'),
});

/**
 * Sampling configuration for scorers
 */
const samplingConfigSchema = z.object({
  type: z.enum(['ratio', 'count']).describe('Sampling strategy'),
  rate: z.number().min(0).max(1).optional().describe('Sampling rate (0-1) when type is "ratio"'),
  count: z.number().int().positive().optional().describe('Fixed sample count when type is "count"'),
});

/**
 * Scorer type configuration
 */
const scorerTypeSchema = z.union([
  z.literal('agent').describe('Agent scorer that evaluates agent runs'),
  z
    .object({
      inputSchema: z.record(z.string(), z.unknown()).optional().describe('JSON Schema for scorer input'),
      outputSchema: z.record(z.string(), z.unknown()).optional().describe('JSON Schema for scorer output'),
    })
    .describe('Custom scorer with input/output schemas'),
]);

/**
 * Base stored scorer schema (shared fields)
 */
const storedScorerBaseSchema = z.object({
  name: z.string().describe('Name of the scorer'),
  description: z.string().describe('Description of what this scorer evaluates'),
  type: scorerTypeSchema.optional().describe('Scorer type configuration'),
  judge: judgeConfigSchema.optional().describe('Default judge configuration for all steps'),
  steps: z.array(scorerStepConfigSchema).describe('Pipeline steps for the scorer'),
  sampling: samplingConfigSchema.optional().describe('Sampling configuration'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

/**
 * POST /api/stored/scorers - Create stored scorer body
 */
export const createStoredScorerBodySchema = storedScorerBaseSchema.extend({
  id: z.string().describe('Unique identifier for the scorer'),
});

/**
 * PATCH /api/stored/scorers/:storedScorerId - Update stored scorer body
 */
export const updateStoredScorerBodySchema = storedScorerBaseSchema.partial();

/**
 * POST /api/stored/scorers/agents/:agentId/assignments - Assign scorer to agent body
 */
export const assignScorerToAgentBodySchema = z.object({
  scorerId: z.string().describe('ID of the scorer to assign'),
  sampling: samplingConfigSchema.optional().describe('Override sampling for this assignment'),
  enabled: z.boolean().default(true).describe('Whether the assignment is active'),
  priority: z.number().int().optional().describe('Priority order (lower = higher priority)'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

/**
 * PATCH /api/stored/scorers/assignments/:assignmentId - Update assignment body
 */
export const updateAgentScorerAssignmentBodySchema = z.object({
  sampling: samplingConfigSchema.optional().describe('Override sampling for this assignment'),
  enabled: z.boolean().optional().describe('Whether the assignment is active'),
  priority: z.number().int().optional().describe('Priority order (lower = higher priority)'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Stored scorer object schema (full response)
 */
export const storedScorerSchema = storedScorerBaseSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Agent-scorer assignment object schema (full response)
 */
export const agentScorerAssignmentSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  scorerId: z.string(),
  sampling: samplingConfigSchema.optional(),
  enabled: z.boolean(),
  priority: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Response for GET /api/stored/scorers
 */
export const listStoredScorersResponseSchema = paginationInfoSchema.extend({
  scorers: z.array(storedScorerSchema),
});

/**
 * Response for GET /api/stored/scorers/:storedScorerId
 */
export const getStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for POST /api/stored/scorers
 */
export const createStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for PATCH /api/stored/scorers/:storedScorerId
 */
export const updateStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for DELETE /api/stored/scorers/:storedScorerId
 */
export const deleteStoredScorerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Response for GET /api/stored/scorers/agents/:agentId/assignments
 */
export const listAgentScorerAssignmentsResponseSchema = paginationInfoSchema.extend({
  assignments: z.array(agentScorerAssignmentSchema),
});

/**
 * Response for POST /api/stored/scorers/agents/:agentId/assignments
 */
export const assignScorerToAgentResponseSchema = agentScorerAssignmentSchema;

/**
 * Response for PATCH /api/stored/scorers/assignments/:assignmentId
 */
export const updateAgentScorerAssignmentResponseSchema = agentScorerAssignmentSchema;

/**
 * Response for DELETE /api/stored/scorers/agents/:agentId/scorers/:scorerId
 */
export const unassignScorerFromAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
