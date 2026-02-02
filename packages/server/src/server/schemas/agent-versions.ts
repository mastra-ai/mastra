import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';
import { scorerConfigSchema } from './stored-agents';

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
// Query Parameter Schemas
// ============================================================================

/**
 * Version order by configuration
 */
const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

/**
 * GET /stored/agents/:agentId/versions - List versions query params
 */
export const listVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

/**
 * GET /stored/agents/:agentId/versions/compare - Compare versions query params
 */
export const compareVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * POST /stored/agents/:agentId/versions - Create version body
 * No vanity name -- the config `name` is part of the snapshot config fields.
 */
export const createVersionBodySchema = z.object({
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
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
  inputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  outputProcessors: z.array(z.string()).optional().describe('Array of processor keys to resolve from Mastra registry'),
  memory: z.record(z.string(), z.unknown()).optional().describe('Memory configuration object'),
  scorers: z.record(z.string(), scorerConfigSchema).optional().describe('Scorer keys with optional sampling config'),
  // Version metadata fields
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.coerce.date().describe('When this version was created'),
});

/**
 * Response for GET /stored/agents/:agentId/versions
 */
export const listVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(agentVersionSchema),
});

/**
 * Response for GET /stored/agents/:agentId/versions/:versionId
 */
export const getVersionResponseSchema = agentVersionSchema;

/**
 * Response for POST /stored/agents/:agentId/versions
 */
export const createVersionResponseSchema = agentVersionSchema;

/**
 * Response for POST /stored/agents/:agentId/versions/:versionId/activate
 */
export const activateVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

/**
 * Response for POST /stored/agents/:agentId/versions/:versionId/restore
 */
export const restoreVersionResponseSchema = agentVersionSchema.describe(
  'The newly created version from the restored configuration',
);

/**
 * Response for DELETE /stored/agents/:agentId/versions/:versionId
 */
export const deleteVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Single diff entry for version comparison
 */
export const versionDiffEntrySchema = z.object({
  field: z.string().describe('The field path that changed'),
  previousValue: z.unknown().describe('The value in the "from" version'),
  currentValue: z.unknown().describe('The value in the "to" version'),
});

/**
 * Response for GET /stored/agents/:agentId/versions/compare
 */
export const compareVersionsResponseSchema = z.object({
  diffs: z.array(versionDiffEntrySchema).describe('List of differences between versions'),
  fromVersion: agentVersionSchema.describe('The source version'),
  toVersion: agentVersionSchema.describe('The target version'),
});
