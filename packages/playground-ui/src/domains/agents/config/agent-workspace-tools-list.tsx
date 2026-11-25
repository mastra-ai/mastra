import { Badge } from '../../../ds/components/Badge';
import { WORKSPACE_TOOLS_PREFIX } from '../../chat/tools/workspace-tool-constants';
import { AgentMetadataExpandableList } from './agent-metadata-expandable-list';
import { AgentMetadataListEmpty } from './agent-metadata-list';

export interface AgentMetadataWorkspaceToolsListProps {
  tools: string[];
}

function formatWorkspaceToolName(toolName: string): string {
  const prefix = `${WORKSPACE_TOOLS_PREFIX}_`;
  if (toolName.startsWith(prefix)) {
    return toolName.slice(prefix.length);
  }
  return toolName;
}

export const AgentMetadataWorkspaceToolsList = ({ tools }: AgentMetadataWorkspaceToolsListProps) => {
  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No workspace tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataExpandableList
      items={tools}
      getKey={tool => tool}
      renderItem={tool => <Badge>{formatWorkspaceToolName(tool)}</Badge>}
    />
  );
};
