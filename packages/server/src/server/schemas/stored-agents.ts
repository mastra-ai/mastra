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
 * Rule and RuleGroup schemas for conditional prompt block evaluation.
 */
const ruleSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'greater_than',
    'less_than',
    'greater_than_or_equal',
    'less_than_or_equal',
    'in',
    'not_in',
    'exists',
    'not_exists',
  ]),
  value: z.unknown(),
});

type RuleGroupZod = z.ZodType<{ operator: 'AND' | 'OR'; conditions: (z.infer<typeof ruleSchema> | RuleGroupInput)[] }>;
type RuleGroupInput = z.infer<RuleGroupZod>;

const ruleGroupSchema: RuleGroupZod = z.lazy(() =>
  z.object({
    operator: z.enum(['AND', 'OR']),
    conditions: z.array(z.union([ruleSchema, ruleGroupSchema])),
  }),
);

/**
 * Agent instruction block schema for prompt-block-based instructions.
 */
const agentInstructionBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('prompt_block_ref'), id: z.string() }),
  z.object({ type: z.literal('prompt_block'), content: z.string(), rules: ruleGroupSchema.optional() }),
]);

/**
 * Instructions can be a plain string or an array of instruction blocks (text + prompt_block references).
 */
export const instructionsSchema = z
  .union([z.string(), z.array(agentInstructionBlockSchema)])
  .describe('System instructions for the agent (string or array of instruction blocks)');

/**
 * Agent snapshot config fields (name, description, instructions, model, tools, etc.)
 * These live in version snapshots, not on the thin agent record.
 */
const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: instructionsSchema,
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
 * The id is optional — if not provided, it will be derived from the agent name via slugify.
 */
export const createStoredAgentBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier for the agent. If not provided, derived from name.'),
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
  instructions: instructionsSchema,
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

// ============================================================================
// Preview Instructions Schemas
// ============================================================================

/**
 * POST /stored/agents/preview-instructions - Preview resolved instructions
 */
export const previewInstructionsBodySchema = z.object({
  blocks: z.array(agentInstructionBlockSchema).describe('Array of instruction blocks to resolve'),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .default({})
    .describe('Request context for variable interpolation and rule evaluation'),
});

/**
 * Response for POST /stored/agents/preview-instructions
 */
export const previewInstructionsResponseSchema = z.object({
  result: z.string().describe('The resolved instructions string'),
});

/**
 * Exported for use in agent-versions.ts schemas
 */
export { snapshotConfigSchema, scorerConfigSchema };
