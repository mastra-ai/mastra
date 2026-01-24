import { z } from 'zod';
import { dateSchema, paginationQuerySchema } from './common';

/**
 * Team settings schema.
 */
export const teamSettingsSchema = z.object({
  maxProjects: z.number().int().positive().optional(),
  maxConcurrentDeployments: z.number().int().positive().optional(),
  defaultEnvVars: z.record(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TeamSettings = z.infer<typeof teamSettingsSchema>;

/**
 * Team response schema.
 */
export const teamResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  settings: teamSettingsSchema,
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type TeamResponse = z.infer<typeof teamResponseSchema>;

/**
 * Create team request body schema.
 */
export const createTeamBodySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(1).max(50),
  settings: teamSettingsSchema.optional(),
});

export type CreateTeamBody = z.infer<typeof createTeamBodySchema>;

/**
 * Update team request body schema.
 */
export const updateTeamBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  settings: teamSettingsSchema.optional(),
});

export type UpdateTeamBody = z.infer<typeof updateTeamBodySchema>;

/**
 * Team member response schema.
 */
export const teamMemberResponseSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
  }),
});

export type TeamMemberResponse = z.infer<typeof teamMemberResponseSchema>;

/**
 * Invite member request body schema.
 */
export const inviteMemberBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export type InviteMemberBody = z.infer<typeof inviteMemberBodySchema>;

/**
 * Team invite response schema.
 */
export const teamInviteResponseSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  invitedBy: z.string().uuid(),
  expiresAt: dateSchema,
  createdAt: dateSchema,
});

export type TeamInviteResponse = z.infer<typeof teamInviteResponseSchema>;

/**
 * Update member role request body schema.
 */
export const updateMemberRoleBodySchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

export type UpdateMemberRoleBody = z.infer<typeof updateMemberRoleBodySchema>;

/**
 * List teams query params.
 */
export const listTeamsQuerySchema = paginationQuerySchema;

export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>;

/**
 * List team members query params.
 */
export const listTeamMembersQuerySchema = paginationQuerySchema;

export type ListTeamMembersQuery = z.infer<typeof listTeamMembersQuerySchema>;

/**
 * List team invites query params.
 */
export const listTeamInvitesQuerySchema = paginationQuerySchema;

export type ListTeamInvitesQuery = z.infer<typeof listTeamInvitesQuerySchema>;
