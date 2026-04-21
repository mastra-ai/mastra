import { z } from 'zod/v4';
import { paginationInfoSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const projectIdPathParams = z.object({
  projectId: z.string().describe('Unique identifier for the project (stored agent id)'),
});

export const projectAgentPathParams = projectIdPathParams.extend({
  agentId: z.string().describe('Invited sub-agent id'),
});

export const projectTaskPathParams = projectIdPathParams.extend({
  taskId: z.string().describe('Project task id'),
});

// ============================================================================
// Domain Schemas
// ============================================================================

export const projectTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  assigneeAgentId: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'blocked']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const projectMetadataSchema = z.object({
  isProject: z.literal(true),
  tasks: z.array(projectTaskSchema),
  invitedAgentIds: z.array(z.string()),
  invitedSkillIds: z.array(z.string()),
});

const modelRefSchema = z.object({
  provider: z.string(),
  name: z.string(),
});

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  model: modelRefSchema.optional(),
  authorId: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  project: projectMetadataSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// Body Schemas
// ============================================================================

export const createProjectBodySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  model: modelRefSchema,
  invitedAgentIds: z.array(z.string()).optional().default([]),
  authorId: z
    .string()
    .optional()
    .describe('Owner of the project. When auth is configured, only the author can view or edit it.'),
});

export const updateProjectBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  model: modelRefSchema.optional(),
});

export const inviteAgentBodySchema = z.object({
  agentId: z.string(),
});

export const addProjectTaskBodySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  assigneeAgentId: z.string().optional(),
});

export const updateProjectTaskBodySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'blocked']).optional(),
  assigneeAgentId: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const listProjectsResponseSchema = paginationInfoSchema.extend({
  projects: z.array(projectSchema),
});

export const projectResponseSchema = projectSchema;

export const deleteProjectResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export const projectTaskResponseSchema = projectTaskSchema;
