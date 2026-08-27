import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { McpServerIcon } from '@mastra/playground-ui/icons/McpServerIcon';
import { ProcessorIcon } from '@mastra/playground-ui/icons/ProcessorIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { WorkspacesIcon } from '@mastra/playground-ui/icons/WorkspacesIcon';
import type { ReactNode } from 'react';

import type { TimelineSpan } from './build-thread-timeline';
import { isWorkflowTool } from './workflow-tool';

/**
 * When a step maps to an entity that already has a sidebar icon, reuse that icon on the rail so
 * the timeline speaks the same visual language as the rest of Studio. Kinds without a sidebar
 * counterpart (model generation, unknown types) keep the neutral dot.
 */
export function spanIcon(span: TimelineSpan): ReactNode | undefined {
  const className = 'size-3';

  if (isWorkflowTool(span)) return <WorkflowIcon className={className} />;

  switch (span.spanType) {
    case 'agent_run':
      return <AgentIcon className={className} />;
    case 'mcp_tool_call':
      return <McpServerIcon className={className} />;
    case 'tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
      return <ToolsIcon className={className} />;
    case 'processor_run':
      return <ProcessorIcon className={className} />;
    case 'workflow_run':
    case 'workflow_step':
      return <WorkflowIcon className={className} />;
    case 'workspace_action':
      return <WorkspacesIcon className={className} />;
    default:
      return undefined;
  }
}
