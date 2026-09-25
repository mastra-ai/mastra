import { z } from 'zod';

import { opaqueId } from '../../schemas/common.js';

export const DashboardRoleSchema = z.enum(['viewer', 'soc_analyst', 'soc_manager']);

export type DashboardRole = z.infer<typeof DashboardRoleSchema>;
export const WORKOS_DASHBOARD_ROLE_SLUGS = Object.freeze(['viewer', 'soc-analyst', 'soc-manager'] as const);

const workosRoleMapping: Readonly<Record<string, DashboardRole>> = Object.freeze({
  viewer: 'viewer',
  'soc-analyst': 'soc_analyst',
  'soc-manager': 'soc_manager',
  // Accept explicit API-created underscore slugs while documenting the WorkOS
  // Dashboard's canonical hyphenated form.
  soc_analyst: 'soc_analyst',
  soc_manager: 'soc_manager',
});

export function dashboardRoleFromWorkosSlug(value: string): DashboardRole | null {
  return workosRoleMapping[value] ?? null;
}

export const DashboardPrincipalSchema = z
  .object({
    userRef: opaqueId,
    tenantId: opaqueId,
    organizationId: opaqueId,
    role: DashboardRoleSchema,
    sessionRef: opaqueId,
  })
  .strict()
  .refine(value => value.tenantId === value.organizationId, {
    message: 'The active organization must be the tenant.',
  });

export type DashboardPrincipal = z.infer<typeof DashboardPrincipalSchema>;

export type VerifiedDashboardSession = Readonly<{
  userId: string;
  sessionId: string;
  organizationId: string | undefined;
  roles: readonly string[];
}>;

export function resolveDashboardPrincipal(session: VerifiedDashboardSession): DashboardPrincipal | null {
  const roles = [...new Set(session.roles)];
  if (!session.organizationId || roles.length !== 1) return null;
  const role = dashboardRoleFromWorkosSlug(roles[0]!);
  if (!role) return null;
  return (
    DashboardPrincipalSchema.safeParse({
      userRef: session.userId,
      tenantId: session.organizationId,
      organizationId: session.organizationId,
      role,
      sessionRef: session.sessionId,
    }).data ?? null
  );
}
