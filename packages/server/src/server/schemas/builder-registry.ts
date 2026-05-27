/**
 * Builder Registry Schemas
 *
 * Schemas for the Agent Builder skill registry routes. These are distinct from
 * the workspace skills.sh proxy schemas because:
 *   - Builder routes are not scoped to a workspace.
 *   - Builder install does not accept a `mount` field.
 *   - Builder install body carries visibility + the resolved registry id.
 *   - Builder install response returns the created stored skill id.
 *
 * The upstream skills.sh proxy response shapes are reused via the shared
 * `skillsShSearchResponseSchema`, `skillsShListResponseSchema`, and
 * `skillsShPreviewResponseSchema` since the wire shape from skills.sh is
 * registry-independent.
 */

import { z } from 'zod/v4';

// =============================================================================
// Registry list
// =============================================================================

/** Single entry in the registries list. */
export const builderRegistryEntrySchema = z.object({
  id: z.literal('skills-sh').describe('Stable registry identifier'),
  enabled: z.boolean().describe('Whether this registry is enabled in the running deployment'),
  label: z.string().describe('Human-readable registry name'),
});

/** Response for `GET /editor/builder/registries`. */
export const builderRegistriesResponseSchema = z.object({
  registries: z.array(builderRegistryEntrySchema),
});

// =============================================================================
// Search / popular / preview
// =============================================================================

/** Path params used by every per-registry route. */
export const builderRegistryPathParams = z.object({
  registryId: z.string().describe('Registry identifier (e.g. "skills-sh")'),
});

export const builderRegistrySearchQuerySchema = z.object({
  q: z.string().describe('Search query'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10).describe('Maximum number of results (1-100)'),
});

export const builderRegistryPopularQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(10).describe('Maximum number of results (1-100)'),
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .optional()
      .default(0)
      .describe('Offset for pagination (must be a multiple of `limit`)'),
  })
  .refine(args => args.offset % args.limit === 0, {
    message: 'offset must be a multiple of limit (the upstream registry pages by `limit`)',
    path: ['offset'],
  });

export const builderRegistryPreviewQuerySchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  path: z.string().describe('Skill name within repo'),
});

// =============================================================================
// Install
// =============================================================================

/**
 * Body for `POST /editor/builder/registries/:registryId/install`.
 *
 * Visibility behaves like the standard stored-skill create flow: optional,
 * defaults to private when the caller is authenticated.
 */
export const builderRegistryInstallBodySchema = z.object({
  owner: z.string().describe('GitHub repository owner'),
  repo: z.string().describe('GitHub repository name'),
  skillName: z.string().describe('Skill name from the registry'),
  visibility: z.enum(['private', 'public']).optional().describe('Visibility for the new stored skill'),
});

/** Response for the install route. Mirrors stored-skill identity fields. */
export const builderRegistryInstallResponseSchema = z.object({
  storedSkillId: z.string().describe('Id of the newly created stored skill'),
  name: z.string().describe('Resolved skill name'),
  filesWritten: z.number().describe('Number of files materialized into the skill version snapshot'),
});

export type BuilderRegistryEntry = z.infer<typeof builderRegistryEntrySchema>;
export type BuilderRegistriesResponse = z.infer<typeof builderRegistriesResponseSchema>;
export type BuilderRegistryInstallBody = z.infer<typeof builderRegistryInstallBodySchema>;
export type BuilderRegistryInstallResponse = z.infer<typeof builderRegistryInstallResponseSchema>;
