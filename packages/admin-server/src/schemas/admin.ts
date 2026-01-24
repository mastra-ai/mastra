import { z } from 'zod';
import { dateSchema, paginationQuerySchema } from './common';

/**
 * License tier enum.
 */
export const licenseTierSchema = z.enum([
  'community',
  'team',
  'enterprise',
]);

/**
 * License info response schema.
 */
export const licenseInfoResponseSchema = z.object({
  valid: z.boolean(),
  tier: licenseTierSchema,
  maxTeams: z.number().int().positive().nullable(),
  maxProjects: z.number().int().positive().nullable(),
  maxUsersPerTeam: z.number().int().positive().nullable(),
  features: z.array(z.string()),
  expiresAt: dateSchema.nullable(),
});

export type LicenseInfoResponse = z.infer<typeof licenseInfoResponseSchema>;

/**
 * Update license request body schema.
 */
export const updateLicenseBodySchema = z.object({
  licenseKey: z.string().min(1),
});

export type UpdateLicenseBody = z.infer<typeof updateLicenseBodySchema>;

/**
 * User summary response schema (for admin listing).
 */
export const userSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  teamCount: z.number().int().nonnegative(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type UserSummaryResponse = z.infer<typeof userSummaryResponseSchema>;

/**
 * Team summary response schema (for admin listing).
 */
export const teamSummaryResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  memberCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type TeamSummaryResponse = z.infer<typeof teamSummaryResponseSchema>;

/**
 * System stats response schema.
 */
export const systemStatsResponseSchema = z.object({
  userCount: z.number().int().nonnegative(),
  teamCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  deploymentCount: z.number().int().nonnegative(),
  runningDeploymentCount: z.number().int().nonnegative(),
  buildCount: z.number().int().nonnegative(),
  successfulBuildCount: z.number().int().nonnegative(),
  failedBuildCount: z.number().int().nonnegative(),
});

export type SystemStatsResponse = z.infer<typeof systemStatsResponseSchema>;

/**
 * List users query params (for admin).
 */
export const listAllUsersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

export type ListAllUsersQuery = z.infer<typeof listAllUsersQuerySchema>;

/**
 * List teams query params (for admin).
 */
export const listAllTeamsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

export type ListAllTeamsQuery = z.infer<typeof listAllTeamsQuerySchema>;
