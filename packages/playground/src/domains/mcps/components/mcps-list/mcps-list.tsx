import type { McpServerListResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { useMastraClient } from '@mastra/react';
import { useMemo } from 'react';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';

type McpServer = McpServerListResponse['servers'][number];

export type McpServersSortKey = 'name';
export type McpServersSort = ListSort<McpServersSortKey>;

export interface McpServersListProps {
  mcpServers: McpServer[];
  isLoading: boolean;
  search?: string;
  sort?: McpServersSort;
  onSortChange?: (direction: DataListSort, key: McpServersSortKey) => void;
}

const sortAccessors = {
  name: (server: McpServer) => server.name || server.id,
};

function McpServerRow({ server, rowProps }: { server: McpServer; rowProps?: Record<string, unknown> }) {
  const { paths, Link } = useLinkComponent();
  const client = useMastraClient();
  const baseUrl = client.options.baseUrl;
  // MCP v2 servers only serve Streamable HTTP; 1.x servers are listed by their SSE endpoint.
  // Servers that predate transport reporting are 1.x, so absence means SSE is available.
  const hasSse = server.transports?.includes('sse') ?? true;
  const transportPath = hasSse ? 'sse' : 'mcp';
  const serverUrl = baseUrl ? `${baseUrl}/api/mcp/${server.id}/${transportPath}` : '';

  const { data: tools } = useMCPServerTools(server);
  const toolsList = Object.values(tools || {});
  const toolsCount = toolsList.length;
  const agentToolsCount = toolsList.filter(t => t.toolType === 'agent').length;
  const workflowToolsCount = toolsList.filter(t => t.toolType === 'workflow').length;

  const name = truncateString(server.name, 50);

  return (
    <DataList.RowLink to={paths.mcpServerLink(server.id)} LinkComponent={Link} {...rowProps}>
      <DataList.NameCell>{name}</DataList.NameCell>
      <DataList.DescriptionCell>{serverUrl}</DataList.DescriptionCell>
      <DataList.TextCell className="text-center">{agentToolsCount || ''}</DataList.TextCell>
      <DataList.TextCell className="text-center">{toolsCount || ''}</DataList.TextCell>
      <DataList.TextCell className="text-center">{workflowToolsCount || ''}</DataList.TextCell>
    </DataList.RowLink>
  );
}

export function McpServersList({ mcpServers, isLoading, search = '', sort, onSortChange }: McpServersListProps) {
  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return sortBy(
      mcpServers.filter(server => server.name?.toLowerCase().includes(term) || server.id?.toLowerCase().includes(term)),
      sort,
      sortAccessors,
    );
  }, [mcpServers, search, sort]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: true });

  if (isLoading) {
    return <DataListSkeleton columns="auto 1fr auto auto auto" />;
  }

  return (
    <DataList columns="auto 1fr auto auto auto" scrollRef={containerRef}>
      <DataList.Top>
        {onSortChange ? (
          <DataList.SortableTopCell
            sortKey="name"
            sort={sort?.key === 'name' ? sort.direction : undefined}
            onSortChange={onSortChange}
          >
            Name
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Name</DataList.TopCell>
        )}
        <DataList.TopCell>URL</DataList.TopCell>
        <DataList.TopCellSmart long="Agents" short={<AgentIcon />} tooltip="Agent Tools" className="text-center" />
        <DataList.TopCellSmart long="Tools" short={<ToolsIcon />} tooltip="Tools" className="text-center" />
        <DataList.TopCellSmart
          long="Workflows"
          short={<WorkflowIcon />}
          tooltip="Workflow Tools"
          className="text-center"
        />
      </DataList.Top>

      {filteredData.length === 0 && search ? <DataList.NoMatch message="No MCP Servers match your search" /> : null}

      {filteredData.map((server, index) => (
        <McpServerRow key={server.id} server={server} rowProps={getRowProps(index)} />
      ))}
    </DataList>
  );
}
