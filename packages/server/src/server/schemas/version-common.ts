import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Query Parameter Schemas (shared across all version endpoints)
// ============================================================================

/**
 * Version order by configuration (shared)
 */
export const versionOrderBySchema = z.object({
  field: z.enum(['versionNumber', 'createdAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

/**
 * List versions query params (shared)
 */
export const listVersionsQuerySchema = createPagePaginationSchema(20).extend({
  orderBy: versionOrderBySchema.optional(),
});

/**
 * Compare versions query params (shared)
 */
export const compareVersionsQuerySchema = z.object({
  from: z.string().describe('Version ID (UUID) to compare from'),
  to: z.string().describe('Version ID (UUID) to compare to'),
});

// ============================================================================
// Body Parameter Schemas (shared)
// ============================================================================

/**
 * Create version body (shared)
 */
export const createVersionBodySchema = z.object({
  changeMessage: z.string().max(500).optional().describe('Optional message describing the changes'),
});

// ============================================================================
// Response Schemas (shared)
// ============================================================================

/**
 * Activate version response (shared)
 */
export const activateVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  activeVersionId: z.string(),
});

/**
 * Delete version response (shared)
 */
export const deleteVersionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Single diff entry for version comparison (shared)
 */
export const versionDiffEntrySchema = z.object({
  field: z.string().describe('The field path that changed'),
  previousValue: z.unknown().describe('The value in the "from" version'),
  currentValue: z.unknown().describe('The value in the "to" version'),
});

/**
 * Helper to create a list versions response schema for a domain-specific version schema.
 */
export function createListVersionsResponseSchema<T extends z.ZodTypeAny>(versionSchema: T) {
  return paginationInfoSchema.extend({
    versions: z.array(versionSchema),
  });
}

/**
 * Helper to create a compare versions response schema for a domain-specific version schema.
 */
export function createCompareVersionsResponseSchema<T extends z.ZodTypeAny>(versionSchema: T) {
  return z.object({
    diffs: z.array(versionDiffEntrySchema).describe('List of differences between versions'),
    fromVersion: versionSchema.describe('The source version'),
    toVersion: versionSchema.describe('The target version'),
  });
}
