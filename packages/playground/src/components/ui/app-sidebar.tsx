import { LogoWithoutText, MainSidebar, cn, useMainSidebar } from '@mastra/playground-ui';
import type { NavLink } from '@mastra/playground-ui';
import { useLocation } from 'react-router';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
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
  // Exact match or sub-path match (with / boundary to avoid /observability matching /observability-overview)
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  if (matches(item.url)) return true;
  return item.activePaths?.some(matches) ?? false;
}

export function AppSidebar() {
  const { Link } = useLinkComponent();
  const { state, isMobile } = useMainSidebar();

  const location = useLocation();
  const pathname = location.pathname;

  const { isMastraPlatform } = useMastraPlatform();
  const { data: authCapabilities } = useAuthCapabilities();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const {
    hasPermission,
    hasAnyPermission,
    rbacEnabled,
    isAuthenticated: isPermissionsAuthenticated,
    isLoading: isPermissionsLoading,
  } = usePermissions();

  const isUserAuthenticated = authCapabilities && isAuthenticated(authCapabilities);
  const cmsOnlyLinks = new Set(['/prompts']);

  const filterItem = (item: NavItem) => {
    if (cmsOnlyLinks.has(item.url) && !isCmsAvailable && !isCmsLoading) return false;
    if (isMastraPlatform && !item.isOnMastraPlatform) return false;
    if (rbacEnabled && isPermissionsAuthenticated && isPermissionsLoading) return true;
    if (item.requiredPermission && !hasPermission(item.requiredPermission)) return false;
    if (item.requiredAnyPermission && !hasAnyPermission(item.requiredAnyPermission)) return false;
    return true;
  };

  const filteredBottom = bottomNav.filter(filterItem);

  return (
    <MainSidebar>
      <div className="pt-3 mb-4">
        {state === 'collapsed' ? (
          <div className="flex flex-col gap-3 items-center">
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
              <span className="font-serif text-sm whitespace-nowrap truncate">Mastra Studio</span>
              {!isMobile && <MainSidebar.Trigger />}
            </span>
            <AuthStatus />
          </span>
        ) : (
          <span className="flex items-center gap-2 pl-3 pr-2">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-serif text-sm whitespace-nowrap truncate">Mastra Studio</span>
            {!isMobile && <MainSidebar.Trigger />}
          </span>
        )}
      </div>

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
            <div role="separator" aria-orientation="horizontal" className="mx-6 my-2 h-px bg-border1" />
            <MastraVersionFooter collapsed={false} />
          </>
        )}
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
