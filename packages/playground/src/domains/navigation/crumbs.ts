import type { ComponentType, ReactNode, SVGProps } from 'react';
import { AgentCrumb, AgentSwitcher } from '@/domains/agents/agent-crumb';
import { DatasetCrumb, DatasetSwitcher } from '@/domains/datasets/dataset-crumb';
import { McpServerCrumb, McpServerSwitcher } from '@/domains/mcps/mcp-crumbs';
import { ProcessorCrumb, ProcessorSwitcher } from '@/domains/processors/processor-crumb';
import { ScorerCrumb, ScorerSwitcher } from '@/domains/scores/scorer-crumb';
import { ToolCrumb, ToolSwitcher } from '@/domains/tools/tool-crumb';
import { WorkflowCrumb, WorkflowSwitcher } from '@/domains/workflows/workflow-crumbs';
import { findNavItem } from '@/lib/nav/nav-items';

export type CrumbIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface CrumbBase {
  /** Stable identifier used as the React key. Prefer semantic ids like `agent` or `dataset-item`. */
  id: string;
  to?: string;
  icon?: CrumbIcon;
  /** Hook-driven control rendered next to the crumb label (e.g. a copy button). */
  Action?: ComponentType;
  /** Hook-driven icon-only entity switcher; on the current crumb it opens from the whole crumb. */
  Switcher?: ComponentType;
}

export type CrumbDef = CrumbBase &
  (
    | { label: string; node?: never; Component?: never }
    | { node: ReactNode; label?: never; Component?: never }
    | { Component: ComponentType; label?: never; node?: never }
  );

type NavCrumbOverrides = Partial<Pick<CrumbDef, 'id' | 'label' | 'to' | 'icon'>>;

/** Crumb derived from the nav registry — guarantees icon/label parity with the sidebar. */
export function navCrumb(url: string, overrides?: NavCrumbOverrides): CrumbDef {
  const item = findNavItem(url);
  if (!item) throw new Error(`navCrumb: unknown nav url "${url}"`);
  return { id: `nav:${url}`, label: item.name, icon: item.Icon, to: url, ...overrides };
}

export const decodeRouteParam = (value: string | undefined) => {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const truncateItemIdCrumb = (value: string | undefined) => {
  const decoded = decodeRouteParam(value);
  return decoded.length > 8 ? `${decoded.slice(0, 8)}...` : decoded;
};

// Entity crumbs: name + icon-only switcher in the crumb `switcher` slot.
export const agentCrumb = {
  id: 'agent',
  Component: AgentCrumb,
  Switcher: AgentSwitcher,
} satisfies CrumbDef;
export const scorerCrumb = {
  id: 'scorer',
  Component: ScorerCrumb,
  Switcher: ScorerSwitcher,
} satisfies CrumbDef;
export const toolCrumb = {
  id: 'tool',
  Component: ToolCrumb,
  Switcher: ToolSwitcher,
} satisfies CrumbDef;
export const processorCrumb = {
  id: 'processor',
  Component: ProcessorCrumb,
  Switcher: ProcessorSwitcher,
} satisfies CrumbDef;
export const mcpServerCrumb = {
  id: 'mcp-server',
  Component: McpServerCrumb,
  Switcher: McpServerSwitcher,
} satisfies CrumbDef;
export const workflowCrumb = {
  id: 'workflow',
  Component: WorkflowCrumb,
  Switcher: WorkflowSwitcher,
} satisfies CrumbDef;
export const datasetCrumb = {
  id: 'dataset',
  Component: DatasetCrumb,
  Switcher: DatasetSwitcher,
} satisfies CrumbDef;
