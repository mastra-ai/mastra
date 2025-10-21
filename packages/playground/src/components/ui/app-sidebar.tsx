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
} from '@mastra/playground-ui';

export const LogoWithoutText = (props: { className?: string }) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21" fill="none">
    <rect x="0.605469" y="0.5" width="20" height="20" rx="2.18625" fill="black" />
    <circle cx="10.6059" cy="10.5004" r="6.0121" stroke="url(#paint0_linear_18520_30330)" strokeWidth="0.766389" />
    <ellipse
      cx="10.6069"
      cy="10.501"
      rx="6.0121"
      ry="4.0324"
      transform="rotate(45 10.6069 10.501)"
      stroke="url(#paint1_linear_18520_30330)"
      strokeWidth="0.766389"
    />
    <path d="M8.15234 10.5234H13.0931" stroke="url(#paint2_linear_18520_30330)" strokeWidth="0.766389" />
    <path d="M9.36523 11.7773L11.8755 9.26708" stroke="url(#paint3_linear_18520_30330)" strokeWidth="0.766389" />
    <path d="M11.877 11.7773L9.36669 9.26708" stroke="url(#paint4_linear_18520_30330)" strokeWidth="0.766389" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.49185 7.85663C5.44831 8.55655 4.84055 9.49673 4.84055 10.5025C4.84055 11.5082 5.44831 12.4484 6.49185 13.1483C7.5338 13.8472 8.98737 14.2875 10.6052 14.2875C12.2231 14.2875 13.6767 13.8472 14.7186 13.1483C15.7621 12.4484 16.3699 11.5082 16.3699 10.5025C16.3699 9.49673 15.7621 8.55655 14.7186 7.85663C13.6767 7.15778 12.2231 6.7175 10.6052 6.7175C8.98737 6.7175 7.5338 7.15778 6.49185 7.85663ZM6.21621 7.44566C7.35021 6.68507 8.9027 6.22266 10.6052 6.22266C12.3078 6.22266 13.8602 6.68507 14.9942 7.44566C16.1267 8.20518 16.8648 9.2812 16.8648 10.5025C16.8648 11.7238 16.1267 12.7998 14.9942 13.5593C13.8602 14.3199 12.3078 14.7823 10.6052 14.7823C8.9027 14.7823 7.35021 14.3199 6.21621 13.5593C5.0838 12.7998 4.3457 11.7238 4.3457 10.5025C4.3457 9.2812 5.0838 8.20518 6.21621 7.44566Z"
      fill="url(#paint5_linear_18520_30330)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_18520_30330"
        x1="10.6059"
        y1="4.48828"
        x2="10.6059"
        y2="16.5125"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_18520_30330"
        x1="10.6069"
        y1="6.46857"
        x2="10.6069"
        y2="14.5334"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_18520_30330"
        x1="10.6227"
        y1="10.5234"
        x2="10.6227"
        y2="11.5234"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint3_linear_18520_30330"
        x1="10.6204"
        y1="10.5222"
        x2="11.3275"
        y2="11.2293"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint4_linear_18520_30330"
        x1="10.6218"
        y1="10.5222"
        x2="11.3289"
        y2="9.81511"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
      <linearGradient
        id="paint5_linear_18520_30330"
        x1="10.6052"
        y1="6.22266"
        x2="10.6052"
        y2="14.7823"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#CACACA" />
        <stop offset="1" stopColor="#5C5C5C" />
      </linearGradient>
    </defs>
  </svg>
);

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
        name: 'Runtime Context',
        url: '/runtime-context',
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
          <LogoWithoutText className="h-[2.5rem] w-[2.5rem] shrink-0 ml-1" />
        ) : (
          <span className="flex items-center gap-0.5 pl-1">
            <LogoWithoutText className="h-[2.5rem] w-[2.5rem] shrink-0" />
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
                    name: 'Deploy to Mastra Cloud',
                    url: 'https://mastra.ai/cloud',
                    icon: <CloudUploadIcon />,
                    variant: 'featured',
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
