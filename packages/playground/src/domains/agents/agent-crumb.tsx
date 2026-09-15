import { CrumbSkeleton } from '@mastra/playground-ui/components/Breadcrumb';
import { useParams } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';
import { useAgents } from '@/domains/agents/hooks/use-agents';

export function AgentCrumb() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agents, isLoading } = useAgents();
  if (!agentId) return null;
  if (isLoading) return <CrumbSkeleton />;

  return agents?.[agentId]?.name || agentId;
}

export function AgentToolCrumb() {
  const { toolId } = useParams<{ toolId: string }>();
  return toolId ?? null;
}

export function AgentSwitcherAction() {
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return null;

  return <AgentCombobox value={agentId} variant="ghost" size="icon-sm" align="end" aria-label="Switch agent" />;
}
