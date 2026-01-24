import { z } from 'zod';
import { dateSchema, paginationQuerySchema } from './common';

/**
 * Local source configuration schema.
 */
export const localSourceConfigSchema = z.object({
  path: z.string().min(1),
});

/**
 * GitHub source configuration schema.
 */
export const githubSourceConfigSchema = z.object({
  repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  installationId: z.string(),
  isPrivate: z.boolean().optional().default(false),
});

/**
 * Source configuration discriminated union.
 */
export const sourceConfigSchema = z.union([
  localSourceConfigSchema,
  githubSourceConfigSchema,
]);

/**
 * Encrypted environment variable response schema.
 */
export const encryptedEnvVarResponseSchema = z.object({
  key: z.string(),
  isSecret: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type EncryptedEnvVarResponse = z.infer<typeof encryptedEnvVarResponseSchema>;

/**
 * Project response schema.
 */
export const projectResponseSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  sourceType: z.enum(['local', 'github']),
  sourceConfig: sourceConfigSchema,
  defaultBranch: z.string(),
  envVars: z.array(encryptedEnvVarResponseSchema),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type ProjectResponse = z.infer<typeof projectResponseSchema>;

/**
 * Create project request body schema.
 */
export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  sourceType: z.enum(['local', 'github']),
  sourceConfig: sourceConfigSchema,
  defaultBranch: z.string().optional().default('main'),
});

export type CreateProjectBody = z.infer<typeof createProjectBodySchema>;

/**
 * Update project request body schema.
 */
export const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  defaultBranch: z.string().optional(),
  sourceConfig: sourceConfigSchema.optional(),
});

export type UpdateProjectBody = z.infer<typeof updateProjectBodySchema>;

/**
 * Set environment variable request body schema.
 */
export const setEnvVarBodySchema = z.object({
  key: z.string().min(1).max(256).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  value: z.string(),
  isSecret: z.boolean().optional().default(false),
});

export type SetEnvVarBody = z.infer<typeof setEnvVarBodySchema>;

/**
 * Project API token response schema.
 */
export const projectApiTokenResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  tokenPrefix: z.string(),
  scopes: z.array(z.string()),
  lastUsedAt: dateSchema.nullable(),
  expiresAt: dateSchema.nullable(),
  createdAt: dateSchema,
});

export type ProjectApiTokenResponse = z.infer<typeof projectApiTokenResponseSchema>;

/**
 * Create project API token request body schema.
 */
export const createApiTokenBodySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional().default(['read', 'write']),
  expiresInDays: z.number().int().positive().optional(),
});

export type CreateApiTokenBody = z.infer<typeof createApiTokenBodySchema>;

/**
 * Create project API token response schema (includes the actual token value).
 */
export const createApiTokenResponseSchema = projectApiTokenResponseSchema.extend({
  token: z.string(),
});

export type CreateApiTokenResponse = z.infer<typeof createApiTokenResponseSchema>;

/**
 * List projects query params.
 */
export const listProjectsQuerySchema = paginationQuerySchema;

export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

/**
 * List environment variables query params.
 */
export const listEnvVarsQuerySchema = z.object({
  includeSecrets: z.coerce.boolean().optional().default(false),
});

export type ListEnvVarsQuery = z.infer<typeof listEnvVarsQuerySchema>;

/**
 * List API tokens query params.
 */
export const listApiTokensQuerySchema = paginationQuerySchema;

export type ListApiTokensQuery = z.infer<typeof listApiTokensQuerySchema>;
