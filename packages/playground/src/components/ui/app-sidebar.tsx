import { Badge } from '@mastra/playground-ui/components/Badge';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { SidebarNew, useSidebarNew } from '@mastra/playground-ui/new/sidebar';
import type { SidebarNewLink } from '@mastra/playground-ui/new/sidebar';
import { Ellipsis, Search, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { useFeedbackInboxCount } from '@/domains/feedback/hooks/use-feedback';
import { useInboxDatasetReviewCount } from '@/domains/review/hooks/use-inbox-review-items';
import { useNavigationCommand } from '@/lib/command';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';
import { getIsLinkActive } from '@/lib/nav/get-is-link-active';
import { bottomNav, mainNav } from '@/lib/nav/nav-items';
import type { NavItem } from '@/lib/nav/nav-items';
import { useFoldableNavItems } from '@/lib/nav/use-foldable-nav-items';

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

interface SidebarNavItemProps {
  item: NavItem;
  /** Items in the same list, used for section-aware active matching. */
  siblings: NavItem[];
  onClick?: () => void;
  children?: ReactNode;
}

function SidebarNavItem({ item, siblings, onClick, children }: SidebarNavItemProps) {
  const { state } = useSidebarNew();
  const { pathname } = useLocation();

  return (
    <SidebarNew.NavLink
      state={state}
      link={toSidebarLink(item)}
      isActive={getIsLinkActive(item, pathname, siblings)}
      onClick={onClick}
    >
      {children}
    </SidebarNew.NavLink>
  );
}

function MoreRow({ onClick }: { onClick: () => void }) {
  const { state } = useSidebarNew();

  return (
    <SidebarNew.NavLink
      state={state}
      link={{ name: 'More', url: '#', icon: <Ellipsis /> }}
      render={
        <button type="button" onClick={onClick}>
          <Ellipsis />
          <SidebarNew.NavLabel state={state}>More</SidebarNew.NavLabel>
        </button>
      }
    />
  );
}

/** Mirrors the nav row box (h-7, px-3, size-4 icon + label with gap-2) so the list doesn't jump on resolve. */
function NavSkeletonRow() {
  const { state } = useSidebarNew();
  const isCollapsed = state === 'collapsed';

  return (
    <li
      aria-busy="true"
      data-testid="nav-more-skeleton"
      className={isCollapsed ? 'flex h-7 items-center justify-center' : 'flex h-7 items-center gap-2 px-3'}
    >
      <Skeleton className="size-4 shrink-0 rounded-sm" />
      {!isCollapsed && <Skeleton className="h-3 w-20" />}
    </li>
  );
}

interface FoldableNavTailProps {
  /** The foldable items of the section, already filtered for visibility. */
  items: NavItem[];
  siblings: NavItem[];
}

/**
 * Tail of a nav section: promoted foldable rows first, then "More" — a flat placeholder that
 * swaps itself for the remaining folded rows when clicked. While server data is resolving,
 * the whole tail is a single skeleton row.
 */
function FoldableNavTail({ items, siblings }: FoldableNavTailProps) {
  const { pathname } = useLocation();
  const { isResolving, promoted, folded, markVisited } = useFoldableNavItems(items, pathname);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (isResolving) return <NavSkeletonRow />;

  return (
    <>
      {promoted.map(item => (
        <SidebarNavItem key={item.name} item={item} siblings={siblings} onClick={() => markVisited(item.url)} />
      ))}
      {folded.length > 0 && !isMoreOpen && <MoreRow onClick={() => setIsMoreOpen(true)} />}
      {isMoreOpen &&
        folded.map(item => (
          <SidebarNavItem key={item.name} item={item} siblings={siblings} onClick={() => markVisited(item.url)} />
        ))}
    </>
  );
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
  const canReadInbox =
    !isPermissionsLoading && hasRoutePermission(getPermissionForRoute('/inbox'), hasPermission, hasAnyPermission);
  const feedbackInboxCountQuery = useFeedbackInboxCount({ enabled: canReadInbox });
  const datasetReviewCountQuery = useInboxDatasetReviewCount({ enabled: canReadInbox });
  const hasInboxItems =
    (feedbackInboxCountQuery.data?.pagination?.total ?? 0) > 0 || (datasetReviewCountQuery.data ?? 0) > 0;

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
        {mainNav.map(section => {
          const filtered = section.items.filter(filterItem);
          const anySubActive = filtered.some(item => getIsLinkActive(item, pathname));
          const isHeaderActive = !!(section.href && pathname === section.href && !anySubActive);

          return (
            <SidebarNew.NavSection key={section.key}>
              {section.title ? (
                <SidebarNew.NavHeader href={section.href} isActive={isHeaderActive}>
                  {section.title}
                </SidebarNew.NavHeader>
              ) : null}
              <SidebarNew.NavList>
                {filtered
                  .filter(item => !item.foldable)
                  .map(item => (
                    <SidebarNavItem key={item.name} item={item} siblings={filtered}>
                      {item.url === '/inbox' && hasInboxItems && state !== 'collapsed' ? (
                        <Badge
                          variant="yellow"
                          size="sm"
                          indicator="dot"
                          className="ml-auto"
                          aria-label="Items need review"
                        />
                      ) : null}
                    </SidebarNavItem>
                  ))}
                {filtered.some(item => item.foldable) && (
                  <FoldableNavTail items={filtered.filter(item => item.foldable)} siblings={filtered} />
                )}
              </SidebarNew.NavList>
            </SidebarNew.NavSection>
          );
        })}
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
