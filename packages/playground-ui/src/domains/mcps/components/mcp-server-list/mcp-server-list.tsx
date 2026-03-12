import { McpServerListResponse } from '@mastra/client-js';
import { ServerInfo } from '@mastra/core/mcp';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { ErrorState } from '@/ds/components/ErrorState';
import { is403ForbiddenError } from '@/lib/query-utils';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { Chip } from '@/ds/components/Chip';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon, WorkflowIcon } from '@/ds/icons';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { useMastraClient } from '@mastra/react';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';
import { NoMCPServersInfo } from './no-mcp-servers-info';

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entities', label: 'Entities', size: '10rem' },
];

export interface MCPServerListProps {
  mcpServers: McpServerListResponse['servers'];
  isLoading: boolean;
  error?: Error | null;
}

export function MCPServerList({ mcpServers, isLoading, error }: MCPServerListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();
  const client = useMastraClient();
  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';

  const filteredData = useMemo(
    () => mcpServers.filter(server => server.name.toLowerCase().includes(search.toLowerCase())),
    [mcpServers, search],
  );

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="MCP servers" />;
  }

  if (error) {
    return <ErrorState title="Failed to load MCP servers" message={error.message} />;
  }

  if (mcpServers.length === 0 && !isLoading) {
    return <NoMCPServersInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter MCP servers" placeholder="Filter by name" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(server => {
                const sseUrl = `${effectiveBaseUrl}/api/mcp/${server.id}/sse`;

                return (
                  <ItemList.Row key={server.id}>
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: server.id }}
                      onClick={() => navigate(paths.mcpServerLink(server.id))}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid">
                        <span className="text-neutral4 text-ui-md truncate">{server.name}</span>
                        <span className="text-neutral2 text-ui-md truncate">{sseUrl}</span>
                      </ItemList.TextCell>

                      <ItemList.Cell>
                        <MCPServerEntities server={server} />
                      </ItemList.Cell>
                    </ItemList.RowButton>
                  </ItemList.Row>
                );
              })}
            </ItemList.Items>
          </ItemList>
        )}
      </Column.Content>
    </Column>
  );
}

const MCPServerEntities = ({ server }: { server: ServerInfo }) => {
  const { data: tools, isLoading } = useMCPServerTools(server);

  if (isLoading) {
    return <Skeleton className="h-4 w-16" />;
  }

  const toolEntries = Object.values(tools ?? {});
  const agentsCount = toolEntries.filter(t => t.toolType === 'agent').length;
  const workflowsCount = toolEntries.filter(t => t.toolType === 'workflow').length;
  const toolsCount = toolEntries.length;

  if (toolsCount === 0) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="text-neutral2 text-ui-sm inline-flex gap-1 items-center">
          {agentsCount > 0 && (
            <Chip color="purple" intensity="muted">
              <AgentIcon /> {agentsCount}
            </Chip>
          )}
          {workflowsCount > 0 && (
            <Chip color="blue" intensity="muted">
              <WorkflowIcon /> {workflowsCount}
            </Chip>
          )}
          {toolsCount > 0 && (
            <Chip color="yellow" intensity="muted">
              <ToolsIcon /> {toolsCount}
            </Chip>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-1">
          <strong>Attached Entities</strong>
          {agentsCount > 0 && (
            <span>
              {agentsCount} agent{agentsCount !== 1 ? 's' : ''}
            </span>
          )}
          {workflowsCount > 0 && (
            <span>
              {workflowsCount} workflow{workflowsCount !== 1 ? 's' : ''}
            </span>
          )}
          {toolsCount > 0 && (
            <span>
              {toolsCount} tool{toolsCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
