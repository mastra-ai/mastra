import type { ComponentType, ReactNode, SVGProps } from 'react';
import { AgentCrumb, AgentSwitcherAction } from '@/domains/agents/agent-crumb';
import { DatasetCrumb, DatasetSwitcherAction } from '@/domains/datasets/dataset-crumb';
import { McpServerCrumb, McpServerSwitcherAction } from '@/domains/mcps/mcp-crumbs';
import { ProcessorCrumb, ProcessorSwitcherAction } from '@/domains/processors/processor-crumb';
import { ScorerCrumb, ScorerSwitcherAction } from '@/domains/scores/scorer-crumb';
import { ToolCrumb, ToolSwitcherAction } from '@/domains/tools/tool-crumb';
import { WorkflowCrumb, WorkflowSwitcherAction } from '@/domains/workflows/workflow-crumbs';
import { findNavItem } from '@/lib/nav/nav-items';

export type CrumbIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface CrumbBase {
  /** Stable identifier used as the React key. Prefer semantic ids like `agent` or `dataset-item`. */
  id: string;
  to?: string;
  icon?: CrumbIcon;
  /** Hook-driven control rendered next to the crumb label (e.g. an icon-only entity switcher). */
  Action?: ComponentType;
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

// Entity crumbs: name + icon-only switcher in the crumb `action` slot.
export const agentCrumb = {
  id: 'agent',
  Component: AgentCrumb,
  Action: AgentSwitcherAction,
} satisfies CrumbDef;
export const scorerCrumb = {
  id: 'scorer',
  Component: ScorerCrumb,
  Action: ScorerSwitcherAction,
} satisfies CrumbDef;
export const toolCrumb = {
  id: 'tool',
  Component: ToolCrumb,
  Action: ToolSwitcherAction,
} satisfies CrumbDef;
export const processorCrumb = {
  id: 'processor',
  Component: ProcessorCrumb,
  Action: ProcessorSwitcherAction,
} satisfies CrumbDef;
export const mcpServerCrumb = {
  id: 'mcp-server',
  Component: McpServerCrumb,
  Action: McpServerSwitcherAction,
} satisfies CrumbDef;
export const workflowCrumb = {
  id: 'workflow',
  Component: WorkflowCrumb,
  Action: WorkflowSwitcherAction,
} satisfies CrumbDef;
export const datasetCrumb = {
  id: 'dataset',
  Component: DatasetCrumb,
  Action: DatasetSwitcherAction,
} satisfies CrumbDef;
