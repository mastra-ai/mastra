import type { McpServerListResponse } from '@mastra/client-js';
import {
  EntityList,
  EntityListSkeleton,
  ToolsIcon,
  WorkflowIcon,
  AgentIcon,
  truncateString,
} from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useMemo } from 'react';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';
import { useLinkComponent } from '@/lib/framework';

type McpServer = McpServerListResponse['servers'][number];

export interface McpServersListProps {
  mcpServers: McpServer[];
  isLoading: boolean;
  search?: string;
}

function McpServerRow({ server }: { server: McpServer }) {
  const { paths, Link } = useLinkComponent();
  const client = useMastraClient();
  const baseUrl = client.options.baseUrl;
  const sseUrl = baseUrl ? `${baseUrl}/api/mcp/${server.id}/sse` : '';

  const { data: tools } = useMCPServerTools(server);
  const toolsList = Object.values(tools || {});
  const toolsCount = toolsList.length;
  const agentToolsCount = toolsList.filter(t => t.toolType === 'agent').length;
  const workflowToolsCount = toolsList.filter(t => t.toolType === 'workflow').length;

  const name = truncateString(server.name, 50);

  return (
    <EntityList.RowLink to={paths.mcpServerLink(server.id)} LinkComponent={Link}>
      <EntityList.NameCell>{name}</EntityList.NameCell>
      <EntityList.DescriptionCell>{sseUrl}</EntityList.DescriptionCell>
      <EntityList.TextCell className="text-center">{agentToolsCount || ''}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">{toolsCount || ''}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">{workflowToolsCount || ''}</EntityList.TextCell>
    </EntityList.RowLink>
  );
}

export function McpServersList({ mcpServers, isLoading, search = '' }: McpServersListProps) {
  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return mcpServers.filter(
      server => server.name?.toLowerCase().includes(term) || server.id?.toLowerCase().includes(term),
    );
  }, [mcpServers, search]);

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>URL</EntityList.TopCell>
        <EntityList.TopCellSmart long="Agents" short={<AgentIcon />} tooltip="Agent Tools" className="text-center" />
        <EntityList.TopCellSmart long="Tools" short={<ToolsIcon />} tooltip="Tools" className="text-center" />
        <EntityList.TopCellSmart
          long="Workflows"
          short={<WorkflowIcon />}
          tooltip="Workflow Tools"
          className="text-center"
        />
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No MCP Servers match your search" /> : null}

      {filteredData.map(server => (
        <McpServerRow key={server.id} server={server} />
      ))}
    </EntityList>
  );
}
