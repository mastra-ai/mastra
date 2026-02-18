import z from 'zod';

import { paginationInfoSchema, createPagePaginationSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const storedSkillIdPathParams = z.object({
  storedSkillId: z.string().describe('Unique identifier for the stored skill'),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

export const listStoredSkillsQuerySchema = createPagePaginationSchema(100).extend({
  orderBy: storageOrderBySchema.optional(),
  authorId: z.string().optional().describe('Filter skills by author identifier'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Filter skills by metadata key-value pairs'),
});

// ============================================================================
// Body Parameter Schemas
// ============================================================================

const sourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('external'),
    packagePath: z.string().describe('Package path for external source'),
  }),
  z.object({
    type: z.literal('local'),
    projectPath: z.string().describe('Project path for local source'),
  }),
  z.object({
    type: z.literal('managed'),
    mastraPath: z.string().describe('Mastra path for managed source'),
  }),
]);

const snapshotConfigSchema = z.object({
  name: z.string().describe('Name of the skill'),
  description: z.string().describe('Description of what the skill does and when to use it'),
  instructions: z.string().describe('Markdown instructions for the skill'),
  license: z.string().optional().describe('License identifier for the skill'),
  compatibility: z.unknown().optional().describe('Compatibility requirements'),
  source: sourceSchema.optional().describe('Source location of the skill'),
  references: z.array(z.string()).optional().describe('List of reference file paths'),
  scripts: z.array(z.string()).optional().describe('List of script file paths'),
  assets: z.array(z.string()).optional().describe('List of asset file paths'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the skill'),
});

export const createStoredSkillBodySchema = z
  .object({
    id: z.string().optional().describe('Unique identifier. If not provided, derived from name.'),
    authorId: z.string().optional().describe('Author identifier for multi-tenant filtering'),
  })
  .merge(snapshotConfigSchema);

export const updateStoredSkillBodySchema = z
  .object({
    authorId: z.string().optional(),
  })
  .partial()
  .merge(snapshotConfigSchema.partial());

// ============================================================================
// Response Schemas
// ============================================================================

export const storedSkillSchema = z.object({
  id: z.string(),
  status: z.string().describe('Skill status: draft, published, or archived'),
  activeVersionId: z.string().optional(),
  authorId: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  name: z.string().describe('Name of the skill'),
  description: z.string().describe('Description of what the skill does and when to use it'),
  instructions: z.string().describe('Markdown instructions for the skill'),
  license: z.string().optional().describe('License identifier for the skill'),
  compatibility: z.unknown().optional().describe('Compatibility requirements'),
  source: sourceSchema.optional().describe('Source location of the skill'),
  references: z.array(z.string()).optional().describe('List of reference file paths'),
  scripts: z.array(z.string()).optional().describe('List of script file paths'),
  assets: z.array(z.string()).optional().describe('List of asset file paths'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Additional metadata for the skill'),
});

export const listStoredSkillsResponseSchema = paginationInfoSchema.extend({
  skills: z.array(storedSkillSchema),
});

export const getStoredSkillResponseSchema = storedSkillSchema;
export const createStoredSkillResponseSchema = storedSkillSchema;

export const updateStoredSkillResponseSchema = z.union([
  z.object({
    id: z.string(),
    status: z.string(),
    activeVersionId: z.string().optional(),
    authorId: z.string().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  }),
  storedSkillSchema,
]);

export const deleteStoredSkillResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============================================================================
// Publish / Rollback Schemas
// ============================================================================

export const publishStoredSkillBodySchema = z.object({
  skillPath: z.string().describe('Path to the skill directory on the server filesystem (containing SKILL.md)'),
});

export const publishStoredSkillResponseSchema = storedSkillSchema;
