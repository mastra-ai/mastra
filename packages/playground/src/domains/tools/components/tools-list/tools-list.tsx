import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { EntityList, EntityListSkeleton, AgentIcon, truncateString } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
import { useLinkComponent } from '@/lib/framework';

export interface ToolsListProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  search?: string;
}

export function ToolsList({ tools, agents, isLoading, search = '' }: ToolsListProps) {
  const { paths, Link } = useLinkComponent();

  const toolData = useMemo(() => prepareToolsTable(tools, agents), [tools, agents]);

  const filteredData = useMemo(
    () => toolData.filter(tool => tool.id.toLowerCase().includes(search.toLowerCase())),
    [toolData, search],
  );

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCellSmart
          long="Agents"
          short={<AgentIcon />}
          tooltip="Attached Agents"
          className="text-center"
        />
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Tools match your search" /> : null}

      {filteredData.map(tool => {
        const name = truncateString(tool.id, 50);
        const description = truncateString(tool.description ?? '', 200);
        const agentsCount = tool.agents.length;

        return (
          <EntityList.RowLink key={tool.id} to={paths.toolLink(tool.id)} LinkComponent={Link}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
