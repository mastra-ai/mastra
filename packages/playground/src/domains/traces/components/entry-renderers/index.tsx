import { spanSubject } from '../../lib/humanize-span-name';
import { ModelGenerationEntry } from './model-generation-entry';
import { ProcessorRunEntry } from './processor-run-entry';
import { ToolCallEntry } from './tool-call-entry';
import type { EntryRendererProps } from './types';
import { WorkflowRunEntry } from './workflow-run-entry';
import { WorkflowStepEntry } from './workflow-step-entry';
import { WorkspaceActionEntry } from './workspace-action-entry';

export function EntryContent({ span }: EntryRendererProps) {
  switch (span.spanType) {
    case 'model_generation':
      return <ModelGenerationEntry span={span} />;
    case 'tool_call':
    case 'client_tool_call':
    case 'provider_tool_call':
    case 'mcp_tool_call':
      return <ToolCallEntry span={span} />;
    case 'processor_run':
      return <ProcessorRunEntry span={span} />;
    case 'workflow_run':
      return <WorkflowRunEntry span={span} />;
    case 'workflow_step':
      return <WorkflowStepEntry span={span} />;
    case 'workspace_action':
      return <WorkspaceActionEntry span={span} />;
    default:
      return <p className="text-neutral6 text-ui-sm">{spanSubject(span)}</p>;
  }
}
