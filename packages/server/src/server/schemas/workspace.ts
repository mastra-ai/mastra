/**
 * Workspace Schemas
 *
 * All Zod schemas for workspace operations including:
 * - Filesystem operations (read, write, list, delete, mkdir, stat)
 * - Search operations (search, index, unindex)
 * - Skills operations (list, get, search, references)
 */

import z from 'zod';

// =============================================================================
// Filesystem Path Schemas
// =============================================================================

export const fsPathParams = z.object({
  path: z.string().describe('File or directory path (URL encoded)'),
});

// =============================================================================
// Filesystem Query Schemas
// =============================================================================

export const fsReadQuerySchema = z.object({
  path: z.string().describe('Path to the file to read'),
  encoding: z.string().optional().describe('Encoding for text files (default: utf-8)'),
});

export const fsListQuerySchema = z.object({
  path: z.string().describe('Path to the directory to list'),
  recursive: z.coerce.boolean().optional().describe('Include subdirectories'),
});

export const fsStatQuerySchema = z.object({
  path: z.string().describe('Path to get info about'),
});

export const fsDeleteQuerySchema = z.object({
  path: z.string().describe('Path to delete'),
  recursive: z.coerce.boolean().optional().describe('Delete directories recursively'),
  force: z.coerce.boolean().optional().describe("Don't error if path doesn't exist"),
});

// =============================================================================
// Filesystem Body Schemas
// =============================================================================

export const fsWriteBodySchema = z.object({
  path: z.string().describe('Path to write to'),
  content: z.string().describe('Content to write (text or base64-encoded binary)'),
  encoding: z.enum(['utf-8', 'base64']).optional().default('utf-8').describe('Content encoding'),
  recursive: z.coerce.boolean().optional().describe('Create parent directories if needed'),
});

export const fsMkdirBodySchema = z.object({
  path: z.string().describe('Directory path to create'),
  recursive: z.coerce.boolean().optional().describe('Create parent directories if needed'),
});

// =============================================================================
// Filesystem Response Schemas
// =============================================================================

export const fileEntrySchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
});

export const fsReadResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

export const fsWriteResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

export const fsListResponseSchema = z.object({
  path: z.string(),
  entries: z.array(fileEntrySchema),
});

export const fsDeleteResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

export const fsMkdirResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

export const fsStatResponseSchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
  mimeType: z.string().optional(),
});

// =============================================================================
// Search Schemas
// =============================================================================

export const searchQuerySchema = z.object({
  query: z.string().describe('Search query text'),
  topK: z.coerce.number().optional().default(5).describe('Maximum number of results'),
  mode: z.enum(['bm25', 'vector', 'hybrid']).optional().describe('Search mode'),
  minScore: z.coerce.number().optional().describe('Minimum relevance score threshold'),
});

export const searchResultSchema = z.object({
  id: z.string().describe('Document ID (file path)'),
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

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  query: z.string(),
  mode: z.enum(['bm25', 'vector', 'hybrid']),
});

export const indexBodySchema = z.object({
  path: z.string().describe('Path to use as document ID'),
  content: z.string().describe('Content to index'),
  metadata: z.record(z.unknown()).optional().describe('Optional metadata'),
});

export const indexResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

export const unindexQuerySchema = z.object({
  path: z.string().describe('Path to unindex'),
});

export const unindexResponseSchema = z.object({
  success: z.boolean(),
  path: z.string(),
});

// =============================================================================
// Workspace Info Schema
// =============================================================================

export const workspaceInfoResponseSchema = z.object({
  isWorkspaceConfigured: z.boolean(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  capabilities: z
    .object({
      hasFilesystem: z.boolean(),
      hasSandbox: z.boolean(),
      canBM25: z.boolean(),
      canVector: z.boolean(),
      canHybrid: z.boolean(),
      hasSkills: z.boolean(),
    })
    .optional(),
});

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
