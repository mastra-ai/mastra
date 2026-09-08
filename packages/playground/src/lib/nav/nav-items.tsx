import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { DatasetsIcon } from '@mastra/playground-ui/icons/DatasetsIcon';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { HomeIcon } from '@mastra/playground-ui/icons/HomeIcon';
import { LogsIcon } from '@mastra/playground-ui/icons/LogsIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { MetricsIcon } from '@mastra/playground-ui/icons/MetricsIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { PromptIcon } from '@mastra/playground-ui/icons/PromptIcon';
import { RequestContextIcon } from '@mastra/playground-ui/icons/RequestContextIcon';
import { ScorersIcon } from '@mastra/playground-ui/icons/ScorersIcon';
import { SettingsIcon } from '@mastra/playground-ui/icons/SettingsIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { WorkspacesIcon } from '@mastra/playground-ui/icons/WorkspacesIcon';
import { BookIcon, ClipboardCheck, Inbox, LayoutGrid } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  name: string;
  url: string;
  Icon: NavIcon;
  docs?: { href: string; label?: string };
  isOnMastraPlatform?: boolean;
  activePaths?: string[];
  /** When true, the item stays in the registry (so breadcrumbs/routes can resolve it) but is hidden from the sidebar and command palette. */
  hidden?: boolean;
}

export interface NavSection {
  key: string;
  title: string;
  href?: string;
  items: NavItem[];
}

// The Intelligence sidebar link is gated behind the dedicated MASTRA_SIGNALS_UI flag
// so the feature can be toggled independently of the platform config that the
// Intelligence route itself consumes.
const isSignalsEnabled =
  typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).MASTRA_SIGNALS_UI === 'true';

const signalsNavItem: NavItem = {
  name: 'Intelligence',
  url: '/intelligence',
  activePaths: ['/intelligence'],
  Icon: LayoutGrid,
  docs: {
    href: 'https://mastra.ai/en/docs/mastra-platform/trace-intelligence',
    label: 'Trace intelligence documentation',
  },
  isOnMastraPlatform: true,
  // Kept in the registry so /intelligence routes and breadcrumbs always resolve, but
  // only surfaced in the sidebar/command palette when the flag is enabled.
  hidden: !isSignalsEnabled,
};

export const mainNav: NavSection[] = [
  {
    key: 'inbox',
    title: '',
    items: [
      {
        name: 'Inbox',
        url: '/inbox',
        Icon: Inbox,
        isOnMastraPlatform: true,
      },
    ],
  },
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
        docs: { href: 'https://mastra.ai/docs/evals/datasets', label: 'Datasets documentation' },
        isOnMastraPlatform: true,
      },
      {
        name: 'Experiments',
        url: '/experiments',
        Icon: ExperimentsIcon,
        docs: {
          href: 'https://mastra.ai/docs/evals/experiments',
          label: 'Experiments documentation',
        },
        isOnMastraPlatform: true,
      },
      {
        name: 'Review Queue',
        url: '/experiments/review-queue',
        Icon: ClipboardCheck,
        docs: {
          href: 'https://mastra.ai/docs/evals/experiments',
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
        url: '/traces',
        Icon: TraceIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/tracing/overview', label: 'Traces documentation' },
        isOnMastraPlatform: true,
      },
      signalsNavItem,
      {
        name: 'Logs',
        url: '/logs',
        Icon: LogsIcon,
        docs: { href: 'https://mastra.ai/en/docs/observability/logging', label: 'Logs documentation' },
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
