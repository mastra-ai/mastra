import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

/**
 * Permissions the server-side `hasAdminBypass(requestContext, 'tool-providers')`
 * check recognizes (see `packages/server/src/server/handlers/authorship.ts`):
 * the global wildcard, the resource wildcard, and the explicit admin grant.
 */
const ADMIN_PERMISSIONS = ['*', 'tool-providers:*', 'tool-providers:admin'];

/**
 * Returns `true` when the current authenticated user has admin bypass on
 * tool providers — mirrors the server-side
 * `hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE)` check.
 *
 * Used by the Builder integration picker and `/integrations` page to surface
 * cross-author `authorId` info that only admins are meant to act on.
 */
export function useIsToolProviderAdmin(): boolean {
  const { data: user } = useCurrentUser();
  return user?.permissions?.some(permission => ADMIN_PERMISSIONS.includes(permission)) ?? false;
}
