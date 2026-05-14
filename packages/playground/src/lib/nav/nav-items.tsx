import {
  AgentIcon,
  DatasetsIcon,
  ExperimentsIcon,
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
import { BookIcon } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  name: string;
  url: string;
  Icon: NavIcon;
  docs?: { href: string; label?: string };
  isOnMastraPlatform?: boolean;
  requiredPermission?: string;
  requiredAnyPermission?: string[];
  activePaths?: string[];
}

export interface NavSection {
  key: string;
  title: string;
  href: string;
  items: NavItem[];
}

export const mainNav: NavSection[] = [
  {
    key: 'primitives',
    title: 'Primitives',
    href: '/primitives',
    items: [
      {
        name: 'Agents',
        url: '/agents',
        Icon: AgentIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/overview', label: 'Agents documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'agents:read',
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
        requiredPermission: 'workflows:read',
      },
      {
        name: 'Processors',
        url: '/processors',
        Icon: ProcessorIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/processors', label: 'Processors documentation' },
        isOnMastraPlatform: false,
        requiredPermission: 'processors:read',
      },
      {
        name: 'MCP Servers',
        url: '/mcps',
        Icon: McpServerIcon,
        docs: { href: 'https://mastra.ai/en/docs/tools-mcp/mcp-overview', label: 'MCP documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'mcps:read',
      },
      {
        name: 'Tools',
        url: '/tools',
        Icon: ToolsIcon,
        docs: { href: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp', label: 'Tools documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'tools:read',
      },
      {
        name: 'Workspaces',
        url: '/workspaces',
        Icon: WorkspacesIcon,
        docs: { href: 'https://mastra.ai/en/docs/workspace/overview', label: 'Workspaces documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'workspaces:read',
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
    href: '/evaluation',
    items: [
      {
        name: 'Scorers',
        url: '/scorers',
        Icon: ScorersIcon,
        docs: { href: 'https://mastra.ai/en/docs/evals/overview', label: 'Scorers documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'scorers:read',
      },
      {
        name: 'Datasets',
        url: '/datasets',
        Icon: DatasetsIcon,
        docs: { href: 'https://mastra.ai/en/docs/evals/datasets/overview', label: 'Datasets documentation' },
        isOnMastraPlatform: true,
        requiredAnyPermission: ['datasets:read'],
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
        requiredAnyPermission: ['datasets:read'],
      },
    ],
  },
  {
    key: 'observability',
    title: 'Observability',
    href: '/observability-overview',
    items: [
      {
        name: 'Metrics',
        url: '/metrics',
        Icon: MetricsIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/overview', label: 'Metrics documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'observability:read',
      },
      {
        name: 'Traces',
        url: '/observability',
        activePaths: ['/traces'],
        Icon: TraceIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/tracing/overview', label: 'Traces documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'observability:read',
      },
      {
        name: 'Logs',
        url: '/logs',
        Icon: LogsIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/logging', label: 'Logs documentation' },
        isOnMastraPlatform: true,
        requiredPermission: 'observability:read',
      },
    ],
  },
];

export const bottomNav: NavItem[] = [
  { name: 'Settings', url: '/settings', Icon: SettingsIcon, isOnMastraPlatform: false },
  { name: 'Resources', url: '/resources', Icon: BookIcon, isOnMastraPlatform: true },
];

/** Section-level evaluation/observability/overview crumbs the sidebar headers link to. */
export const sectionNav: NavItem[] = [
  {
    name: 'Evaluation',
    url: '/evaluation',
    Icon: ExperimentsIcon,
    docs: { href: 'https://mastra.ai/en/docs/evals/overview', label: 'Evaluation documentation' },
  },
  {
    name: 'Observability',
    url: '/observability-overview',
    Icon: TraceIcon,
    docs: { href: 'https://mastra.ai/en/docs/observability/overview', label: 'Observability documentation' },
  },
  {
    name: 'Primitives',
    url: '/primitives',
    Icon: AgentIcon,
  },
];

const allItems: NavItem[] = [...mainNav.flatMap(s => s.items), ...bottomNav, ...sectionNav];

export function findNavItem(url: string): NavItem | undefined {
  return allItems.find(i => i.url === url);
}
