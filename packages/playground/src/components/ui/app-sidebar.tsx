'use client';

import {
  GaugeIcon,
  EyeIcon,
  PackageIcon,
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
  SettingsIcon,
  Dialog,
  DialogContent,
  DialogTitle,
  Badge,
} from '@mastra/playground-ui';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

  {
    key: 'Settings',
    separator: true,
    links: [
      {
        name: 'Settings',
        url: '/settings',
        icon: <SettingsIcon />,
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
  const [isPackagesDialogOpen, setIsPackagesDialogOpen] = useState(false);

  const hideCloudCta = window?.MASTRA_HIDE_CLOUD_CTA === 'true';

  return (
    <>
      <MainSidebar>
        <div className="pt-[.75rem] mb-[2rem] -ml-[.2rem] sticky top-0 bg-surface1 z-10">
          {state === 'collapsed' ? (
            <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0 ml-3" />
          ) : (
            <span className="flex items-center gap-2 pl-3">
              <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
              <span className="font-serif text-sm">Mastra Studio</span>
            </span>
          )}
        </div>

        {/* <button
          onClick={() => setIsPackagesDialogOpen(true)}
          className="ml-[.25rem] mt-2 text-[0.75rem] mb-[1rem] grid grid-cols-[1fr_auto] justify-between items-baseline rounded-lg overflow-hidden "
        >
          <div className="px-[0.75rem] py-[0.1rem] text-icon4 bg-surface5 flex">@mastra/*</div>
          <div className="bg-green-900 px-[0.5rem] py-[0.1rem] text-icon5">Latest</div>
          <div className="bg-yellow-800 px-[0.5rem] py-[0.1rem] text-icon5">2 Outdated</div>
          <div className="bg-red-800 px-[0.5rem] py-[0.1rem] text-icon5">1 Deprecated</div>
        </button> */}

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
          <MainSidebar.NavHeader className="[&>*]:lowercase">@mastra</MainSidebar.NavHeader>
          <button
            onClick={() => setIsPackagesDialogOpen(true)}
            className="ml-[.25rem] mt-2 text-[0.75rem] mb-[1rem] grid grid-cols-[1fr_auto] justify-between items-baseline rounded-lg overflow-hidden w-full"
          >
            <div className="px-[0.75rem] py-[0.1rem] text-icon4 bg-surface5 flex">ver. 1.10.8</div>
            {/* <div className="bg-green-900 px-[0.5rem] py-[0.1rem] text-icon5">Latest</div> */}
            {/* <div className="bg-yellow-800 px-[0.5rem] py-[0.1rem] text-icon5">2 Outdated</div> */}
            <div className="bg-red-800 px-[0.5rem] py-[0.1rem] text-icon5">1 Deprecated</div>
          </button>
          {/* <div
            className={cn(
              'px-3 text-[0.75rem] text-icon3 grid grid-cols-[1fr_auto_auto] mb-2 items-center gap-x-2',
              '[&>b]:w-[0.35rem] [&>b]:h-[0.3rem] [&>b]:bg-green-700 [&>b]:rounded-full',
              '[&>b]:bg-yellow-900',
            )}
          >
            <span>/core</span>
            <b></b>
            <em>0.12.6</em>

            <span>/evals</span>
            <b></b>
            <em>0.13.6</em>

            <span>/observability</span>
            <b></b>
            <em>0.1</em>

            <span>others</span>
            <b></b>
            <em></em>
          </div> */}

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

      <Dialog open={isPackagesDialogOpen} onOpenChange={setIsPackagesDialogOpen}>
        <DialogContent>
          <DialogTitle>Mastra packages in use:</DialogTitle>
          <div
            className={cn(
              'text-[0.875rem] text-icon3 grid grid-cols-[1fr_auto_auto] mb-2 items-center gap-x-4 gap-y-2',
              '[&>b]:bg-green-900 [&>b]:rounded-lg [&>b]:px-2',
            )}
          >
            <span>@mastra/core</span>
            <em>0.12.6</em>
            <Badge variant="success">Latest</Badge>

            <span>@mastra/evals</span>
            <em>0.13.6</em>
            <Badge variant="success">Latest</Badge>

            <span>@mastra/observability</span>
            <em>0.1</em>
            <Badge variant="warning">Outdated</Badge>

            <span>@mastra/memory</span>
            <em>0.1</em>
            <Badge variant="success">Latest</Badge>

            <span>@mastra/loggers</span>
            <em>0.1</em>
            <Badge variant="success">Latest</Badge>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
