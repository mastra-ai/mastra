import {
  AgentIcon,
  AuthStatus,
  McpServerIcon,
  ToolsIcon,
  WorkflowIcon,
  MainSidebar,
  useMainSidebar,
  LogoWithoutText,
  SettingsIcon,
  MastraVersionFooter,
  useMastraPlatform,
  useIsCmsAvailable,
  useAuthCapabilities,
  isAuthenticated,
  usePermissions,
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
  DatabaseIcon,
  TestTubeDiagonalIcon,
  BeakerIcon,
} from 'lucide-react';
import { useLocation } from 'react-router';

type SidebarLink = NavLink & {
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  requiresExperimentalFeatures?: boolean;
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
        requiredPermission: 'agents:read',
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
        requiredPermission: 'workflows:read',
      },
      {
        name: 'Processors',
        url: '/processors',
        icon: <Cpu />,
        isOnMastraPlatform: false,
        indent: true,
        requiredPermission: 'processors:read',
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        icon: <McpServerIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredPermission: 'mcps:read',
      },
      {
        name: 'Tools',
        url: '/tools',
        icon: <ToolsIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredPermission: 'tools:read',
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        icon: <FolderIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredPermission: 'workspaces:read',
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
        url: '/evaluation?tab=scorers',
        icon: <BeakerIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredPermission: 'scorers:read',
      },
      {
        name: 'Datasets',
        url: '/evaluation?tab=datasets',
        icon: <DatabaseIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredAnyPermission: ['datasets:read'],
      },
      {
        name: 'Experiments',
        url: '/evaluation?tab=experiments',
        icon: <TestTubeDiagonalIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredAnyPermission: ['datasets:read'],
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
        icon: <EyeIcon />,
        isOnMastraPlatform: true,
        indent: true,
        requiredPermission: 'observability:read',
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

/**
 * Maps evaluation tab values to their corresponding detail route prefixes.
 * e.g. tab=scorers should also be active when at /evaluation/scorers/:id
 */
const TAB_DETAIL_PREFIX: Record<string, string> = {
  scorers: '/evaluation/scorers',
  datasets: '/evaluation/datasets',
};

function getIsLinkActive(link: SidebarLink, pathname: string, search: string): boolean {
  if (link.url.includes('?')) {
    const [linkPath, linkQuery] = link.url.split('?');
    // Parse the tab param from both the link URL and the current location
    const linkTab = new URLSearchParams(linkQuery).get('tab');
    const currentTab = new URLSearchParams(search).get('tab');
    // Exact tab match on the same base path
    if (pathname === linkPath && linkTab && linkTab === currentTab) return true;
    // Detail page match: e.g. /evaluation/scorers/:id while Scorers tab link is active
    if (linkTab) {
      const routePrefix = TAB_DETAIL_PREFIX[linkTab];
      if (routePrefix && (pathname === routePrefix || pathname.startsWith(routePrefix + '/'))) return true;
    }
    return false;
  }
  // Exact match or sub-path match (with / boundary to avoid /observability matching /observability-overview)
  return pathname === link.url || pathname.startsWith(link.url + '/');
}

export function AppSidebar() {
  const { state } = useMainSidebar();

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

    // 3) RBAC link gating
    // Avoid hiding during transient permission loading to prevent nav flicker.
    if (rbacEnabled && isPermissionsAuthenticated && isPermissionsLoading) {
      return true;
    }

    if (link.requiredPermission && !hasPermission(link.requiredPermission)) {
      return false;
    }

    if (link.requiredAnyPermission && !hasAnyPermission(link.requiredAnyPermission)) {
      return false;
    }

    return true;
  };

  return (
    <MainSidebar>
      <div className="pt-3 mb-4 -ml-0.5 sticky top-0 bg-surface1 z-10">
        {state === 'collapsed' ? (
          <div className="flex flex-col gap-3 items-center">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0 ml-3" />
            {isUserAuthenticated && <AuthStatus />}
          </div>
        ) : isUserAuthenticated ? (
          // Authenticated: avatar on same row as logo
          <span className="flex items-center justify-between pl-3 pr-2">
            <span className="flex items-center gap-2">
              <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
              <span className="font-serif text-sm">Mastra Studio</span>
            </span>
            <AuthStatus />
          </span>
        ) : (
          // Not authenticated: no login button (shown in main content via AuthRequired)
          <span className="flex items-center gap-2 pl-3">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-serif text-sm">Mastra Studio</span>
          </span>
        )}
      </div>

      <MainSidebar.Nav>
        {mainNavigation.map(section => {
          const filteredLinks = section.links.filter(filterSidebarLink);
          const showSeparator = filteredLinks.length > 0 && section?.separator;

          const anySubLinkActive = filteredLinks.some(link => getIsLinkActive(link, pathname, location.search));
          const isHeaderActive = !!(section.href && pathname === section.href && !anySubLinkActive);

          return (
            <MainSidebar.NavSection key={section.key}>
              {section?.title ? (
                <MainSidebar.NavHeader state={state} href={section.href} isActive={isHeaderActive}>
                  {section.title}
                </MainSidebar.NavHeader>
              ) : (
                <>{showSeparator && <MainSidebar.NavSeparator />}</>
              )}
              <MainSidebar.NavList>
                {filteredLinks.map(link => {
                  const isActive = getIsLinkActive(link, pathname, location.search);
                  return <MainSidebar.NavLink key={link.name} state={state} link={link} isActive={isActive} />;
                })}
              </MainSidebar.NavList>
            </MainSidebar.NavSection>
          );
        })}
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
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
