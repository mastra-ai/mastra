import { createContext, useContext, useMemo } from 'react';
import { getDelegatedTool } from './span-payload/span-payload-registry';
import type { RecordNavigation } from '@/domains/chat/context/record-navigation';

/**
 * Where the detail panels open things, as the host's callbacks: they draw a button where a callback is
 * given, and text where it is not. No href, no link component, no route: Studio navigates with its router,
 * an MCP server app with its host. Pass it once to `TracePanel`, `ThreadTrace` or `SpanDataPanel`.
 */
export interface TraceNavigation extends RecordNavigation {
  /** Opens a trace on its own page (`TracePanel.OpenPageButton`, `ThreadTrace.TraceLink`). */
  onOpenTrace?: (traceId: string) => void;
  /** Opens an agent: a trace's entity, a sub-agent a span delegated to. */
  onOpenAgent?: (agentId: string) => void;
  /** Opens a workflow: a trace's entity, a workflow a span ran as a tool. */
  onOpenWorkflow?: (workflowId: string) => void;
  /** Opens a registered tool, by its registry key. */
  onOpenTool?: (toolId: string) => void;
}

export const TraceNavigationContext = createContext<TraceNavigation>({});

/** The navigation the nearest panel root was given; empty outside one, so every link shows as text. */
export function useTraceNavigation(): TraceNavigation {
  return useContext(TraceNavigationContext);
}

/** Opens the workflow or sub-agent behind a tool name (`workflow-<key>`, `agent-<key>`), when the host can. */
export function getDelegatedToolOpener(navigation: TraceNavigation, toolName: string): (() => void) | undefined {
  const delegated = getDelegatedTool(toolName);
  if (!delegated) return undefined;
  const open = delegated.kind === 'workflow' ? navigation.onOpenWorkflow : navigation.onOpenAgent;
  return open && (() => open(delegated.key));
}

/** Opens a trace's root entity, an agent or a workflow, when the host can. */
export function getEntityOpener(
  navigation: TraceNavigation,
  entity: { entityType?: string | null; entityId?: string | null } | undefined,
): (() => void) | undefined {
  const { entityType, entityId } = entity ?? {};
  if (!entityType || !entityId) return undefined;
  const type = entityType.toLowerCase();
  const open = type.includes('workflow')
    ? navigation.onOpenWorkflow
    : type.includes('agent')
      ? navigation.onOpenAgent
      : undefined;
  return open && (() => open(entityId));
}

/** What a chat read back inside the panels needs of the navigation: its workspace and Knowledge links. */
export function useRecordNavigationOf({ onOpenWorkspace, onOpenKnowledgePage }: TraceNavigation): RecordNavigation {
  return useMemo(() => ({ onOpenWorkspace, onOpenKnowledgePage }), [onOpenWorkspace, onOpenKnowledgePage]);
}
