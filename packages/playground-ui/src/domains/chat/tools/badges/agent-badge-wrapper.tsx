import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import { useAgentMessages } from '@mastra/react/hooks/agents';
import { ToolCard } from '../tool-card';
import type { ToolCardProps } from '../tool-card';
import type { AgentMessage } from './agent-badge';
import { AgentBadge } from './agent-badge';
import { getRecordedSubAgentMessages } from './recorded-sub-agent-messages';
import type { SubAgentResult } from './recorded-sub-agent-messages';
import { resolveToChildMessages } from './resolve-child-messages';
import type { MessageMetadata } from '@/domains/chat';
import { LoadingBadge } from '@/domains/chat/components/loading-badge';
import type { ToolApprovalRequest } from '@/domains/chat/tools/badges/tool-approval-badge';
import type { ActivityStatus } from '@/ds/components/ai/activity';

interface AgentBadgeWrapperProps extends Omit<ToolApprovalRequest, 'toolCalled'> {
  agentId: string;
  result?: SubAgentResult;
  metadata?: MessageMetadata;
  suspendPayload?: any;
  toolCalled?: boolean;
  isComplete?: boolean;
  status?: ActivityStatus;
  errorText?: string;
}

const renderLiveToolCard = (props: ToolCardProps) => <ToolCard {...props} />;

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

  let childMessages = getRecordedSubAgentMessages(result);

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
      renderToolCard={renderLiveToolCard}
    />
  );
};
