import { useMemo } from 'react';

import { getPermissionForRoute, hasRoutePermission } from '../route-permissions';

import { usePermissions } from './use-permissions';

import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

type SidebarSection = {
  links: Array<{
    url: string;
    isOnMastraPlatform?: boolean;
  }>;
};

// Must match the structure in app-sidebar.tsx
// Only includes URLs needed for permission checking
const SIDEBAR_NAVIGATION: SidebarSection[] = [
  {
    links: [{ url: '/agents' }, { url: '/workflows' }],
  },
  {
    links: [{ url: '/prompts' }, { url: '/processors' }, { url: '/mcps' }, { url: '/tools' }, { url: '/workspaces' }],
  },
  {
    links: [{ url: '/request-context' }],
  },
  {
    links: [
      { url: '/scorers' },
      { url: '/datasets', isOnMastraPlatform: true },
      { url: '/experiments', isOnMastraPlatform: true },
    ],
  },
  {
    links: [{ url: '/metrics' }, { url: '/observability' }, { url: '/logs' }],
  },
  {
    links: [{ url: '/settings' }],
  },
  {
    links: [{ url: '/resources' }],
  },
];

const CMS_ONLY_LINKS = new Set(['/prompts']);

/**
 * Hook to check if user has any visible sidebar links based on permissions.
 * Used by layout to decide whether to render the sidebar expanded or collapsed.
 */
export function useHasAnySidebarPermissions(): { hasAnyLinks: boolean; isLoading: boolean } {
  const { isMastraPlatform } = useMastraPlatform();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const {
    hasPermission,
    hasAnyPermission,
    rbacEnabled,
    isAuthenticated: isPermissionsAuthenticated,
    isLoading: isPermissionsLoading,
  } = usePermissions();

  const hasAnyLinks = useMemo(() => {
    // If permissions are still loading, assume user has access to avoid flash
    if (rbacEnabled && isPermissionsAuthenticated && isPermissionsLoading) {
      return true;
    }

    for (const section of SIDEBAR_NAVIGATION) {
      for (const link of section.links) {
        // CMS gating
        if (CMS_ONLY_LINKS.has(link.url) && !isCmsAvailable && !isCmsLoading) {
          continue;
        }

        // Mastra platform gating
        if (isMastraPlatform && !link.isOnMastraPlatform) {
          continue;
        }

        // RBAC gating - look up permission from registry
        const requiredPermission = getPermissionForRoute(link.url);
        if (!hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) {
          continue;
        }

        // Found at least one visible link
        return true;
      }
    }

    return false;
  }, [
    isMastraPlatform,
    isCmsAvailable,
    isCmsLoading,
    hasPermission,
    hasAnyPermission,
    rbacEnabled,
    isPermissionsAuthenticated,
    isPermissionsLoading,
  ]);

  return { hasAnyLinks, isLoading: isPermissionsLoading };
}
