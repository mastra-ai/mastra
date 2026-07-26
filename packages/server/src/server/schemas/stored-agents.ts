import { z } from 'zod/v4';
import { paginationInfoSchema, createPagePaginationSchema, statusQuerySchema } from './common';
import { defaultOptionsSchema } from './default-options';
import { serializedMemoryConfigSchema } from './memory-config';
import { ruleGroupSchema } from './rule-group';
import { workspaceSnapshotConfigSchema } from './stored-workspaces';
import { toolProvidersSchema } from './tool-providers';

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

export { statusQuerySchema };

/**
 * GET /stored/agents - List stored agents
 */
export const listStoredAgentsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  status: z
    .enum(['draft', 'published', 'archived'])
    .optional()
    .default('published')
    .describe('Filter agents by status (defaults to published)'),
  authorId: z.string().optional().describe('Filter agents by author identifier'),
  visibility: z.enum(['public']).optional().describe('Filter to only public agents'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter agents by metadata key-value pairs'),
  favoritedOnly: z
    .stringbool()
    .optional()
    .describe('When true, return only agents favorited by the caller (requires the `favorites` EE feature)'),
  pinFavoritedFor: z
    .string()
    .optional()
    .describe(
      'When set, treat the given subject (user/role) as the favoriting principal for `favoritedOnly` instead of the caller',
    ),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Scorer config schema with optional sampling and rules
 */
const scorerConfigSchema = z.object({
  description: z.string().optional(),
  sampling: z
    .union([
      z.object({ type: z.literal('none') }),
      z.object({ type: z.literal('ratio'), rate: z.number().min(0).max(1) }),
    ])
    .optional(),
  rules: ruleGroupSchema.optional(),
});

/**
 * Agent instruction block schema for prompt-block-based instructions.
 */
const agentInstructionBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('prompt_block_ref'), id: z.string() }),
  z.object({ type: z.literal('prompt_block'), content: z.string(), rules: ruleGroupSchema.optional() }),
]);

/**
 * Creates a schema for a field that can be either a static value or an array of conditional variants.
 * Each variant has a `value` and an optional `rules` (RuleGroup) that determines when it applies.
 */
function conditionalFieldSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  const variantSchema = z.object({
    value: valueSchema,
    rules: ruleGroupSchema.optional(),
  });
  return z.union([valueSchema, z.array(variantSchema)]);
}

/**
 * Instructions can be a plain string or an array of instruction blocks (text + prompt_block references).
 */
export const instructionsSchema = z
  .union([z.string(), z.array(agentInstructionBlockSchema)])
  .describe('System instructions for the agent (string or array of instruction blocks)');

/** Base model config schema (reused across snapshot and response schemas) */
const modelConfigSchema = z
  .object({
    provider: z.string().describe('Model provider (e.g., openai, anthropic)'),
    name: z.string().describe('Model name (e.g., gpt-4o, claude-3-opus)'),
  })
  .passthrough();

/** Per-tool config schema */
const toolConfigSchema = z.object({ description: z.string().optional(), rules: ruleGroupSchema.optional() });

/** Base tools config schema */
const toolsConfigSchema = z.record(z.string(), toolConfigSchema);

/** MCP client tools config schema — specifies which tools to use from an MCP client/server */
const mcpClientToolsConfigSchema = z.object({
  tools: z.record(z.string(), toolConfigSchema).optional(),
});

/** Per-skill config schema */
const skillConfigSchema = z.object({
  description: z.string().optional(),
  instructions: z.string().optional(),
  pin: z.string().optional(),
  strategy: z.enum(['latest', 'live']).optional(),
});

/** Skills config: skill IDs mapped to per-skill config */
const skillsConfigSchema = z.record(z.string(), skillConfigSchema);

/** Workspace reference: a stored workspace ID, inline config, or a registered workspace provider */
const workspaceRefSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('id'), workspaceId: z.string() }),
  z.object({ type: z.literal('inline'), config: workspaceSnapshotConfigSchema }),
  z.object({
    type: z.literal('provider'),
    provider: z.string().describe('Workspace provider identifier'),
    config: z.record(z.string(), z.unknown()).describe('Provider-specific configuration'),
  }),
]);

