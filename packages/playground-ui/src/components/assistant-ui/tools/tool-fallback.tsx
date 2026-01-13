import { ToolCallMessagePartProps } from '@assistant-ui/react';

import { ToolBadge } from './badges/tool-badge';
import { useWorkflowStream, WorkflowBadge } from './badges/workflow-badge';
import { WorkflowRunProvider } from '@/domains/workflows';
import { MastraUIMessage } from '@mastra/react';
import { AgentBadgeWrapper } from './badges/agent-badge-wrapper';

export interface ToolFallbackProps extends ToolCallMessagePartProps<any, any> {
  metadata?: MastraUIMessage['metadata'];
}

export const ToolFallback = ({ toolName, result, args, ...props }: ToolFallbackProps) => {
  return (
    <WorkflowRunProvider workflowId={''} withoutTimeTravel>
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

  const isNetwork = metadata?.mode === 'network';

  const agentToolName = toolName.startsWith('agent-') ? toolName.substring('agent-'.length) : toolName;
  const workflowToolName = toolName.startsWith('workflow-') ? toolName.substring('workflow-'.length) : toolName;

  const requireApprovalMetadata =
    (metadata?.mode === 'stream' || metadata?.mode === 'network') && metadata?.requireApprovalMetadata;
  const suspendedTools = (metadata?.mode === 'stream' || metadata?.mode === 'network') && metadata?.suspendedTools;

  const toolApprovalMetadata = requireApprovalMetadata
    ? (requireApprovalMetadata?.[toolName] ?? requireApprovalMetadata?.[toolCallId])
    : undefined;

  const suspendedToolMetadata = suspendedTools ? suspendedTools?.[toolName] : undefined;

  const toolCalled = metadata?.mode === 'network' && metadata?.hasMoreMessages ? true : undefined;

  useWorkflowStream(result);

  if (isAgent) {
    return (
      <AgentBadgeWrapper
        agentId={agentToolName}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        toolName={toolName}
        isNetwork={isNetwork}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        toolCalled={toolCalled}
      />
    );
  }

  if (isWorkflow) {
    const isStreaming = metadata?.mode === 'stream' || metadata?.mode === 'network';

    return (
      <WorkflowBadge
        workflowId={workflowToolName}
        isStreaming={isStreaming}
        result={result}
        metadata={metadata}
        toolCallId={toolCallId}
        toolApprovalMetadata={toolApprovalMetadata}
        suspendPayload={suspendedToolMetadata?.suspendPayload}
        toolName={toolName}
        isNetwork={isNetwork}
        toolCalled={toolCalled}
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
      toolCallId={toolCallId}
      toolApprovalMetadata={toolApprovalMetadata}
      suspendPayload={suspendedToolMetadata?.suspendPayload}
      isNetwork={isNetwork}
      toolCalled={toolCalled}
    />
  );
};
