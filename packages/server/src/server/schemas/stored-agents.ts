import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameter for stored agent ID
 */
export const storedAgentIdPathParams = z.object({
  storedAgentId: z.string().describe('Unique identifier for the stored agent'),
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
 * GET /api/storage/agents - List stored agents
 */
export const listStoredAgentsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Base stored agent schema (shared fields)
 */
const storedAgentBaseSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: z.string().describe('System instructions for the agent'),
  model: z.record(z.string(), z.unknown()).describe('Model configuration (provider, name, etc.)'),
  tools: z.record(z.string(), z.unknown()).optional().describe('Serialized tool references/configurations'),
  defaultOptions: z.record(z.string(), z.unknown()).optional().describe('Default options for generate/stream calls'),
  workflows: z.record(z.string(), z.unknown()).optional().describe('Workflow references (IDs or configurations)'),
  agents: z.record(z.string(), z.unknown()).optional().describe('Sub-agent references (IDs or configurations)'),
  inputProcessors: z.array(z.record(z.string(), z.unknown())).optional().describe('Input processor configurations'),
  outputProcessors: z.array(z.record(z.string(), z.unknown())).optional().describe('Output processor configurations'),
  memory: z.record(z.string(), z.unknown()).optional().describe('Memory configuration'),
  scorers: z.record(z.string(), z.unknown()).optional().describe('Scorer configurations'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the agent'),
});

/**
 * POST /api/storage/agents - Create stored agent body
 */
export const createStoredAgentBodySchema = storedAgentBaseSchema.extend({
  id: z.string().describe('Unique identifier for the agent'),
});

/**
 * PATCH /api/storage/agents/:storedAgentId - Update stored agent body
 */
export const updateStoredAgentBodySchema = storedAgentBaseSchema.partial();

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Stored agent object schema (full response)
 */
export const storedAgentSchema = storedAgentBaseSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Response for GET /api/storage/agents
 */
export const listStoredAgentsResponseSchema = paginationInfoSchema.extend({
  agents: z.array(storedAgentSchema),
});

/**
 * Response for GET /api/storage/agents/:storedAgentId
 */
export const getStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for POST /api/storage/agents
 */
export const createStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for PATCH /api/storage/agents/:storedAgentId
 */
export const updateStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for DELETE /api/storage/agents/:storedAgentId
 */
export const deleteStoredAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
