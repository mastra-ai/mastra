import { coreFeatures } from '@mastra/core/features';
import { Wrench } from 'lucide-react';
import { useAgentBuilderSidebarVisibility } from '@/domains/agent-builder/hooks/use-agent-builder-sidebar-visibility';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getPermissionForRoute, hasRoutePermission } from '@/domains/auth/route-permissions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { bottomNav, mainNav } from '@/lib/nav/nav-items';
import type { NavItem } from '@/lib/nav/nav-items';

const CMS_ONLY_LINKS = new Set(['/prompts', '/integrations']);

/** Share permission and deployment gating across the rail and contextual navigation. */
export function useStudioNavigation() {
  const { isVisible: isAgentBuilderVisible } = useAgentBuilderSidebarVisibility();
  const { isMastraPlatform } = useMastraPlatform();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { hasPermission, hasAnyPermission, isLoading: isPermissionsLoading } = usePermissions();
  const filterItem = (item: NavItem) => {
    if (item.hidden) return false;
    if (!coreFeatures.has('datasets') && (item.url === '/datasets' || item.url.startsWith('/experiments')))
      return false;
    if (CMS_ONLY_LINKS.has(item.url) && !isCmsAvailable) return false;
    if (isMastraPlatform && !item.isOnMastraPlatform) return false;
    if (isPermissionsLoading) {
      const pending = getPermissionForRoute(item.url);
      if (pending !== 'public') return false;
    }
    const requiredPermission = getPermissionForRoute(item.url);
    if (!hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) {
      return false;
    }
    return true;
  };

  return {
    sections: [
      ...mainNav.map(section => ({ ...section, items: section.items.filter(filterItem) })),
      {
        key: 'builder',
        title: 'Agent Builder',
        items: isAgentBuilderVisible ? [{ name: 'Agent Builder', url: '/agent-builder', Icon: Wrench }] : [],
      },
    ],
    bottomItems: bottomNav.filter(filterItem),
  };
}
