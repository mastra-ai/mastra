import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useAgentMessages } from '@mastra/react/hooks/agents';
import type { AgentMessage } from './agent-badge';
import { AgentBadge } from './agent-badge';
import { resolveToChildMessages } from './resolve-child-messages';
import type { MessageMetadata } from '@/domains/chat';
import { LoadingBadge } from '@/domains/chat/components/loading-badge';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';

interface SubAgentToolResult {
  toolName: string;
  toolCallId: string;
  result: any;
  args: any;
}

interface AgentBadgeWrapperProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  agentId: string;
  result?: {
    childMessages?: AgentMessage[];
    subAgentResourceId?: string;
    subAgentThreadId?: string;
    subAgentToolResults?: SubAgentToolResult[];
    text?: string;
  };
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
  status?: ActivityStatus;
  errorText?: string;
}

export const AgentBadgeWrapper = ({
  agentId,
  result,
  metadata,
  toolCallId,
  toolApprovalMetadata,
  toolName,
  isNetwork,
  suspendPayload,
  toolCalled,
  isComplete,
  status,
  errorText,
}: AgentBadgeWrapperProps) => {
  const shouldFetchAgentMessages = Boolean(
    result?.subAgentThreadId && !result.text && !result.subAgentToolResults?.length,
  );
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAgentMessages({
    threadId: shouldFetchAgentMessages ? result?.subAgentThreadId : undefined,
    agentId,
    memory: true,
  });

  if (isLoading) {
    return <LoadingBadge />;
  }

  const convertedMessages = data?.messages ? toAISdkV5Messages(data.messages) : [];

  let childMessages = result?.childMessages?.length ? result.childMessages : undefined;

  if (!childMessages && result?.subAgentToolResults?.length) {
    const toolMessages: AgentMessage[] = result.subAgentToolResults.map(tr => ({
      type: 'tool' as const,
      toolName: tr.toolName,
      toolCallId: tr.toolCallId,
      args: tr.args,
      toolOutput: tr.result,
    }));
    if (result.text) {
      toolMessages.push({ type: 'text' as const, content: result.text });
    }
    childMessages = toolMessages;
  }

  if (!childMessages && result?.text) {
    childMessages = [{ type: 'text' as const, content: result.text }];
  }

  let onLoadPrevious: (() => void) | undefined;
  if (!childMessages) {
    childMessages = resolveToChildMessages(convertedMessages) as AgentMessage[];
    onLoadPrevious = hasNextPage ? fetchNextPage : undefined;
  }

  const hasStreamingChildMessages = Boolean(result && Object.prototype.hasOwnProperty.call(result, 'childMessages'));

  return (
    <AgentBadge
      agentId={agentId}
      messages={childMessages ?? []}
      keepOpenForStreamingChildMessages={hasStreamingChildMessages}
      metadata={metadata}
      toolCallId={toolCallId}
      toolApprovalMetadata={toolApprovalMetadata}
      toolName={toolName}
      isNetwork={isNetwork}
      suspendPayload={suspendPayload}
      toolCalled={toolCalled}
      isComplete={isComplete}
      status={status}
      errorText={errorText}
      onLoadPrevious={onLoadPrevious}
      isLoadingPrevious={isFetchingNextPage}
    />
  );
};
