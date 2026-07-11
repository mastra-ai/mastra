import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { NavLink } from '@mastra/playground-ui/components/MainSidebar';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Search, Wrench } from 'lucide-react';
import { useLocation } from 'react-router';
import { useAgentBuilderSidebarVisibility } from '@/domains/agent-builder/hooks/use-agent-builder-sidebar-visibility';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getPermissionForRoute, hasRoutePermission } from '@/domains/auth/route-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
import { useNavigationCommand } from '@/lib/command';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { bottomNav, mainNav } from '@/lib/nav/nav-items';
import type { NavItem } from '@/lib/nav/nav-items';

declare global {
  interface Window {
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_TEMPLATES?: string;
  }
}

function toSidebarLink(item: NavItem): NavLink {
  const { Icon } = item;
  return { name: item.name, url: item.url, icon: <Icon /> };
}

function getIsLinkActive(item: NavItem, pathname: string): boolean {
  // Exact match or sub-path match (with / boundary so sibling routes don't match by prefix)
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  if (matches(item.url)) return true;
  return item.activePaths?.some(matches) ?? false;
}

export function AppSidebar() {
  const { Link } = useLinkComponent();
  const { state, isMobile, setOpenMobile } = useMainSidebar();
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
    // While the user's permissions are still loading, hide permission-gated
    // links. Being permissive here would briefly flash links the user may not
    // be allowed to see. We can't yet know rbacEnabled/isAuthenticated during
    // this window (auth capabilities are still resolving), so we gate purely on
    // the loading state and only reveal a link once permissions have resolved.
    // The authoritative permission patterns are already loaded and validated by
    // RoutePermissionsGate before the sidebar renders.
    if (isPermissionsLoading) {
      const pending = getPermissionForRoute(item.url);
      // Public/unknown routes have no permission requirement — keep showing them.
      if (pending && pending !== 'public') return false;
    }
    const requiredPermission = getPermissionForRoute(item.url);
    if (!hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) {
      return false;
    }
    return true;
  };

  const filteredBottom = bottomNav.filter(filterItem);

  return (
    <MainSidebar>
      <div className="pt-2 mb-2">
        {state === 'collapsed' ? (
          <div className="flex flex-col gap-2 items-center">
            <div className="relative grid place-items-center size-9">
              <LogoWithoutText
                className={cn(
                  'h-[1.5rem] w-[1.5rem] shrink-0 transition-opacity duration-150',
                  !isMobile && 'group-hover/sidebar:opacity-0',
                )}
              />
              {!isMobile && (
                <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
                  <MainSidebar.Trigger />
                </div>
              )}
            </div>
            {isUserAuthenticated && <AuthStatus />}
          </div>
        ) : isUserAuthenticated ? (
          <span className="flex items-center justify-between pl-3 pr-2">
            <span className="flex items-center gap-2 flex-1 min-w-0">
              <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
              <span className="font-display text-sm font-semibold tracking-tight whitespace-nowrap truncate">
                Mastra Studio
              </span>
              {!isMobile && <MainSidebar.Trigger />}
            </span>
            <AuthStatus />
          </span>
        ) : (
          <span className="flex items-center gap-2 pl-3 pr-2">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-display text-sm font-semibold tracking-tight whitespace-nowrap truncate">
              Mastra Studio
            </span>
            {!isMobile && <MainSidebar.Trigger />}
          </span>
        )}
      </div>

      {!isMobile && (
        <div className="mb-2">
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              asChild
              state={state}
              link={{
                name: 'Search',
                url: '#',
                icon: <Search />,
              }}
            >
              <button
                type="button"
                onClick={openNavigationCommand}
                aria-label="Search and navigate"
                className="border border-border1 bg-surface3 text-neutral5 hover:bg-surface4 hover:text-neutral6 active:bg-surface5 [&_svg]:text-neutral4 [&:hover_svg]:text-neutral5"
              >
                <Search />
                <MainSidebar.NavLabel state={state}>Search</MainSidebar.NavLabel>
                {state !== 'collapsed' && (
                  <kbd
                    aria-hidden="true"
                    className="ml-auto rounded border border-border1 bg-surface4 px-1.5 py-0.5 font-mono text-[10px] leading-none text-neutral3"
                  >
                    {commandShortcutLabel}
                  </kbd>
                )}
              </button>
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </div>
      )}

      {isAgentBuilderVisible && (
        <div className="mb-1">
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={Link}
              state={state}
              link={{
                name: 'Agent Builder',
                url: '/agent-builder',
                icon: <Wrench />,
              }}
              isActive={isAgentBuilderActive}
            />
          </MainSidebar.NavList>
        </div>
      )}

      <ImpersonationBanner />

      <MainSidebar.Nav>
        {mainNav.map(section => {
          const filtered = section.items.filter(filterItem);
          const anySubActive = filtered.some(item => getIsLinkActive(item, pathname));
          const isHeaderActive = !!(section.href && pathname === section.href && !anySubActive);

          return (
            <MainSidebar.NavSection key={section.key}>
              {section.title ? (
                <MainSidebar.NavHeader LinkComponent={Link} state={state} href={section.href} isActive={isHeaderActive}>
                  {section.title}
                </MainSidebar.NavHeader>
              ) : null}
              <MainSidebar.NavList>
                {filtered.map(item => (
                  <MainSidebar.NavLink
                    key={item.name}
                    LinkComponent={Link}
                    state={state}
                    link={toSidebarLink(item)}
                    isActive={getIsLinkActive(item, pathname)}
                  />
                ))}
              </MainSidebar.NavList>
            </MainSidebar.NavSection>
          );
        })}
      </MainSidebar.Nav>

      <MainSidebar.Bottom className="pb-3">
        {filteredBottom.length > 0 && (
          <MainSidebar.NavList>
            {filteredBottom.map(item => (
              <MainSidebar.NavLink
                key={item.name}
                LinkComponent={Link}
                state={state}
                link={toSidebarLink(item)}
                isActive={getIsLinkActive(item, pathname)}
              />
            ))}
          </MainSidebar.NavList>
        )}
        {state !== 'collapsed' && (
          <>
            <hr className="mx-6 my-2 h-px border-0 bg-border1" />
            <MastraVersionFooter collapsed={false} />
          </>
        )}
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
