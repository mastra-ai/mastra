import type { McpServerListResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMemo } from 'react';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';
import { NoMCPServersInfo } from './no-mcp-servers-info';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useLinkComponent } from '@/lib/framework';
import { is403ForbiddenError } from '@/lib/query-utils';
import { truncateString } from '@/lib/truncate-string';

type McpServer = McpServerListResponse['servers'][number];

export interface McpServersListProps {
  mcpServers: McpServer[];
  isLoading: boolean;
  error?: Error | null;
  search?: string;
}

function McpServerRow({ server }: { server: McpServer }) {
  const { paths } = useLinkComponent();
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
    <EntityList.RowLink to={paths.mcpServerLink(server.id)}>
      <EntityList.NameCell>{name}</EntityList.NameCell>
      <EntityList.DescriptionCell>{sseUrl}</EntityList.DescriptionCell>
      <EntityList.TextCell className="text-center">{agentToolsCount || ''}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">{toolsCount || ''}</EntityList.TextCell>
      <EntityList.TextCell className="text-center">{workflowToolsCount || ''}</EntityList.TextCell>
    </EntityList.RowLink>
  );
}

export function McpServersList({ mcpServers, isLoading, error, search = '' }: McpServersListProps) {
  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return mcpServers.filter(
      server => server.name?.toLowerCase().includes(term) || server.id?.toLowerCase().includes(term),
    );
  }, [mcpServers, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="MCP servers" />;
  }

  if (error) {
    return <ErrorState title="Failed to load MCP servers" message={error.message} />;
  }

  if (mcpServers.length === 0 && !isLoading) {
    return <NoMCPServersInfo />;
  }

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
