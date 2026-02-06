import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';
import { defaultOptionsSchema } from './default-options';
import { serializedMemoryConfigSchema } from './memory-config';

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
  authorId: z.string().optional().describe('Filter agents by author identifier'),
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
    .union([
      z.object({ type: z.literal('none') }),
      z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
    ])
    .optional(),
});

/**
 * Agent snapshot config fields (name, description, instructions, model, tools, etc.)
 * These live in version snapshots, not on the thin agent record.
 */
const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: z.string().describe('System instructions for the agent'),
  model: z
    .object({
      provider: z.string().describe('Model provider (e.g., openai, anthropic)'),
      name: z.string().describe('Model name (e.g., gpt-4o, claude-3-opus)'),
    })
    .passthrough()
    .describe('Model configuration (provider, name, and optional params)'),
  tools: z.array(z.string()).optional().describe('Array of tool keys to resolve from Mastra registry'),
  defaultOptions: defaultOptionsSchema.optional().describe('Default options for generate/stream calls'),
  workflows: z.array(z.string()).optional().describe('Array of workflow keys to resolve from Mastra registry'),
  agents: z.array(z.string()).optional().describe('Array of agent keys to resolve from Mastra registry'),
  integrationTools: z
    .array(z.string())
    .optional()
    .describe('Array of specific integration tool IDs (format: provider_toolkitSlug_toolSlug)'),
  inputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  outputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  memory: serializedMemoryConfigSchema.optional().describe('Memory configuration object (SerializedMemoryConfig)'),
  scorers: z.record(z.string(), scorerConfigSchema).optional().describe('Scorer keys with optional sampling config'),
});

/**
 * Agent metadata fields (authorId, metadata) that live on the thin agent record.
 */
const agentMetadataSchema = z.object({
  authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the agent'),
});

/**
 * POST /stored/agents - Create stored agent body
 * Flat union of agent-record fields + config fields
 */
export const createStoredAgentBodySchema = z
  .object({
    id: z.string().describe('Unique identifier for the agent'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the agent'),
  })
  .merge(snapshotConfigSchema);

/**
 * Snapshot config schema for updates where nullable fields (like memory) can be set to null to clear them.
 */
const snapshotConfigUpdateSchema = snapshotConfigSchema.extend({
  memory: z
    .union([serializedMemoryConfigSchema, z.null()])
    .optional()
    .describe('Memory configuration object (SerializedMemoryConfig), or null to disable memory'),
});

/**
 * PATCH /stored/agents/:storedAgentId - Update stored agent body
 * Optional metadata-level fields + optional config fields
 */
export const updateStoredAgentBodySchema = agentMetadataSchema.partial().merge(snapshotConfigUpdateSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Stored agent object schema (resolved response: thin record + version config)
 * Represents StorageResolvedAgentType
 */
export const storedAgentSchema = z.object({
  // Thin agent record fields
  id: z.string(),
  status: z.string().describe('Agent status: draft or published'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // Version snapshot config fields (resolved from active version)
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: z.string().describe('System instructions for the agent'),
  model: z
    .object({
      provider: z.string().describe('Model provider (e.g., openai, anthropic)'),
      name: z.string().describe('Model name (e.g., gpt-4o, claude-3-opus)'),
    })
    .passthrough()
    .describe('Model configuration (provider, name, and optional params)'),
  tools: z.array(z.string()).optional().describe('Array of tool keys to resolve from Mastra registry'),
  defaultOptions: defaultOptionsSchema.optional().describe('Default options for generate/stream calls'),
  workflows: z.array(z.string()).optional().describe('Array of workflow keys to resolve from Mastra registry'),
  agents: z.array(z.string()).optional().describe('Array of agent keys to resolve from Mastra registry'),
  integrationTools: z
    .array(z.string())
    .optional()
    .describe('Array of specific integration tool IDs (format: provider_toolkitSlug_toolSlug)'),
  inputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  outputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  memory: serializedMemoryConfigSchema.optional().describe('Memory configuration object (SerializedMemoryConfig)'),
  scorers: z.record(z.string(), scorerConfigSchema).optional().describe('Scorer keys with optional sampling config'),
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
 *
 * The response can be either:
 * 1. A thin agent record (no version) - only has id, status, dates, etc.
 * 2. A resolved agent (with version) - has all config fields from the version
 *
 * We use a union to handle both cases properly.
 */
export const updateStoredAgentResponseSchema = z.union([
  // Thin agent record (no version config)
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  // Resolved agent (thin record + version config)
  storedAgentSchema,
]);

/**
 * Response for DELETE /stored/agents/:storedAgentId
 */
export const deleteStoredAgentResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Exported for use in agent-versions.ts schemas
 */
export { snapshotConfigSchema, scorerConfigSchema };
