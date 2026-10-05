import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { SidebarNew, useSidebarNew } from '@mastra/playground-ui/new/sidebar';
import type { SidebarNewLink } from '@mastra/playground-ui/new/sidebar';
import { useAuthCapabilities, isAuthenticated, useMCPServers, useWorkspaces } from '@mastra/react/hooks';
import { Search, Wrench } from 'lucide-react';
import { useLocation } from 'react-router';
import { useAgentBuilderSidebarVisibility } from '@/domains/agent-builder/hooks/use-agent-builder-sidebar-visibility';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getPermissionForRoute, hasRoutePermission } from '@/domains/auth/route-permissions';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
import { useNavigationCommand } from '@/lib/command';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';
import { bottomNav, mainNav } from '@/lib/nav/nav-items';
import type { NavItem } from '@/lib/nav/nav-items';

declare global {
  interface Window {
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_TEMPLATES?: string;
  }
}

function toSidebarLink(item: NavItem): SidebarNewLink {
  const { Icon } = item;
  return { name: item.name, url: item.url, icon: <Icon /> };
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebarNew();
  const { setOpen: setNavigationCommandOpen } = useNavigationCommand({ enableShortcut: false });
  const commandShortcutLabel = useKeyboardShortcutLabel('K');

  const location = useLocation();
  const pathname = location.pathname;

  const { isMastraPlatform } = useMastraPlatform();
  const { data: authCapabilities } = useAuthCapabilities();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const { hasPermission, hasAnyPermission, isLoading: isPermissionsLoading } = usePermissions();

  const isUserAuthenticated = authCapabilities && isAuthenticated(authCapabilities);
  const cmsOnlyLinks = new Set(['/prompts']);
  const { isVisible: isAgentBuilderVisible } = useAgentBuilderSidebarVisibility();
  const isAgentBuilderActive = pathname === '/agent-builder' || pathname.startsWith('/agent-builder/');

  const openNavigationCommand = () => {
    if (isMobile) setOpenMobile(false);
    setNavigationCommandOpen(true);
  };

  const filterItem = (item: NavItem) => {
    if (item.hidden) return false;
    if (cmsOnlyLinks.has(item.url) && !isCmsAvailable && !isCmsLoading) return false;
    if (isMastraPlatform && !item.isOnMastraPlatform) return false;
    if (isPermissionsLoading) {
      const pending = getPermissionForRoute(item.url);
      if (pending && pending !== 'public') return false;
    }
    const requiredPermission = getPermissionForRoute(item.url);
    if (!hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) {
      return false;
    }
    return true;
  };

  const { data: mcpServers } = useMCPServers();
  const { data: workspaces } = useWorkspaces();
  const filteredBottom = bottomNav.filter(filterItem);
  const sections = mainNav.map(section => {
    const items = section.items.filter(filterItem);
    const linkForItem = (item: NavItem) => ({
      ...toSidebarLink(item),
      isActive: getIsLinkActive(item, pathname, items),
    });
    return {
      key: section.key,
      title: section.title,
      href: section.href,
      isHeaderActive: !!(
        section.href &&
        pathname === section.href &&
        !items.some(item => getIsLinkActive(item, pathname, items))
      ),
      links: items.filter(item => !item.foldable).map(linkForItem),
      moreLinks: items
        .filter(item => item.foldable)
        .map(item => ({
          ...linkForItem(item),
          defaultVisible:
            (item.url === '/mcps' && !!mcpServers?.length) ||
            (item.url === '/workspaces' && !!workspaces?.workspaces.length),
        })),
    };
  });

  return (
    <SidebarNew aria-label="Sidebar">
      <SidebarNew.CommandHeader>
        <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Studio" />
        {isUserAuthenticated && <AuthStatus />}
        {!isMobile && (
          <SidebarNew.SearchTrigger
            aria-label="Search and navigate"
            shortcut={commandShortcutLabel}
            onClick={openNavigationCommand}
          >
            <Search />
          </SidebarNew.SearchTrigger>
        )}
      </SidebarNew.CommandHeader>

      {isAgentBuilderVisible && (
        <SidebarNew.NavList className="mb-1">
          <SidebarNew.NavLink
            state={state}
            link={{
              name: 'Agent Builder',
              url: '/agent-builder',
              icon: <Wrench />,
            }}
            isActive={isAgentBuilderActive}
          />
        </SidebarNew.NavList>
      )}

      <ImpersonationBanner />

      <SidebarNew.Nav>
        <SidebarNew.Sections sections={sections} visibilityStorageKey="mastra:studio:sidebar-visibility" />
      </SidebarNew.Nav>

      <SidebarNew.Footer>
        {filteredBottom.length > 0 && (
          <SidebarNew.NavList>
            {filteredBottom.map(item => (
              <SidebarNew.NavLink
                key={item.name}
                state={state}
                link={toSidebarLink(item)}
                isActive={getIsLinkActive(item, pathname)}
              />
            ))}
          </SidebarNew.NavList>
        )}
        <MastraVersionFooter collapsed={state === 'collapsed'} />
        <SidebarNew.FooterMeta action={<SidebarNew.Trigger />} />
      </SidebarNew.Footer>
    </SidebarNew>
  );
}
