import { MastraUIMessage, resolveToChildMessages } from '@mastra/react';
import { AgentBadge, AgentMessage } from './agent-badge';
import { useAgentMessages } from '@/hooks/use-agent-messages';
import { ToolApprovalButtonsProps } from './tool-approval-buttons';
import { convertMessages } from '@mastra/core/agent';

interface AgentBadgeWrapperProps extends Omit<ToolApprovalButtonsProps, 'toolCalled'> {
  agentId: string;
  result: { childMessages: AgentMessage[]; subAgentResourceId?: string; subAgentThreadId?: string };
  metadata?: MastraUIMessage['metadata'];
}

export const AgentBadgeWrapper = ({
  agentId,
  result,
  metadata,
  toolCallId,
  toolApprovalMetadata,
}: AgentBadgeWrapperProps) => {
  const { data: memoryMessages } = useAgentMessages({
    threadId: result?.subAgentThreadId ?? '',
    agentId,
    memory: true,
  });
  const convertedMessages = memoryMessages?.messages 
    ? (convertMessages(memoryMessages.messages).to('aiv5-ui') as MastraUIMessage[])
    : [];
  const childMessages =
    result?.childMessages ?? resolveToChildMessages(convertedMessages);

  return (
    <AgentBadge
      agentId={agentId}
      messages={childMessages}
      metadata={metadata}
      toolCallId={toolCallId}
      toolApprovalMetadata={toolApprovalMetadata}
    />
  );
};
