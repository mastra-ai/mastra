import { CrumbSkeleton, crumbSwitcherTriggerProps } from '@mastra/playground-ui/components/Breadcrumb';
import { useAgents } from '@mastra/react/hooks/agents';
import { useNavigate, useParams } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';
import { useIsAgentChat } from '@/domains/chat/hooks/use-is-agent-chat';

export function AgentCrumb() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agents, isLoading } = useAgents();
  if (!agentId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return agents?.[agentId]?.name || agentId;
}

export function AgentSwitcher() {
  const isChat = useIsAgentChat();
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return null;

  return (
    <AgentCombobox
      onValueChange={isChat ? id => void navigate(`/chat/${encodeURIComponent(id)}`) : undefined}
      value={agentId}
      {...crumbSwitcherTriggerProps}
      aria-label="Switch agent"
    />
  );
}
