'use client';

import {
  GaugeIcon,
  EyeIcon,
  PackageIcon,
  HomeIcon,
  GlobeIcon,
  BookIcon,
  EarthIcon,
  CloudUploadIcon,
  MessagesSquareIcon,
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
} from '@mastra/playground-ui';

const mainNavigation: NavSection[] = [
  {
    key: 'main',
    links: [
      {
        name: 'Agents',
        url: '/agents',
        icon: <AgentIcon />,
      },
      {
        name: 'Workflows',
        url: '/workflows',
        icon: <WorkflowIcon />,
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        icon: <McpServerIcon />,
      },
      {
        name: 'Tools',
        url: '/tools',
        icon: <ToolsIcon />,
      },
      {
        name: 'Scorers',
        url: '/scorers',
        icon: <GaugeIcon />,
      },

      {
        name: 'Request Context',
        url: '/request-context',
        icon: <GlobeIcon />,
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
      url: 'http://localhost:4111/swagger-ui',
      icon: <EarthIcon />,
    },
    {
      name: 'Documentation',
      url: 'https://mastra.ai/en/docs',
      icon: <BookIcon />,
    },
    {
      name: 'Github',
      url: 'https://github.com/mastra-ai/mastra',
      icon: <GithubIcon />,
    },
    {
      name: 'Community',
      url: 'https://discord.gg/BTYqqHKUrf',
      icon: <MessagesSquareIcon />,
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

  return (
    <MainSidebar>
      <div className="pt-[.75rem] mb-[1rem] -ml-[.2rem] sticky top-0 bg-surface1 z-10">
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
          return (
            <MainSidebar.NavSection key={section.key}>
              {section?.title ? (
                <MainSidebar.NavHeader state={state}>{section.title}</MainSidebar.NavHeader>
              ) : (
                <>{section?.separator && <MainSidebar.NavSeparator />}</>
              )}
              <MainSidebar.NavList>
                {section.links.map(link => {
                  const [_, pagePath] = pathname.split('/');
                  const lowercasedPagePath = link.name.toLowerCase();
                  const isActive = link.url === pathname || link.name === pathname || pagePath === lowercasedPagePath;

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
              {secondNavigation.links.map(link => {
                return <MainSidebar.NavLink key={link.name} link={link} state={state} />;
              })}
              {!hideCloudCta && (
                <MainSidebar.NavLink
                  link={{
                    name: 'Share',
                    url: 'https://mastra.ai/cloud',
                    icon: <CloudUploadIcon />,
                    variant: 'featured',
                    tooltipMsg: 'You’re running Mastra Studio locally. Want your team to collaborate?',
                  }}
                  state={state}
                />
              )}
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}
