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
 * GET /stored/agents - List stored agents
 */
export const listStoredAgentsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  ownerId: z.string().optional().describe('Filter agents by owner identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter agents by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Scorer config schema with optional sampling
 */
const scorerConfigSchema = z.object({
  sampling: z
    .object({
      type: z.enum(['ratio', 'count']),
      rate: z.number().optional(),
      count: z.number().optional(),
    })
    .optional(),
});

/**
 * Base stored agent schema (shared fields)
 */
const storedAgentBaseSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: z.string().describe('System instructions for the agent'),
  model: z.record(z.string(), z.unknown()).describe('Model configuration (provider, name, etc.)'),
  tools: z.array(z.string()).optional().describe('Array of tool keys to resolve from Mastra registry'),
  defaultOptions: z.record(z.string(), z.unknown()).optional().describe('Default options for generate/stream calls'),
  workflows: z.array(z.string()).optional().describe('Array of workflow keys to resolve from Mastra registry'),
  agents: z.array(z.string()).optional().describe('Array of agent keys to resolve from Mastra registry'),
  integrationTools: z
    .array(z.string())
    .optional()
    .describe('Array of specific integration tool IDs (format: provider_toolkitSlug_toolSlug)'),
  inputProcessors: z.array(z.record(z.string(), z.unknown())).optional().describe('Input processor configurations'),
  outputProcessors: z.array(z.record(z.string(), z.unknown())).optional().describe('Output processor configurations'),
  memory: z.string().optional().describe('Memory key to resolve from Mastra registry'),
  scorers: z.record(z.string(), scorerConfigSchema).optional().describe('Scorer keys with optional sampling config'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the agent'),
  ownerId: z.string().optional().describe('Owner identifier for multi-tenant filtering'),
});

/**
 * POST /stored/agents - Create stored agent body
 */
export const createStoredAgentBodySchema = storedAgentBaseSchema.extend({
  id: z.string().describe('Unique identifier for the agent'),
});

/**
 * PATCH /stored/agents/:storedAgentId - Update stored agent body
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
  ownerId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Response for GET /stored/agents
 */
export const listStoredAgentsResponseSchema = paginationInfoSchema.extend({
  agents: z.array(storedAgentSchema),
});

/**
 * Response for GET /stored/agents/:storedAgentId
 */
export const getStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for POST /stored/agents
 */
export const createStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for PATCH /stored/agents/:storedAgentId
 */
export const updateStoredAgentResponseSchema = storedAgentSchema;

/**
 * Response for DELETE /stored/agents/:storedAgentId
 */
export const deleteStoredAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
