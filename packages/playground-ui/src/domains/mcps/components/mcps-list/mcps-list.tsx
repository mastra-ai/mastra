import type { McpServerListResponse } from '@mastra/client-js';
import { EntityList } from '@/ds/components/EntityList';
import { Spinner } from '@/ds/components/Spinner';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { ToolsIcon, WorkflowIcon, McpServerIcon } from '@/ds/icons';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';
import { useMastraClient } from '@mastra/react';
import { useMemo, useState } from 'react';

type McpServer = McpServerListResponse['servers'][number];

export interface McpServersListProps {
  mcpServers: McpServer[];
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  onSearch?: (search: string) => void;
}

function McpServerRow({ server }: { server: McpServer }) {
  const { paths } = useLinkComponent();
  const client = useMastraClient();
  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/sse`;

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

export function McpServersList({ mcpServers, isLoading, error, search: externalSearch, onSearch: externalOnSearch }: McpServersListProps) {
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return mcpServers.filter(
      server => server.name?.toLowerCase().includes(term) || server.id?.toLowerCase().includes(term),
    );
  }, [mcpServers, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="MCP servers" />;
  }

  if (mcpServers.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<McpServerIcon className="h-8 w-8" />}
          titleSlot="No MCP Servers"
          descriptionSlot="MCP servers are not configured yet. You can find more information in the documentation."
          actionSlot={
            <Button as="a" href="https://mastra.ai/en/docs/tools-mcp/mcp-overview" target="_blank">
              <McpServerIcon />
              Docs
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <EntityList columns="auto 1fr auto auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>URL</EntityList.TopCell>
        <EntityList.TopCellSmart label="Agents" icon={<AgentIcon />} tooltip="Agent Tools" className="text-center" />
        <EntityList.TopCellSmart label="Tools" icon={<ToolsIcon />} tooltip="Tools" className="text-center" />
        <EntityList.TopCellSmart label="Workflows" icon={<WorkflowIcon />} tooltip="Workflow Tools" className="text-center" />
      </EntityList.Top>

      {filteredData.map(server => (
        <McpServerRow key={server.id} server={server} />
      ))}
    </EntityList>
  );
}
