/**
 * Workspace Handler Schemas
 *
 * Zod schemas specific to workspace handlers including skills schemas.
 */

import z from 'zod';

// =============================================================================
// Skills Path Parameter Schemas
// =============================================================================

export const skillNamePathParams = z.object({
  skillName: z.string().describe('Skill name identifier'),
});

export const skillReferencePathParams = skillNamePathParams.extend({
  referencePath: z.string().describe('Reference file path (URL encoded)'),
});

// =============================================================================
// Skills Query Parameter Schemas
// =============================================================================

export const searchSkillsQuerySchema = z.object({
  query: z.string().describe('Search query text'),
  topK: z.coerce.number().optional().default(5).describe('Maximum number of results'),
  minScore: z.coerce.number().optional().describe('Minimum relevance score threshold'),
  skillNames: z.string().optional().describe('Comma-separated list of skill names to search within'),
  includeReferences: z.coerce.boolean().optional().default(true).describe('Include reference files in search'),
});

// =============================================================================
// Skills Response Schemas
// =============================================================================

export const skillMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
});

export const skillSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('external'), packagePath: z.string() }),
  z.object({ type: z.literal('local'), projectPath: z.string() }),
  z.object({ type: z.literal('managed'), mastraPath: z.string() }),
]);

export const skillSchema = skillMetadataSchema.extend({
  path: z.string(),
  instructions: z.string(),
  source: skillSourceSchema,
  references: z.array(z.string()),
  scripts: z.array(z.string()),
  assets: z.array(z.string()),
});

export const listSkillsResponseSchema = z.object({
  skills: z.array(skillMetadataSchema),
  isSkillsConfigured: z.boolean().describe('Whether skills are configured in the workspace'),
});

export const getSkillResponseSchema = skillSchema;

/**
 * Agent skill response schema - similar to skillSchema but with optional fields
 * for when full skill details aren't available (e.g., inherited skills without
 * direct access to the Skills instance).
 */
export const getAgentSkillResponseSchema = skillMetadataSchema.extend({
  path: z.string().optional(),
  instructions: z.string().optional(),
  source: skillSourceSchema.optional(),
  references: z.array(z.string()).optional(),
  scripts: z.array(z.string()).optional(),
  assets: z.array(z.string()).optional(),
});

export const skillReferenceResponseSchema = z.object({
  skillName: z.string(),
  referencePath: z.string(),
  content: z.string(),
});

export const listReferencesResponseSchema = z.object({
  skillName: z.string(),
  references: z.array(z.string()),
});

export const skillSearchResultSchema = z.object({
  skillName: z.string(),
  source: z.string(),
  content: z.string(),
  score: z.number(),
  lineRange: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  scoreDetails: z
    .object({
      vector: z.number().optional(),
      bm25: z.number().optional(),
    })
    .optional(),
});

export const searchSkillsResponseSchema = z.object({
  results: z.array(skillSearchResultSchema),
  query: z.string(),
});
