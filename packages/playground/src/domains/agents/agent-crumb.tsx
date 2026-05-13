import { useParams } from 'react-router';
import { AgentCombobox } from '@/domains/agents/components/agent-combobox';

export function AgentCrumb() {
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return null;
  return <AgentCombobox value={agentId} variant="ghost" size="sm" />;
}

export function AgentToolCrumb() {
  const { toolId } = useParams<{ toolId: string }>();
  return toolId ?? null;
}
