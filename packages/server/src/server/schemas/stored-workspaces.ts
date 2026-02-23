import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedWorkspaceIdPathParams = z.object({
  storedWorkspaceId: z.string().describe('Unique identifier for the stored workspace'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export const listStoredWorkspacesQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  authorId: z.string().optional().describe('Filter workspaces by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter workspaces by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const filesystemConfigSchema = z.object({
  provider: z.string().describe('Filesystem provider name'),
  config: z.record(z.string(), z.unknown()).describe('Filesystem provider configuration'),
});

const sandboxConfigSchema = z.object({
  provider: z.string().describe('Sandbox provider name'),
  config: z.record(z.string(), z.unknown()).describe('Sandbox provider configuration'),
});

const searchConfigSchema = z.object({
  vectorProvider: z.string().optional().describe('Vector store provider identifier'),
  vectorConfig: z.record(z.string(), z.unknown()).optional().describe('Vector store provider-specific configuration'),
  embedderProvider: z.string().optional().describe('Embedder provider identifier'),
  embedderModel: z.string().optional().describe('Embedder model name'),
  embedderConfig: z.record(z.string(), z.unknown()).optional().describe('Embedder provider-specific configuration'),
  bm25: z
    .union([z.boolean(), z.object({ k1: z.number().optional(), b: z.number().optional() })])
    .optional()
    .describe('BM25 keyword search config'),
  searchIndexName: z.string().optional().describe('Custom index name for the vector store'),
  autoIndexPaths: z.array(z.string()).optional().describe('Paths to auto-index on init'),
});

const workspaceToolConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Whether the tool is enabled'),
  requireApproval: z.boolean().optional().describe('Whether the tool requires user approval before execution'),
  requireReadBeforeWrite: z
    .boolean()
    .optional()
    .describe('For write tools: require reading a file before writing to it'),
});

const workspaceToolsConfigSchema = z.object({
  enabled: z.boolean().optional().describe('Default: whether all tools are enabled'),
  requireApproval: z.boolean().optional().describe('Default: whether all tools require user approval'),
  tools: z
    .record(z.string(), workspaceToolConfigSchema)
    .optional()
    .describe('Per-tool overrides keyed by workspace tool name'),
});

const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the workspace'),
  description: z.string().optional().describe('Description of the workspace'),
  filesystem: filesystemConfigSchema.optional().describe('Filesystem configuration'),
  sandbox: sandboxConfigSchema.optional().describe('Sandbox configuration'),
  mounts: z.record(z.string(), filesystemConfigSchema).optional().describe('Mounted filesystems keyed by mount path'),
  search: searchConfigSchema.optional().describe('Search configuration'),
  skills: z.array(z.string()).optional().describe('Array of skill IDs'),
  tools: workspaceToolsConfigSchema.optional().describe('Workspace tool configuration'),
  autoSync: z.boolean().optional().describe('Whether to automatically sync the workspace'),
  operationTimeout: z.number().optional().describe('Operation timeout in milliseconds'),
});

export const createStoredWorkspaceBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the workspace'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredWorkspaceBodySchema = z
  .object({
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedWorkspaceSchema = z.object({
  id: z.string(),
  status: z.string().describe('Workspace status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Name of the workspace'),
  description: z.string().optional().describe('Description of the workspace'),
  filesystem: filesystemConfigSchema.optional().describe('Filesystem configuration'),
  sandbox: sandboxConfigSchema.optional().describe('Sandbox configuration'),
  mounts: z.record(z.string(), filesystemConfigSchema).optional().describe('Mounted filesystems keyed by mount path'),
  search: searchConfigSchema.optional().describe('Search configuration'),
  skills: z.array(z.string()).optional().describe('Array of skill IDs'),
  tools: workspaceToolsConfigSchema.optional().describe('Workspace tool configuration'),
  autoSync: z.boolean().optional().describe('Whether to automatically sync the workspace'),
  operationTimeout: z.number().optional().describe('Operation timeout in milliseconds'),
});

export const listStoredWorkspacesResponseSchema = paginationInfoSchema.extend({
  workspaces: z.array(storedWorkspaceSchema),
});

export const getStoredWorkspaceResponseSchema = storedWorkspaceSchema;
export const createStoredWorkspaceResponseSchema = storedWorkspaceSchema;

export const updateStoredWorkspaceResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedWorkspaceSchema,
]);

export const deleteStoredWorkspaceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export { snapshotConfigSchema as workspaceSnapshotConfigSchema };
