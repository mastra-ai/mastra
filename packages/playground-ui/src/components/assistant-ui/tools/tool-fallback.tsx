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

  useWorkflowStream(result);
  const { data: workflow, isLoading } = useWorkflow(toolName);

  const isAgent = metadata?.mode === 'network' && metadata.from === 'AGENT';

  if (isAgent) {
    const messages = result?.childMessages ?? [];

    return <AgentBadge agentId={toolName} messages={messages} metadata={metadata} />;
  }

  if (isLoading) return <LoadingBadge />;

  if (workflow) {
    const isStreaming = metadata?.mode === 'stream' || metadata?.mode === 'network';

    return (
      <WorkflowBadge
        workflowId={toolName}
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
