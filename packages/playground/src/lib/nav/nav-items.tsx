import {
  AgentIcon,
  DatasetsIcon,
  ExperimentsIcon,
  HomeIcon,
  LogsIcon,
  McpServerIcon,
  MetricsIcon,
  ProcessorIcon,
  PromptIcon,
  RequestContextIcon,
  ScorersIcon,
  SettingsIcon,
  ToolsIcon,
  TraceIcon,
  WorkflowIcon,
  WorkspacesIcon,
} from '@mastra/playground-ui';
import { BookIcon, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  name: string;
  url: string;
  Icon: NavIcon;
  docs?: { href: string; label?: string };
  isOnMastraPlatform?: boolean;
  activePaths?: string[];
}

export interface NavSection {
  key: string;
  title: string;
  href?: string;
  items: NavItem[];
}

export const mainNav: NavSection[] = [
  {
    key: 'primitives',
    title: 'Primitives',
    items: [
      {
        name: 'Agents',
        url: '/agents',
        Icon: AgentIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/overview', label: 'Agents documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Prompts',
        url: '/prompts',
        Icon: PromptIcon,
        docs: {
          href: 'https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks',
          label: 'Prompts documentation',
        },
        isOnMastraPlatform: true,
      },
      {
        name: 'Workflows',
        url: '/workflows',
        Icon: WorkflowIcon,
        docs: { href: 'https://mastra.ai/en/docs/workflows/overview', label: 'Workflows documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Processors',
        url: '/processors',
        Icon: ProcessorIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/processors', label: 'Processors documentation' },
        isOnMastraPlatform: false,
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        Icon: McpServerIcon,
        docs: { href: 'https://mastra.ai/en/docs/tools-mcp/mcp-overview', label: 'MCP documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Tools',
        url: '/tools',
        Icon: ToolsIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp', label: 'Tools documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        Icon: WorkspacesIcon,
        docs: { href: 'https://mastra.ai/en/docs/workspace/overview', label: 'Workspaces documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Request Context',
        url: '/request-context',
        Icon: RequestContextIcon,
        isOnMastraPlatform: true,
      },
    ],
  },
  {
    key: 'evaluation',
    title: 'Evaluation',
    items: [
      {
        name: 'Overview',
        url: '/evaluation',
        Icon: HomeIcon,
        isOnMastraPlatform: true,
      },
      {
        name: 'Scorers',
        url: '/scorers',
        Icon: ScorersIcon,
        docs: { href: 'https://mastra.ai/en/docs/evals/overview', label: 'Scorers documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Datasets',
        url: '/datasets',
        Icon: DatasetsIcon,
        docs: { href: 'https://mastra.ai/en/docs/evals/datasets/overview', label: 'Datasets documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Experiments',
        url: '/experiments',
        Icon: ExperimentsIcon,
        docs: {
          href: 'https://mastra.ai/en/docs/evals/datasets/running-experiments',
          label: 'Experiments documentation',
        },
        isOnMastraPlatform: true,
      },
    ],
  },
  {
    key: 'observability',
    title: 'Observability',
    items: [
      {
        name: 'Metrics',
        url: '/metrics',
        Icon: MetricsIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/overview', label: 'Metrics documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Traces',
        url: '/observability',
        activePaths: ['/traces'],
        Icon: TraceIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/tracing/overview', label: 'Traces documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Logs',
        url: '/logs',
        Icon: LogsIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/logging', label: 'Logs documentation' },
        isOnMastraPlatform: true,
      },
    ],
  },
  {
    key: 'auth',
    title: 'Auth',
    items: [
      {
        name: 'Users',
        url: '/users',
        Icon: Users,
        activePaths: ['/users'],
        isOnMastraPlatform: true,
      },
    ],
  },
];

export const bottomNav: NavItem[] = [
  { name: 'Settings', url: '/settings', Icon: SettingsIcon, isOnMastraPlatform: false },
  { name: 'Resources', url: '/resources', Icon: BookIcon, isOnMastraPlatform: true },
];

/** Section-level entries used to resolve breadcrumb label + icon for the overview routes. */
export const sectionNav: NavItem[] = [
  {
    name: 'Evaluation',
    url: '/evaluation',
    Icon: ExperimentsIcon,
    docs: { href: 'https://mastra.ai/en/docs/evals/overview', label: 'Evaluation documentation' },
  },
];

// sectionNav comes first so /evaluation resolves to "Evaluation" (section crumb) rather than the
// in-section "Overview" NavLink which shares the same url.
const allItems: NavItem[] = [...sectionNav, ...mainNav.flatMap(s => s.items), ...bottomNav];

export function findNavItem(url: string): NavItem | undefined {
  return allItems.find(i => i.url === url);
}
