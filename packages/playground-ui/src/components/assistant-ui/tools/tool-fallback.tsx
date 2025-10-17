import { ToolCallMessagePartProps } from '@assistant-ui/react';

import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { useWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunProvider } from '@/domains/workflows';
import { LoadingBadge } from './badges/loading-badge';
import { AgentBadge } from './badges/agent-badge';
import { MastraUIMessage } from '@mastra/react';

export interface ToolFallbackProps extends ToolCallMessagePartProps<any, any> {
  metadata?: MastraUIMessage['metadata'];
}

export const ToolFallback = ({ toolName, result, args, ...props }: ToolFallbackProps) => {
  return (
    <WorkflowRunProvider>
      <ToolFallbackInner toolName={toolName} result={result} args={args} {...props} />
    </WorkflowRunProvider>
  );
};

const ToolFallbackInner = ({ toolName, result, args, metadata, ...props }: ToolFallbackProps) => {
  // We need to handle the stream data even if the workflow is not resolved yet
  // The response from the fetch request resolving the workflow might theoretically
  // be resolved after we receive the first stream event

  const isAgent = (metadata?.mode === 'network' && metadata.from === 'AGENT') || toolName.startsWith('agent-');
  const isWorkflow = (metadata?.mode === 'network' && metadata.from === 'WORKFLOW') || toolName.startsWith('workflow-');

  const agentToolName = toolName.startsWith('agent-') ? toolName?.split('agent-')[1] : toolName;
  const workflowToolName = toolName.startsWith('workflow-') ? toolName?.split('workflow-')[1] : toolName;

  useWorkflowStream(result);
  const { data: workflow, isLoading } = useWorkflow(workflowToolName, isWorkflow);

  if (isAgent) {
    const messages = result?.childMessages ?? [];

    return <AgentBadge agentId={agentToolName} messages={messages} metadata={metadata} />;
  }

  if (isLoading) return <LoadingBadge />;

  if (workflow) {
    const isStreaming = metadata?.mode === 'stream' || metadata?.mode === 'network';

    return (
      <WorkflowBadge
        workflowId={workflowToolName}
        workflow={workflow}
        isStreaming={isStreaming}
        runId={result?.runId}
        metadata={metadata}
      />
    );
  }

  return (
    <ToolBadge
      toolName={toolName}
      args={args}
      result={result}
      toolOutput={result?.toolOutput || []}
      metadata={metadata}
    />
  );
};
