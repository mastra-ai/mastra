import { z } from 'zod/v4';

/**
 * Agent Studio preferences: starred items, preview mode, appearance, view mode, scope.
 * All fields optional so clients can PATCH partial updates.
 */
export const agentStudioPreferencesSchema = z
  .object({
    starredAgents: z.array(z.string()).optional(),
    starredSkills: z.array(z.string()).optional(),
    previewMode: z.boolean().optional(),
    appearance: z.enum(['light', 'dark']).optional(),
    agentsView: z.enum(['grid', 'list']).optional(),
    agentsScope: z.enum(['all', 'mine', 'team']).optional(),
  })
  .describe('Agent Studio-specific preferences');

export const userPreferencesResponseSchema = z.object({
  userId: z.string(),
  agentStudio: agentStudioPreferencesSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const updateUserPreferencesBodySchema = z
  .object({
    agentStudio: agentStudioPreferencesSchema.optional(),
  })
  .describe('Partial update of user preferences. Missing keys are preserved.');
