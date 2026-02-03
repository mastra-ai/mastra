import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

/**
 * Path parameter for stored scorer ID
 */
export const storedScorerIdPathParams = z.object({
  scorerId: z.string().describe('Unique identifier for the stored scorer'),
});

/**
 * Path parameters for specific version routes
 */
export const scorerVersionIdPathParams = z.object({
  scorerId: z.string().describe('Unique identifier for the stored scorer'),
  versionId: z.string().describe('Unique identifier for the version (UUID)'),
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
 * Version order by configuration
 */
const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

/**
 * GET /api/stored/scorers - List stored scorers
 */
export const listStoredScorersQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  ownerId: z.string().optional().describe('Filter scorers by owner identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter scorers by metadata key-value pairs'),
});

/**
 * GET /api/stored/scorers/:scorerId/versions - List versions query params
 */
export const listScorerVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

/**
 * Model configuration schema
 */
const modelConfigSchema = z.object({
  provider: z.string().describe('Model provider (e.g., openai, anthropic)'),
  name: z.string().describe('Model name (e.g., gpt-4o, claude-3-5-sonnet)'),
  toolChoice: z.string().optional().describe('Optional tool choice configuration'),
  reasoningEffort: z.string().optional().describe('Optional reasoning effort configuration'),
});

/**
 * Score range schema with validation
 */
const scoreRangeSchema = z
  .object({
    min: z.number().describe('Minimum score value'),
    max: z.number().describe('Maximum score value'),
  })
  .refine(data => data.min < data.max, {
    message: 'min must be less than max',
  })
  .default({ min: 0, max: 1 });

/**
 * Base stored scorer schema (shared fields)
 */
const storedScorerBaseSchema = z.object({
  name: z.string().min(1).max(100).describe('Name of the scorer'),
  description: z.string().max(500).optional().describe('Description of what this scorer evaluates'),
  model: modelConfigSchema.describe('Judge model configuration'),
  prompt: z.string().min(1).describe('Judge prompt/instructions for evaluation'),
  scoreRange: scoreRangeSchema.describe('Score range configuration with min and max values'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the scorer'),
  ownerId: z.string().optional().describe('Owner identifier for multi-tenant filtering'),
});

/**
 * POST /api/stored/scorers - Create stored scorer body
 */
export const createStoredScorerBodySchema = storedScorerBaseSchema.extend({
  id: z.string().describe('Unique identifier for the scorer'),
});

/**
 * PATCH /api/stored/scorers/:scorerId - Update stored scorer body
 */
export const updateStoredScorerBodySchema = storedScorerBaseSchema.partial();

/**
 * POST /api/stored/scorers/:scorerId/versions - Create version body
 */
export const createScorerVersionBodySchema = z.object({
  name: z.string().max(100).optional().describe('Optional vanity name for this version'),
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Stored scorer object schema (full response)
 */
export const storedScorerSchema = storedScorerBaseSchema.extend({
  id: z.string(),
  activeVersionId: z.string().optional().describe('FK to the currently active version'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Scorer version object schema (full response)
 */
export const scorerVersionSchema = z.object({
  id: z.string().describe('Unique identifier for the version (UUID)'),
  scorerId: z.string().describe('ID of the scorer this version belongs to'),
  versionNumber: z.number().describe('Sequential version number (1, 2, 3, ...)'),
  name: z.string().optional().describe('Optional vanity name for this version'),
  snapshot: z.record(z.string(), z.unknown()).describe('Full scorer configuration snapshot'),
  changedFields: z.array(z.string()).optional().describe('Array of field names that changed from the previous version'),
  changeMessage: z.string().optional().describe('Optional message describing the changes'),
  createdAt: z.date().describe('When this version was created'),
});

/**
 * Response for GET /api/stored/scorers
 */
export const listStoredScorersResponseSchema = paginationInfoSchema.extend({
  scorers: z.array(storedScorerSchema),
});

/**
 * Response for GET /api/stored/scorers/:scorerId
 */
export const getStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for POST /api/stored/scorers
 */
export const createStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for PATCH /api/stored/scorers/:scorerId
 */
export const updateStoredScorerResponseSchema = storedScorerSchema;

/**
 * Response for DELETE /api/stored/scorers/:scorerId
 */
export const deleteStoredScorerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Response for GET /api/stored/scorers/:scorerId/versions
 */
export const listScorerVersionsResponseSchema = paginationInfoSchema.extend({
  versions: z.array(scorerVersionSchema),
});

/**
 * Response for GET /api/stored/scorers/:scorerId/versions/:versionId
 */
export const getScorerVersionResponseSchema = scorerVersionSchema;

/**
 * Response for POST /api/stored/scorers/:scorerId/versions
 */
export const createScorerVersionResponseSchema = scorerVersionSchema;

/**
 * Response for POST /api/stored/scorers/:scorerId/versions/:versionId/activate
 */
export const activateScorerVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

/**
 * Response for POST /api/stored/scorers/:scorerId/versions/:versionId/restore
 */
export const restoreScorerVersionResponseSchema = scorerVersionSchema.describe(
  'The newly created version from the restored snapshot',
);

/**
 * Response for DELETE /api/stored/scorers/:scorerId/versions/:versionId
 */
export const deleteScorerVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
