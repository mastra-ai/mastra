import { MastraUIMessage, resolveToChildMessages } from '@mastra/react';
import { AgentBadge, AgentMessage } from './agent-badge';
import { useAgentMessages } from '@/hooks/use-agent-messages';

interface AgentBadgeWrapperProps {
  agentId: string;
  result: { childMessages: AgentMessage[]; subAgentResourceId?: string; subAgentThreadId?: string };
  metadata?: MastraUIMessage['metadata'];
}

export const AgentBadgeWrapper = ({ agentId, result, metadata }: AgentBadgeWrapperProps) => {
  const { data: memoryMessages } = useAgentMessages({ threadId: result?.subAgentThreadId ?? '', agentId });
  const childMessages =
    result?.childMessages ?? resolveToChildMessages((memoryMessages?.uiMessages ?? []) as MastraUIMessage[]);

  return <AgentBadge agentId={agentId} messages={childMessages} metadata={metadata} />;
};
