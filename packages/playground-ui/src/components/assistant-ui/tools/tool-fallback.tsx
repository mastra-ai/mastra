import { ToolCallMessagePartProps } from '@assistant-ui/react';

import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { WorkflowRunProvider } from '@/domains/workflows';
import { MastraUIMessage } from '@mastra/react';
import { useToolCall } from '@/services/tool-call-provider';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';

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

const ToolFallbackInner = ({ toolName, result, args, metadata, toolCallId, ...props }: ToolFallbackProps) => {
  // We need to handle the stream data even if the workflow is not resolved yet
  // The response from the fetch request resolving the workflow might theoretically
  // be resolved after we receive the first stream event

  const isAgent = (metadata?.mode === 'network' && metadata.from === 'AGENT') || toolName.startsWith('agent-');
  const isWorkflow = (metadata?.mode === 'network' && metadata.from === 'WORKFLOW') || toolName.startsWith('workflow-');

  const { approveToolcall, declineToolcall, isRunning, toolCallApprovals } = useToolCall();

  const handleApprove = (toolCallId: string) => {
    approveToolcall(toolCallId);
  };

  const handleDecline = (toolCallId: string) => {
    declineToolcall(toolCallId);
  };

  const agentToolName = toolName.startsWith('agent-') ? toolName.substring('agent-'.length) : toolName;
  const workflowToolName = toolName.startsWith('workflow-') ? toolName.substring('workflow-'.length) : toolName;

  useWorkflowStream(result);

  if (isAgent) {
    return <AgentBadgeWrapper agentId={agentToolName} result={result} metadata={metadata} />;
  }

  const requireApprovalMetadata = metadata?.mode === 'stream' && metadata?.requireApprovalMetadata;

  const toolApprovalMetadata = requireApprovalMetadata ? requireApprovalMetadata?.[toolCallId] : undefined;
  const toolCallApprovalStatus = toolCallApprovals?.[toolCallId]?.status;

  if (isWorkflow) {
    const isStreaming = metadata?.mode === 'stream' || metadata?.mode === 'network';

    return (
      <WorkflowBadge
        workflowId={workflowToolName}
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
      requiresApproval={!!toolApprovalMetadata}
      onApprove={() => handleApprove(toolApprovalMetadata?.toolCallId ?? '')}
      onDecline={() => handleDecline(toolApprovalMetadata?.toolCallId ?? '')}
      isRunning={isRunning}
      toolCallApprovalStatus={toolCallApprovalStatus}
    />
  );
};
