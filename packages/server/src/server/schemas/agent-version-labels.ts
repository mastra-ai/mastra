import { z } from 'zod/v4';

import { createPagePaginationSchema } from './common';

export const agentVersionLabelPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the stored agent'),
  label: z.string().describe('Custom version label'),
});

export const agentVersionLabelsPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the stored agent'),
});

export const listAgentVersionLabelsQuerySchema = createPagePaginationSchema(50);

export const setAgentVersionLabelBodySchema = z.object({
  versionId: z.string().min(1),
  expectedRevisionToken: z.union([z.string(), z.null()]),
});

export const deleteAgentVersionLabelQuerySchema = z.object({
  expectedRevisionToken: z.string(),
});

export const agentVersionLabelSchema = z.object({
  name: z.string(),
  kind: z.enum(['custom', 'production', 'latest']),
  versionId: z.string(),
  versionNumber: z.number().int().positive(),
  revisionToken: z.string().optional(),
  updatedAt: z.string().datetime().optional(),
});

export const listAgentVersionLabelsResponseSchema = z.object({
  labels: z.array(agentVersionLabelSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    perPage: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
});

export const deleteAgentVersionLabelResponseSchema = z.object({
  success: z.literal(true),
  deleted: z.boolean(),
});

export const versionLabelApiErrorCodeSchema = z.enum([
  'INVALID_VERSION_SELECTOR',
  'INVALID_LABEL',
  'RESERVED_LABEL',
  'ENTITY_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'LABEL_NOT_FOUND',
  'LABEL_MOVE_CONFLICT',
  'PINNED_VERSION_CONFLICT',
  'VERSION_IN_USE_BY_LABEL',
  'VERSION_LABEL_INTEGRITY_ERROR',
  'VERSION_LABELS_UNSUPPORTED',
]);

export const versionLabelApiErrorSchema = z.object({
  error: z.object({
    code: versionLabelApiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type AgentVersionLabel = z.infer<typeof agentVersionLabelSchema>;
export type ListAgentVersionLabelsResponse = z.infer<typeof listAgentVersionLabelsResponseSchema>;
export type VersionLabelApiErrorCode = z.infer<typeof versionLabelApiErrorCodeSchema>;
