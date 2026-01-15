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
  content: z.string().describe('Content to write'),
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
