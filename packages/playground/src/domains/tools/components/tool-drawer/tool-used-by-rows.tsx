import { useToolAgents } from '../../hooks/use-tool-agents';
import { ToolAgentRow } from './tool-agent-row';
import { ToolSettingsEmptyRow } from './tool-settings-empty-row';

export interface ToolUsedByRowsProps {
  toolId: string;
  currentAgentId?: string;
}

export function ToolUsedByRows({ toolId, currentAgentId }: ToolUsedByRowsProps) {
  const { agents, isLoading, isError } = useToolAgents(toolId, currentAgentId);

  if (isLoading) return <ToolSettingsEmptyRow message="Loading agents…" />;
  // Checked before the empty state: a failed request says nothing about which agents use the tool.
  if (isError) return <ToolSettingsEmptyRow message="Couldn't load the agents that use this tool." />;
  if (agents.length === 0) return <ToolSettingsEmptyRow message="No agents use this tool yet." />;

  return agents.map(agent => <ToolAgentRow key={agent.id} agent={agent} isCurrent={agent.id === currentAgentId} />);
}
