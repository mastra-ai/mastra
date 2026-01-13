import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';
import { storedAgentSchema } from './stored-agents';

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
 * GET /api/stored/agents/:agentId/versions - List versions query params
 */
export const listVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

/**
 * GET /api/stored/agents/:agentId/versions/compare - Compare versions query params
 */
export const compareVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * POST /api/stored/agents/:agentId/versions - Create version body
 */
export const createVersionBodySchema = z.object({
  name: z.string().max(100).optional().describe('Optional vanity name for this version'),
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Agent version object schema (full response)
 */
export const agentVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  agentId: z.string().describe('ID of the agent this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  name: z.string().optional().describe('Optional vanity name for this version'),
  snapshot: storedAgentSchema.describe('Full agent configuration snapshot'),
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.date().describe('When this version was created'),
});

/**
 * Response for GET /api/stored/agents/:agentId/versions
 */
export const listVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(agentVersionSchema),
});

/**
 * Response for GET /api/stored/agents/:agentId/versions/:versionId
 */
export const getVersionResponseSchema = agentVersionSchema;

/**
 * Response for POST /api/stored/agents/:agentId/versions
 */
export const createVersionResponseSchema = agentVersionSchema;

/**
 * Response for POST /api/stored/agents/:agentId/versions/:versionId/activate
 */
export const activateVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

/**
 * Response for POST /api/stored/agents/:agentId/versions/:versionId/restore
 */
export const restoreVersionResponseSchema = agentVersionSchema.describe(
  'The newly created version from the restored snapshot',
);

/**
 * Response for DELETE /api/stored/agents/:agentId/versions/:versionId
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
 * Response for GET /api/stored/agents/:agentId/versions/compare
 */
export const compareVersionsResponseSchema = z.object({
  diffs: z.array(versionDiffEntrySchema).describe('List of differences between versions'),
  fromVersion: agentVersionSchema.describe('The source version'),
  toVersion: agentVersionSchema.describe('The target version'),
});
