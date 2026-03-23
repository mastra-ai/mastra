import {
  AgentIcon,
  AuthStatus,
  GithubIcon,
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
  GaugeIcon,
  EyeIcon,
  PackageIcon,
  GlobeIcon,
  BookIcon,
  FileTextIcon,
  EarthIcon,
  CloudUploadIcon,
  MessagesSquareIcon,
  FolderIcon,
  Cpu,
  DatabaseIcon,
  BarChart3Icon,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { ExperimentalUIManager } from '@/domains/experimental-ui/experimental-ui-manager';

type SidebarLink = NavLink & {
  requiredPermission?: string;
  requiredAnyPermission?: string[];
};

type SidebarSection = Omit<NavSection, 'links'> & {
  links: SidebarLink[];
};

const mainNavigation: SidebarSection[] = [
  {
    key: 'main',

    links: [
      {
        name: 'Agents',
        url: '/agents',
        icon: <AgentIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'agents:read',
      },
      {
        name: 'Prompts',
        url: '/prompts',
        icon: <FileTextIcon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Workflows',
        url: '/workflows',
        icon: <WorkflowIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'workflows:read',
      },
      {
        name: 'Processors',
        url: '/processors',
        icon: <Cpu />,
        isOnMastraPlatform: false,
        requiredPermission: 'processors:read',
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        icon: <McpServerIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'mcps:read',
      },
      {
        name: 'Tools',
        url: '/tools',
        icon: <ToolsIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'tools:read',
      },
      {
        name: 'Scorers',
        url: '/scorers',
        icon: <GaugeIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'scorers:read',
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        icon: <FolderIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'workspaces:read',
      },
      {
        name: 'Request Context',
        url: '/request-context',
        icon: <GlobeIcon />,
        isOnMastraPlatform: true,
      },
    ],
  },
  {
    key: 'observability',
    separator: true,
    links: [
      {
        name: 'Metrics',
        url: '/metrics',
        icon: <BarChart3Icon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Observability',
        url: '/observability',
        icon: <EyeIcon />,
        isOnMastraPlatform: true,
        requiredPermission: 'observability:read',
      },
      {
        name: 'Datasets',
        url: '/datasets',
        icon: <DatabaseIcon />,
        isOnMastraPlatform: false,
        requiredPermission: 'datasets:read',
      },
    ],
  },
  {
    key: 'Templates',
    separator: true,
    links: [
      {
        name: 'Templates',
        url: '/templates',
        icon: <PackageIcon />,
        isOnMastraPlatform: false,
      },
    ],
  },

  {
    key: 'Settings',
    separator: true,
    links: [
      {
        name: 'Settings',
        url: '/settings',
        icon: <SettingsIcon />,
        isOnMastraPlatform: false,
      },
    ],
  },
];

const secondNavigation: SidebarSection = {
  key: 'others',
  title: 'Other links',
  links: [
    {
      name: 'Mastra APIs',
      url: '/swagger-ui',
      icon: <EarthIcon />,
      isOnMastraPlatform: false,
    },
    {
      name: 'Documentation',
      url: 'https://mastra.ai/en/docs',
      icon: <BookIcon />,
      isOnMastraPlatform: true,
    },
    {
      name: 'Github',
      url: 'https://github.com/mastra-ai/mastra',
      icon: <GithubIcon />,
      isOnMastraPlatform: true,
    },
    {
      name: 'Community',
      url: 'https://discord.gg/BTYqqHKUrf',
      icon: <MessagesSquareIcon />,
      isOnMastraPlatform: true,
    },
  ],
};

declare global {
  interface Window {
    MASTRA_HIDE_CLOUD_CTA: string;
    MASTRA_TEMPLATES?: string;
  }
}

export function AppSidebar() {
  const { state } = useMainSidebar();

  const location = useLocation();
  const pathname = location.pathname;

  const hideCloudCta = window?.MASTRA_HIDE_CLOUD_CTA === 'true';
  const showTemplates = window?.MASTRA_TEMPLATES === 'true';
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
    <MainSidebar footerSlot={<ExperimentalUIManager pathname={pathname} />}>
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
        {mainNavigation
          .filter(section => (section.key === 'Templates' ? showTemplates : true))
          .map(section => {
            const filteredLinks = section.links.filter(filterSidebarLink);
            const showSeparator = filteredLinks.length > 0 && section?.separator;

            return (
              <MainSidebar.NavSection key={section.key}>
                {section?.title ? (
                  <MainSidebar.NavHeader state={state}>{section.title}</MainSidebar.NavHeader>
                ) : (
                  <>{showSeparator && <MainSidebar.NavSeparator />}</>
                )}
                <MainSidebar.NavList>
                  {filteredLinks.map(link => {
                    const isActive = pathname.startsWith(link.url);
                    return <MainSidebar.NavLink key={link.name} state={state} link={link} isActive={isActive} />;
                  })}
                </MainSidebar.NavList>
              </MainSidebar.NavSection>
            );
          })}
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavSeparator />
            <MainSidebar.NavList>
              {secondNavigation.links.filter(filterSidebarLink).map(link => {
                return <MainSidebar.NavLink key={link.name} link={link} state={state} />;
              })}

              {!hideCloudCta && !isMastraPlatform ? (
                <MainSidebar.NavLink
                  link={{
                    name: 'Share',
                    url: 'https://mastra.ai/cloud',
                    icon: <CloudUploadIcon />,
                    variant: 'featured',
                    tooltipMsg: "You're running Mastra Studio locally. Want your team to collaborate?",
                    isOnMastraPlatform: false,
                  }}
                  state={state}
                />
              ) : null}
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
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
