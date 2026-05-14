import {
  AgentIcon,
  LogoWithoutText,
  MainSidebar,
  McpServerIcon,
  SettingsIcon,
  ToolsIcon,
  WorkflowIcon,
  cn,
  useMainSidebar,
} from '@mastra/playground-ui';
import type { NavLink, NavSection } from '@mastra/playground-ui';
import {
  EyeIcon,
  GlobeIcon,
  BookIcon,
  FileTextIcon,
  FolderIcon,
  Cpu,
  BarChart3Icon,
  LogsIcon,
  DatabaseIcon,
  FlaskConical,
  GaugeIcon,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { AuthStatus } from '@/domains/auth/components/auth-status';
import { ImpersonationBanner } from '@/domains/auth/components/impersonation-banner';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { getPermissionForRoute, hasRoutePermission } from '@/domains/auth/route-permissions';
import { isAuthenticated } from '@/domains/auth/types';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { MastraVersionFooter } from '@/domains/configuration/components/mastra-version-footer';
import { useLinkComponent } from '@/lib/framework';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

type SidebarLink = NavLink & {
  requiresExperimentalFeatures?: boolean;
  activePaths?: string[];
};

type SidebarSection = Omit<NavSection, 'links'> & {
  links: SidebarLink[];
};

const mainNavigation: SidebarSection[] = [
  {
    key: 'primitives',
    title: 'Primitives',
    href: '/primitives',
    links: [
      {
        name: 'Agents',
        url: '/agents',
        icon: <AgentIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Prompts',
        url: '/prompts',
        icon: <FileTextIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Workflows',
        url: '/workflows',
        icon: <WorkflowIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Processors',
        url: '/processors',
        icon: <Cpu />,
        isOnMastraPlatform: false,
        indent: true,
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        icon: <McpServerIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Tools',
        url: '/tools',
        icon: <ToolsIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        icon: <FolderIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Request Context',
        url: '/request-context',
        icon: <GlobeIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
    ],
  },
  {
    key: 'evaluation',
    title: 'Evaluation',
    href: '/evaluation',
    links: [
      {
        name: 'Scorers',
        url: '/scorers',
        icon: <GaugeIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Datasets',
        url: '/datasets',
        icon: <DatabaseIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Experiments',
        url: '/experiments',
        icon: <FlaskConical />,
        isOnMastraPlatform: true,
        indent: true,
      },
    ],
  },
  {
    key: 'observability',
    title: 'Observability',
    href: '/observability-overview',
    links: [
      {
        name: 'Metrics',
        url: '/metrics',
        icon: <BarChart3Icon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Traces',
        url: '/observability',
        activePaths: ['/traces'],
        icon: <EyeIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
      {
        name: 'Logs',
        url: '/logs',
        icon: <LogsIcon />,
        isOnMastraPlatform: true,
        indent: true,
      },
    ],
  },
  {
    key: 'bottom',
    separator: true,
    links: [
      {
        name: 'Settings',
        url: '/settings',
        icon: <SettingsIcon />,
        isOnMastraPlatform: false,
      },
      {
        name: 'Resources',
        url: '/resources',
        icon: <BookIcon />,
        isOnMastraPlatform: true,
      },
    ],
  },
];

declare global {
  interface Window {
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_TEMPLATES?: string;
  }
}

function getIsLinkActive(link: SidebarLink, pathname: string): boolean {
  // Exact match or sub-path match (with / boundary to avoid /observability matching /observability-overview)
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  if (matches(link.url)) return true;
  return link.activePaths?.some(matches) ?? false;
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

  // Check if user is authenticated (small avatar) vs not (wide login button)
  const isUserAuthenticated = authCapabilities && isAuthenticated(authCapabilities);
  const cmsOnlyLinks = new Set(['/prompts']);

  const filterSidebarLink = (link: SidebarLink) => {
    // 1) CMS link gating
    if (cmsOnlyLinks.has(link.url) && !isCmsAvailable && !isCmsLoading) {
      return false;
    }

    // 2) Mastra platform link gating
    if (isMastraPlatform && !link.isOnMastraPlatform) {
      return false;
    }

    // 3) RBAC link gating - look up permission from registry
    // Avoid hiding during transient permission loading to prevent nav flicker.
    if (rbacEnabled && isPermissionsAuthenticated && isPermissionsLoading) {
      return true;
    }

    const requiredPermission = getPermissionForRoute(link.url);
    if (!hasRoutePermission(requiredPermission, hasPermission, hasAnyPermission)) {
      return false;
    }

    return true;
  };

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

      <ImpersonationBanner />

      <MainSidebar.Nav>
        {mainNavigation.map(section => {
          const filteredLinks = section.links.filter(filterSidebarLink);

          // Don't render section if no links are visible
          if (filteredLinks.length === 0) {
            return null;
          }

          const showSeparator = section?.separator;

          const anySubLinkActive = filteredLinks.some(link => getIsLinkActive(link, pathname));
          const isHeaderActive = !!(section.href && pathname === section.href && !anySubLinkActive);

          return (
            <MainSidebar.NavSection key={section.key}>
              {section?.title ? (
                <MainSidebar.NavHeader LinkComponent={Link} state={state} href={section.href} isActive={isHeaderActive}>
                  {section.title}
                </MainSidebar.NavHeader>
              ) : (
                <>{showSeparator && <MainSidebar.NavSeparator />}</>
              )}
              <MainSidebar.NavList>
                {filteredLinks.map(link => {
                  const isActive = getIsLinkActive(link, pathname);
                  return (
                    <MainSidebar.NavLink
                      key={link.name}
                      LinkComponent={Link}
                      state={state}
                      link={link}
                      isActive={isActive}
                    />
                  );
                })}
              </MainSidebar.NavList>
            </MainSidebar.NavSection>
          );
        })}
      </MainSidebar.Nav>

      <MainSidebar.Bottom className="pb-3">
        {state !== 'collapsed' && (
          <>
            <MainSidebar.NavSeparator />
            <MastraVersionFooter collapsed={false} />
          </>
        )}
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
