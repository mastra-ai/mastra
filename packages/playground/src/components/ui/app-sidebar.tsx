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
} from 'lucide-react';
import { useLocation } from 'react-router';

import {
  AgentIcon,
  GithubIcon,
  McpServerIcon,
  ToolsIcon,
  WorkflowIcon,
  MainSidebar,
  useMainSidebar,
  type NavSection,
  LogoWithoutText,
  SettingsIcon,
  MastraVersionFooter,
  useMastraPlatform,
  useIsCmsAvailable,
  NavLink,
} from '@mastra/playground-ui';

const mainNavigation: NavSection[] = [
  {
    key: 'main',

    links: [
      {
        name: 'Agents',
        url: '/agents',
        icon: <AgentIcon />,
        isOnMastraPlatform: true,
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
      },
      {
        name: 'Processors',
        url: '/processors',
        icon: <Cpu />,
        isOnMastraPlatform: false,
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        icon: <McpServerIcon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Tools',
        url: '/tools',
        icon: <ToolsIcon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Scorers',
        url: '/scorers',
        icon: <GaugeIcon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        icon: <FolderIcon />,
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
        name: 'Observability',
        url: '/observability',
        icon: <EyeIcon />,
        isOnMastraPlatform: true,
      },
      {
        name: 'Datasets',
        url: '/datasets',
        icon: <DatabaseIcon />,
        isOnMastraPlatform: false,
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

const secondNavigation: NavSection = {
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
  }
}

export function AppSidebar() {
  const { state } = useMainSidebar();

  const location = useLocation();
  const pathname = location.pathname;

  const hideCloudCta = window?.MASTRA_HIDE_CLOUD_CTA === 'true';
  const { isMastraPlatform } = useMastraPlatform();
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();

  const cmsOnlyLinks = new Set(['/prompts']);

  const filterPlatformLink = (link: NavLink) => {
    if (cmsOnlyLinks.has(link.url) && !isCmsAvailable && !isCmsLoading) {
      return false;
    }
    if (isMastraPlatform) {
      return link.isOnMastraPlatform;
    }
    return true;
  };

  return (
    <MainSidebar>
      <div className="pt-3 mb-4 -ml-0.5 sticky top-0 bg-surface1 z-10">
        {state === 'collapsed' ? (
          <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0 ml-3" />
        ) : (
          <span className="flex items-center gap-2 pl-3">
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
            <span className="font-serif text-sm">Mastra Studio</span>
          </span>
        )}
      </div>

      <MainSidebar.Nav>
        {mainNavigation.map(section => {
          const filteredLinks = section.links.filter(filterPlatformLink);
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
              {secondNavigation.links.filter(filterPlatformLink).map(link => {
                return <MainSidebar.NavLink key={link.name} link={link} state={state} />;
              })}

              {!hideCloudCta && !isMastraPlatform ? (
                <MainSidebar.NavLink
                  link={{
                    name: 'Share',
                    url: 'https://mastra.ai/cloud',
                    icon: <CloudUploadIcon />,
                    variant: 'featured',
                    tooltipMsg: 'You’re running Mastra Studio locally. Want your team to collaborate?',
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