/** Screencast options for streaming browser frames */
const screencastOptionsSchema = z.object({
  format: z.enum(['jpeg', 'png']).optional().describe('Image format (default: jpeg)'),
  quality: z.number().min(0).max(100).optional().describe('JPEG quality 0-100 (default: 80)'),
  maxWidth: z.number().optional().describe('Max width in pixels (default: 1280)'),
  maxHeight: z.number().optional().describe('Max height in pixels (default: 720)'),
  everyNthFrame: z.number().optional().describe('Capture every Nth frame (default: 1)'),
});

/** Browser config: serializable browser configuration for stored agents */
const browserConfigSchema = z.object({
  provider: z.string().describe('Browser provider type (e.g., stagehand, playwright)'),
  headless: z.boolean().optional().describe('Run browser in headless mode (default: true)'),
  viewport: z
    .object({
      width: z.number().describe('Viewport width in pixels'),
      height: z.number().describe('Viewport height in pixels'),
    })
    .optional()
    .describe('Browser viewport dimensions'),
  timeout: z.number().optional().describe('Default timeout in milliseconds (default: 10000)'),
  screencast: screencastOptionsSchema.optional().describe('Screencast options for streaming browser frames'),
});

/** Browser reference: inline browser configuration */
const browserRefSchema = z.object({
  type: z.literal('inline'),
  config: browserConfigSchema,
});

/**
 * Processor phase enum matching ProcessorPhase type
 */
const processorPhaseSchema = z.enum([
  'processInput',
  'processInputStep',
  'processOutputStream',
  'processOutputResult',
  'processOutputStep',
]);

/**
 * A single processor step in a stored processor graph.
 */
const processorGraphStepSchema = z.object({
  id: z.string().describe('Unique ID for this step within the graph'),
  providerId: z.string().describe('ProcessorProvider ID that creates this processor'),
  config: z.record(z.string(), z.unknown()).describe('Configuration matching the provider configSchema'),
  enabledPhases: z.array(processorPhaseSchema).min(1).describe('Which processor phases to enable'),
});

/**
 * Processor graph entry schema.
 * Simplified version of SerializedStepFlowEntry, supporting step, parallel, and conditional.
 *
 * Uses a fixed nesting depth (3 levels) to avoid infinite recursion
 * when converting to JSON Schema / OpenAPI.
 */

/** Depth 3 (leaf): only step entries allowed */
const processorGraphEntryDepth3 = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step'), step: processorGraphStepSchema }),
]);

/** Depth 2: step, parallel, and conditional — children limited to depth 3 */
const processorGraphEntryDepth2 = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step'), step: processorGraphStepSchema }),
  z.object({ type: z.literal('parallel'), branches: z.array(z.array(processorGraphEntryDepth3)) }),
  z.object({
    type: z.literal('conditional'),
    conditions: z.array(
      z.object({
        steps: z.array(processorGraphEntryDepth3),
        rules: ruleGroupSchema.optional(),
      }),
    ),
  }),
]);

/** Depth 1 (top-level): step, parallel, and conditional — children limited to depth 2 */
const processorGraphEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('step'), step: processorGraphStepSchema }),
  z.object({ type: z.literal('parallel'), branches: z.array(z.array(processorGraphEntryDepth2)) }),
  z.object({
    type: z.literal('conditional'),
    conditions: z.array(
      z.object({
        steps: z.array(processorGraphEntryDepth2),
        rules: ruleGroupSchema.optional(),
      }),
    ),
  }),
]);

/**
 * A stored processor graph representing a pipeline of processors.
 */
const storedProcessorGraphSchema = z.object({
  steps: z.array(processorGraphEntrySchema).describe('Ordered list of processor graph entries'),
});

/**
 * Agent snapshot config fields (name, description, instructions, model, tools, etc.)
 * These live in version snapshots, not on the thin agent record.
 *
 * Fields that support conditional variants (StorageConditionalField) can be either
 * a static value OR an array of { value, rules? } variants evaluated at request time.
 */
