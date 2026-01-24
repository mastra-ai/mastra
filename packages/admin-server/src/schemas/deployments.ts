import { z } from 'zod';
import { dateSchema, paginationQuerySchema } from './common';

/**
 * Deployment status enum.
 */
export const deploymentStatusSchema = z.enum([
  'pending',
  'building',
  'running',
  'stopped',
  'failed',
]);

/**
 * Deployment type enum.
 */
export const deploymentTypeSchema = z.enum([
  'production',
  'staging',
  'preview',
]);

/**
 * Encrypted environment variable override response schema.
 */
export const envVarOverrideResponseSchema = z.object({
  key: z.string(),
  isSecret: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

/**
 * Deployment response schema.
 */
export const deploymentResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  type: deploymentTypeSchema,
  branch: z.string(),
  slug: z.string(),
  status: deploymentStatusSchema,
  currentBuildId: z.string().uuid().nullable(),
  publicUrl: z.string().url().nullable(),
  internalHost: z.string().nullable(),
  envVarOverrides: z.array(envVarOverrideResponseSchema),
  autoShutdown: z.boolean(),
  expiresAt: dateSchema.nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type DeploymentResponse = z.infer<typeof deploymentResponseSchema>;

/**
 * Create deployment request body schema.
 */
export const createDeploymentBodySchema = z.object({
  type: deploymentTypeSchema,
  branch: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50).optional(),
  envVarOverrides: z.record(z.string()).optional(),
  autoShutdown: z.boolean().optional(),
});

export type CreateDeploymentBody = z.infer<typeof createDeploymentBodySchema>;

/**
 * Update deployment request body schema.
 */
export const updateDeploymentBodySchema = z.object({
  envVarOverrides: z.record(z.string()).optional(),
  autoShutdown: z.boolean().optional(),
});

export type UpdateDeploymentBody = z.infer<typeof updateDeploymentBodySchema>;

/**
 * Trigger deploy request body schema.
 */
export const triggerDeployBodySchema = z.object({
  commitSha: z.string().optional(),
  commitMessage: z.string().optional(),
});

export type TriggerDeployBody = z.infer<typeof triggerDeployBodySchema>;

/**
 * Rollback request body schema.
 */
export const rollbackBodySchema = z.object({
  buildId: z.string().uuid(),
});

export type RollbackBody = z.infer<typeof rollbackBodySchema>;

/**
 * List deployments query params.
 */
export const listDeploymentsQuerySchema = paginationQuerySchema.extend({
  type: deploymentTypeSchema.optional(),
  status: deploymentStatusSchema.optional(),
});

export type ListDeploymentsQuery = z.infer<typeof listDeploymentsQuerySchema>;
