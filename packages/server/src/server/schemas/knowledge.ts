import z from 'zod';

// Path parameter schemas
export const namespacePathParams = z.object({
  namespace: z.string().describe('Knowledge namespace identifier'),
});

export const artifactKeyPathParams = namespacePathParams.extend({
  artifactKey: z.string().describe('Artifact key within the namespace'),
});

// Query parameter schemas
export const listArtifactsQuerySchema = z.object({
  prefix: z.string().optional().describe('Filter artifacts by key prefix'),
});

export const searchKnowledgeQuerySchema = z.object({
  query: z.string().describe('Search query text'),
  topK: z.coerce.number().optional().default(5).describe('Maximum number of results'),
  minScore: z.coerce.number().optional().describe('Minimum relevance score threshold'),
  mode: z.enum(['vector', 'bm25', 'hybrid']).optional().describe('Search mode'),
  vectorWeight: z.coerce.number().optional().describe('Weight for vector search in hybrid mode (0-1)'),
});

// Body schemas
export const createNamespaceBodySchema = z.object({
  namespace: z.string().describe('Namespace identifier'),
  description: z.string().optional().describe('Optional description for the namespace'),
  enableBM25: z.boolean().optional().default(true).describe('Enable BM25 keyword search'),
  vectorConfig: z
    .object({
      vectorStoreName: z.string().describe('Name of the vector store to use'),
      indexName: z.string().describe('Index name in the vector store'),
      embedderName: z.string().optional().describe('Name of the embedder to use'),
    })
    .optional()
    .describe('Optional vector search configuration'),
});

export const addTextArtifactBodySchema = z.object({
  key: z.string().describe('Unique key for the artifact'),
  content: z.string().describe('Text content of the artifact'),
  metadata: z.record(z.unknown()).optional().describe('Optional metadata'),
  skipIndex: z.boolean().optional().describe('If true, artifact will not be indexed for search (static artifact)'),
});

export const addFileArtifactBodySchema = z.object({
  key: z.string().describe('Unique key for the artifact'),
  filename: z.string().describe('Original filename'),
  mimeType: z.string().describe('MIME type of the file'),
  content: z.string().describe('Base64 encoded file content'),
  metadata: z.record(z.unknown()).optional().describe('Optional metadata'),
  skipIndex: z.boolean().optional().describe('If true, artifact will not be indexed for search (static artifact)'),
});

// Response schemas
export const namespaceSchema = z.object({
  namespace: z.string(),
  description: z.string().optional(),
  artifactCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  hasBM25: z.boolean(),
  hasVector: z.boolean(),
});

export const listNamespacesResponseSchema = z.object({
  namespaces: z.array(namespaceSchema),
  isKnowledgeConfigured: z.boolean().describe('Whether a Knowledge instance is registered with Mastra'),
});

export const artifactSchema = z.object({
  key: z.string(),
  type: z.enum(['text', 'file', 'image']),
  size: z.number().optional(),
  mimeType: z.string().optional(),
  createdAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listArtifactsResponseSchema = z.object({
  artifacts: z.array(artifactSchema),
  namespace: z.string(),
});

export const getArtifactResponseSchema = z.object({
  key: z.string(),
  content: z.string(),
  type: z.enum(['text', 'file', 'image']),
  metadata: z.record(z.unknown()).optional(),
});

export const addArtifactResponseSchema = z.object({
  success: z.boolean(),
  key: z.string(),
});

export const deleteArtifactResponseSchema = z.object({
  success: z.boolean(),
  key: z.string(),
});

export const searchResultSchema = z.object({
  key: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()).optional(),
  scoreDetails: z
    .object({
      vector: z.number().optional(),
      bm25: z.number().optional(),
    })
    .optional(),
});

export const searchKnowledgeResponseSchema = z.object({
  results: z.array(searchResultSchema),
  query: z.string(),
  mode: z.enum(['vector', 'bm25', 'hybrid']),
  namespace: z.string(),
});

export const createNamespaceResponseSchema = namespaceSchema;

export const deleteNamespaceResponseSchema = z.object({
  success: z.boolean(),
  namespace: z.string(),
});