const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: instructionsSchema,
  model: conditionalFieldSchema(modelConfigSchema).describe(
    'Model configuration — static value or array of conditional variants',
  ),
  tools: conditionalFieldSchema(toolsConfigSchema)
    .optional()
    .describe('Tool keys mapped to per-tool config — static or conditional'),
  defaultOptions: conditionalFieldSchema(defaultOptionsSchema)
    .optional()
    .describe('Default options for generate/stream calls — static or conditional'),
  workflows: conditionalFieldSchema(z.record(z.string(), toolConfigSchema))
    .optional()
    .describe('Workflow keys with optional per-workflow config — static or conditional'),
  agents: conditionalFieldSchema(z.record(z.string(), toolConfigSchema))
    .optional()
    .describe('Agent keys with optional per-agent config — static or conditional'),
  integrationTools: conditionalFieldSchema(z.record(z.string(), mcpClientToolsConfigSchema))
    .optional()
    .describe('Map of tool provider IDs to their tool configurations — static or conditional'),
  toolProviders: conditionalFieldSchema(toolProvidersSchema)
    .optional()
    .describe(
      'Tool provider connections and per-tool config (provider-agnostic). Coexists with the deprecated `integrationTools` field.',
    ),
  mcpClients: conditionalFieldSchema(z.record(z.string(), mcpClientToolsConfigSchema))
    .optional()
    .describe('Map of stored MCP client IDs to their tool configurations — static or conditional'),
  inputProcessors: conditionalFieldSchema(storedProcessorGraphSchema)
    .optional()
    .describe('Input processor graph — static or conditional'),
  outputProcessors: conditionalFieldSchema(storedProcessorGraphSchema)
    .optional()
    .describe('Output processor graph — static or conditional'),
  memory: conditionalFieldSchema(serializedMemoryConfigSchema)
    .optional()
    .describe('Memory configuration — static or conditional'),
  scorers: conditionalFieldSchema(z.record(z.string(), scorerConfigSchema))
    .optional()
    .describe('Scorer keys with optional sampling config — static or conditional'),
  skills: conditionalFieldSchema(skillsConfigSchema)
    .optional()
    .describe('Skill IDs mapped to per-skill config — static or conditional'),
  workspace: conditionalFieldSchema(workspaceRefSchema)
    .optional()
    .describe('Workspace reference (stored ID or inline config) — static or conditional'),
  browser: z
    .union([conditionalFieldSchema(browserRefSchema), z.boolean(), z.null()])
    .optional()
    .describe('Browser configuration — object config, true (apply default), false/null (disable)'),
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining valid request context variables for conditional rule evaluation'),
});

/**
 * Agent metadata fields (authorId, metadata, visibility) that live on the thin agent record.
 */
const agentMetadataSchema = z.object({
  authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the agent'),
  visibility: z
    .enum(['private', 'public'])
    .optional()
    .describe('Agent visibility: private (owner/admin only) or public (any reader)'),
});

/**
 * Snapshot config schema for create where `model` is optional. When omitted, the
 * builder applies `defaults.model` from `/editor/builder/settings` server-side.
 */
const snapshotConfigCreateSchema = snapshotConfigSchema.extend({
  model: conditionalFieldSchema(modelConfigSchema)
    .optional()
    .describe(
      'Model configuration — static value or array of conditional variants. ' +
        'When omitted, the builder default model is applied server-side.',
    ),
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
    visibility: z
      .enum(['private', 'public'])
      .optional()
      .describe('Agent visibility: private (owner/admin only) or public (any reader)'),
  })
  .merge(snapshotConfigCreateSchema);

/**
 * Snapshot config schema for updates where nullable fields (like memory) can be set to null to clear them.
 */
const snapshotConfigUpdateSchema = snapshotConfigSchema.extend({
  memory: z
    .union([conditionalFieldSchema(serializedMemoryConfigSchema), z.null()])
    .optional()
    .describe('Memory configuration — static, conditional, or null to disable memory'),
});

/**
 * PATCH /stored/agents/:storedAgentId - Update stored agent body
 * Optional metadata-level fields + optional config fields
 */
export const updateStoredAgentBodySchema = agentMetadataSchema
  .partial()
  .merge(snapshotConfigUpdateSchema.partial())
  .extend({
    changeMessage: z
      .string()
      .trim()
      .max(500)
      .optional()
      .describe('Optional message describing the changes for the auto-created version'),
    autoPublish: z
      .boolean()
      .optional()
      .describe('Immediately activate the auto-created version. Defaults to false when omitted.'),
  });

export const exportStoredAgentBodySchema = snapshotConfigUpdateSchema.partial();

