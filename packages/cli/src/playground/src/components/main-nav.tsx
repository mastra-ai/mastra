import {
  AgentIcon,
  AppSidebar,
  WorkflowIcon,
  McpServerIcon,
  ToolsIcon,
  type AppSidebarSection,
  GithubIcon,
} from '@mastra/playground-ui';
import { BookIcon, GlobeIcon, NetworkIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export function MainNav() {
  const currentLocation = useLocation();

  const items: AppSidebarSection[] = [
    [
      {
        label: 'Agents',
        to: '/agents',
        icon: <AgentIcon />,
      },
      {
        label: 'Networks',
        to: '/networks',
        icon: <NetworkIcon />,
      },
      {
        label: 'Tools',
        to: '/tools',
        icon: <ToolsIcon />,
      },
      {
        label: 'MCP Servers',
        to: '/mcps',
        icon: <McpServerIcon />,
      },
      {
        label: 'Workflows',
        to: '/workflows',
        icon: <WorkflowIcon />,
      },
      {
        label: 'Runtime Context',
        to: '/runtime-context',
        icon: <GlobeIcon />,
      },
    ],
    [
      {
        label: 'Documentation',
        href: 'https://mastra.ai/en/docs',
        icon: <BookIcon />,
      },
      {
        label: 'Community',
        href: 'https://github.com/mastra-ai/mastra',
        icon: <GithubIcon />,
      },
    ],
  ];

  return <AppSidebar items={items} linkComponent={Link} currentPath={currentLocation.pathname} />;
}
