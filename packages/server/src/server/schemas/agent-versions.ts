import z from 'zod';
import { defaultOptionsSchema } from './default-options';
import { serializedMemoryConfigSchema } from './memory-config';
import {
  scorerConfigSchema,
  instructionsSchema,
  conditionalFieldSchema,
  modelConfigSchema,
  toolConfigSchema,
  toolsConfigSchema,
  storedProcessorGraphSchema,
} from './stored-agents';
import {
  listVersionsQuerySchema,
  compareVersionsQuerySchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
  createListVersionsResponseSchema,
  createCompareVersionsResponseSchema,
} from './version-common';

const mcpClientToolsConfigSchema = z.object({
  tools: z.record(z.string(), toolConfigSchema).optional(),
});

// Re-export shared schemas for backwards compat
export {
  listVersionsQuerySchema,
  compareVersionsQuerySchema,
  createVersionBodySchema,
  activateVersionResponseSchema,
  deleteVersionResponseSchema,
  versionDiffEntrySchema,
};

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameters for agent version routes
 */
export const agentVersionPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the stored agent'),
});

/**
 * Path parameters for specific version routes
 */
export const versionIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the stored agent'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Agent version object schema (full response)
 * Config fields are top-level on the version (no nested snapshot object).
 * Extends StorageAgentSnapshotType fields.
 */
export const agentVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  agentId: z.string().describe('ID of the agent this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  // Top-level config fields (from StorageAgentSnapshotType)
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
  requestContextSchema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('JSON Schema defining valid request context variables'),
  // Version metadata fields
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

/**
 * Response for GET /stored/agents/:agentId/versions
 */
export const listVersionsResponseSchema = createListVersionsResponseSchema(agentVersionSchema);

/**
 * Response for GET /stored/agents/:agentId/versions/:versionId
 */
export const getVersionResponseSchema = agentVersionSchema;

/**
 * Response for POST /stored/agents/:agentId/versions
 */
export const createVersionResponseSchema = agentVersionSchema.partial().merge(
  z.object({
    // These fields are always present in a version response
    id: z.string().describe('Unique identifier for the version (UUID)'),
    agentId: z.string().describe('ID of the agent this version belongs to'),
    versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
    createdAt: z.coerce.date().describe('When this version was created'),
  }),
);

/**
 * Response for POST /stored/agents/:agentId/versions/:versionId/restore
 */
export const restoreVersionResponseSchema = agentVersionSchema.describe(
  'The newly created version from the restored configuration',
);

/**
 * Response for GET /stored/agents/:agentId/versions/compare
 */
export const compareVersionsResponseSchema: ReturnType<
  typeof createCompareVersionsResponseSchema<typeof agentVersionSchema>
> = createCompareVersionsResponseSchema(agentVersionSchema);
