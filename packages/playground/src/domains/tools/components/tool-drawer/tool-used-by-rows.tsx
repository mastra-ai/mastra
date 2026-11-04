import { DataList } from '@mastra/playground-ui/components/DataList';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';
import { useToolAgents } from '../../hooks/use-tool-agents';
import { ToolAgentRow } from './tool-agent-row';
import { ToolSettingsEmptyRow } from './tool-settings-empty-row';

export interface ToolUsedByRowsProps {
  toolId: string;
  currentAgentId?: string;
}

function getStatusMessage({ isLoading, isError, isEmpty }: { isLoading: boolean; isError: boolean; isEmpty: boolean }) {
  if (isLoading) return 'Loading agents…';
  // Checked before the empty state: a failed request says nothing about which agents use the tool.
  if (isError) return "Couldn't load the agents that use this tool.";
  if (isEmpty) return 'No agents use this tool yet.';
}

export function ToolUsedByRows({ toolId, currentAgentId }: ToolUsedByRowsProps) {
  const { agents, isLoading, isError } = useToolAgents(toolId, currentAgentId);

  const message = getStatusMessage({ isLoading, isError, isEmpty: agents.length === 0 });

  if (message) {
    return (
      <SettingsContainer>
        <ToolSettingsEmptyRow message={message} />
      </SettingsContainer>
    );
  }

  return (
    <DataList columns="minmax(0,1fr) auto" fit="container">
      {agents.map(agent => (
        <ToolAgentRow key={agent.id} agent={agent} isCurrent={agent.id === currentAgentId} />
      ))}
    </DataList>
  );
}
