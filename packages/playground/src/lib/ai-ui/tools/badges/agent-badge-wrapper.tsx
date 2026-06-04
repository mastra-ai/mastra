import { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { AgentMessage } from './agent-badge';
import { AgentBadge } from './agent-badge';
import { LoadingBadge } from './loading-badge';
import { resolveToChildMessages } from './resolve-child-messages';
import type { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';

interface SubAgentToolResult {
  toolName: string;
  toolCallId: string;
  result: any;
  args: any;
}

interface AgentBadgeWrapperProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
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
}: AgentBadgeWrapperProps) => {
  const shouldFetchAgentMessages = Boolean(
    result?.subAgentThreadId && !result.text && !result.subAgentToolResults?.length,
  );
  const { data, isLoading } = useAgentMessages({
    threadId: shouldFetchAgentMessages ? result?.subAgentThreadId : undefined,
    agentId,
    memory: true,
  });

  if (isLoading) {
    return <LoadingBadge />;
  }

  const convertedMessages = data?.messages ? toAISdkV5Messages(data.messages) : [];

  // Build child messages from available sources:
  // 1. childMessages (built during live streaming by toUIMessageFromAgent)
  // 2. subAgentToolResults (from backend tool-result, available after approval or on refresh)
  // 3. resolveToChildMessages (fetched from subagent thread via API)
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

  if (!childMessages) {
    childMessages = resolveToChildMessages(convertedMessages) as AgentMessage[];
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
    />
  );
};
