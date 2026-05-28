import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';

/**
 * Returns `true` when the current authenticated user has the
 * `tool-providers:admin` permission — mirrors the server-side
 * `hasAdminBypass(requestContext, TOOL_PROVIDERS_RESOURCE)` check.
 *
 * Used by the Builder integration picker and `/integrations` page to surface
 * cross-author `authorId` info that only admins are meant to act on.
 */
export function useIsToolProviderAdmin(): boolean {
  const { data: user } = useCurrentUser();
  return user?.permissions?.includes('tool-providers:admin') ?? false;
}
