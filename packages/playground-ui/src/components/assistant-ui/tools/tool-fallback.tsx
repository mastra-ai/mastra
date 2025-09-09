import { ToolCallMessagePartComponent } from '@assistant-ui/react';

import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { useWorkflow } from '@/hooks/use-workflows';
import { WorkflowRunProvider } from '@/domains/workflows';
import { LoadingBadge } from './badges/loading-badge';

export const ToolFallback: ToolCallMessagePartComponent = ({ toolName, argsText, result, args, ...props }) => {
  return (
    <WorkflowRunProvider>
      <ToolFallbackInner toolName={toolName} argsText={argsText} result={result} args={args} {...props} />
    </WorkflowRunProvider>
  );
};

const ToolFallbackInner: ToolCallMessagePartComponent = ({ toolName, argsText, result, args }) => {
  // We need to handle the stream data even if the workflow is not resolved yet
  // The response from the fetch request resolving the workflow might theoretically
  // be resolved after we receive the first stream event
  useWorkflowStream(args.__mastraMetadata?.partialChunk);
  const { data: workflow, isLoading } = useWorkflow(toolName);

  if (isLoading) return <LoadingBadge />;

  if (workflow) {
    return (
      <WorkflowBadge
        workflowId={toolName}
        workflow={workflow}
        isStreaming={args.__mastraMetadata?.isStreaming}
        runId={result?.runId}
      />
    );
  }

  return <ToolBadge toolName={toolName} argsText={argsText} result={result} />;
};
