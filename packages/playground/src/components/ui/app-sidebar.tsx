import { Badge } from '@mastra/playground-ui/components/Badge';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainSidebar, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import type { NavLink } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useKeyboardShortcutLabel } from '@mastra/playground-ui/hooks/use-keyboard-shortcut-label';
import { cn } from '@mastra/playground-ui/utils/cn';
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
import { useLinkComponent } from '@/lib/framework';
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

function toSidebarLink(item: NavItem): NavLink {
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
  const { Link } = useLinkComponent();
  const { state } = useMainSidebar();
  const { pathname } = useLocation();

  return (
    <MainSidebar.NavLink
      LinkComponent={Link}
      state={state}
      link={toSidebarLink(item)}
      isActive={getIsLinkActive(item, pathname, siblings)}
      onClick={onClick}
    >
      {children}
    </MainSidebar.NavLink>
  );
}

function MoreRow({ onClick }: { onClick: () => void }) {
  const { state } = useMainSidebar();

  return (
    <MainSidebar.NavLink
      state={state}
      link={{ name: 'More', url: '#', icon: <Ellipsis /> }}
      render={
        <button type="button" onClick={onClick}>
          <Ellipsis />
          <MainSidebar.NavLabel state={state}>More</MainSidebar.NavLabel>
        </button>
      }
    />
  );
}

/** Mirrors the nav row box (h-7, px-3, size-4 icon + label with gap-2) so the list doesn't jump on resolve. */
function NavSkeletonRow() {
  const { state } = useMainSidebar();
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
    <MainSidebar>
      <div className="mb-1.5 pt-2.5">
        {state === 'collapsed' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative grid size-9 place-items-center">
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
          <span className="flex h-7 items-center justify-between pr-2 pl-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
              <span className="font-display text-ui-md truncate font-semibold tracking-tight whitespace-nowrap">
                Mastra Studio
              </span>
              {!isMobile && <MainSidebar.Trigger />}
            </span>
            <AuthStatus />
          </span>
        ) : (
          <span className="flex h-7 items-center gap-2 pr-2 pl-3">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-display text-ui-md truncate font-semibold tracking-tight whitespace-nowrap">
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
                className="border-border1 bg-surface3 text-foreground hover:bg-surface4 hover:text-foreground active:bg-surface5 [&_svg]:text-muted-foreground [&:hover_svg]:text-foreground border"
              >
                <Search />
                <MainSidebar.NavLabel state={state}>Search</MainSidebar.NavLabel>
                {state !== 'collapsed' && (
                  <kbd
                    aria-hidden="true"
                    className="border-border1 bg-surface4 text-muted-foreground text-ui-xs ml-auto rounded border px-1.5 py-0.5 font-mono leading-none"
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
            <hr className="bg-border1 mx-3 my-2 h-px border-0" />
            <MastraVersionFooter collapsed={false} />
          </>
        )}
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