export const openStoredAgentChangeRequestBodySchema = exportStoredAgentBodySchema.extend({
  changeMessage: z.string().trim().max(500).optional(),
  userName: z.string().trim().min(1).max(120).optional(),
  inspectOnly: z.boolean().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Resolved author object — server-side enrichment of `authorId` against the
 * configured auth provider. Only `id` is required; the other fields mirror
 * what `/auth/me` exposes and are optional because providers may not return
 * every field.
 */
export const resolvedAuthorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
});

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
  author: resolvedAuthorSchema.optional().describe('Resolved author identity (when an auth provider is configured)'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  favoriteCount: z.number().int().nonnegative().optional().describe('Number of users who have favorited this agent'),
  isFavorited: z.boolean().optional().describe('Whether the requesting user has favorited this agent'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  // Version snapshot config fields (resolved from active version)
  name: z.string().describe('Name of the agent'),
  description: z.string().optional().describe('Description of the agent'),
  instructions: instructionsSchema,
  model: conditionalFieldSchema(modelConfigSchema).describe(
    'Model configuration — static value or array of conditional variants',
  ),
  tools: conditionalFieldSchema(toolsConfigSchema)
    .optional()
    .describe('Tool keys mapped to per-tool config — static or conditional'),
  defaultOptions: conditionalFieldSchema(defaultOptionsSchema)
    .optional()
    .describe('Default options for generate/stream calls — static or conditional'),
  workflows: conditionalFieldSchema(z.record(z.string(), toolConfigSchema))
    .optional()
    .describe('Workflow keys with optional per-workflow config — static or conditional'),
  agents: conditionalFieldSchema(z.record(z.string(), toolConfigSchema))
    .optional()
    .describe('Agent keys with optional per-agent config — static or conditional'),
  integrationTools: conditionalFieldSchema(z.record(z.string(), mcpClientToolsConfigSchema))
    .optional()
    .describe('Map of tool provider IDs to their tool configurations — static or conditional'),
  toolProviders: conditionalFieldSchema(toolProvidersSchema)
    .optional()
    .describe(
      'Tool provider connections and per-tool config (provider-agnostic). Coexists with the deprecated `integrationTools` field.',
    ),
  mcpClients: conditionalFieldSchema(z.record(z.string(), mcpClientToolsConfigSchema))
    .optional()
    .describe('Map of stored MCP client IDs to their tool configurations — static or conditional'),
  inputProcessors: conditionalFieldSchema(storedProcessorGraphSchema)
    .optional()
    .describe('Input processor graph — static or conditional'),
  outputProcessors: conditionalFieldSchema(storedProcessorGraphSchema)
    .optional()
    .describe('Output processor graph — static or conditional'),
  memory: conditionalFieldSchema(serializedMemoryConfigSchema)
    .optional()
    .describe('Memory configuration — static or conditional'),
  scorers: conditionalFieldSchema(z.record(z.string(), scorerConfigSchema))
    .optional()
    .describe('Scorer keys with optional sampling config — static or conditional'),
  skills: conditionalFieldSchema(skillsConfigSchema)
    .optional()
    .describe('Skill IDs mapped to per-skill config — static or conditional'),
  workspace: conditionalFieldSchema(workspaceRefSchema)
    .optional()
    .describe('Workspace reference (stored ID or inline config) — static or conditional'),
  browser: z
    .union([conditionalFieldSchema(browserRefSchema), z.boolean(), z.null()])
    .optional()
    .describe('Browser configuration — object config, true (apply default), false/null (disable)'),
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining valid request context variables'),
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
    visibility: z.enum(['private', 'public']).optional(),
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
 * Response for GET /stored/agents/:storedAgentId/dependents
 *
 * `dependents` lists caller-readable stored agents whose resolved `agents` map
 * references the target. Includes both public and the caller's own private
 * agents — anything the caller already has read access to.
 * `hiddenCount` aggregates references from agents the caller cannot read
 * (cross-workspace private agents). Only populated when the target agent is
 * public, to avoid leaking cross-workspace structure for private targets.
 */
export const getStoredAgentDependentsResponseSchema = z.object({
  dependents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  hiddenCount: z.number().int().nonnegative(),
});

export const exportStoredAgentResponseSchema = z.object({
  agentId: z.string(),
  fileName: z.string(),
  content: z.string(),
  config: z.record(z.string(), z.unknown()),
});

export const openStoredAgentChangeRequestResponseSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  url: z.string(),
  ref: z.string().optional(),
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
export {
  snapshotConfigSchema,
  scorerConfigSchema,
  conditionalFieldSchema,
  modelConfigSchema,
  storedProcessorGraphSchema,
  processorGraphStepSchema,
  processorGraphEntrySchema,
  processorPhaseSchema,
  toolConfigSchema,
  toolsConfigSchema,
};
