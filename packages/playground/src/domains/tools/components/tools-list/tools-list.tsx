import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { useMemo } from 'react';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
import type { ToolWithAgents } from '@/domains/tools/utils/prepareToolsTable';

export type ToolsSortKey = 'name' | 'agents';
export type ToolsSort = ListSort<ToolsSortKey>;

export interface ToolsListProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  search?: string;
  sort?: ToolsSort;
  onSortChange?: (direction: DataListSort, key: ToolsSortKey) => void;
  /** The tool open in the drawer, highlighted in the list. */
  selectedToolId?: string;
}

const sortAccessors = {
  name: (tool: ToolWithAgents) => tool.id,
  agents: (tool: ToolWithAgents) => tool.agents.length,
};

export function ToolsList({
  tools,
  agents,
  isLoading,
  search = '',
  sort,
  onSortChange,
  selectedToolId,
}: ToolsListProps) {
  const { paths, Link } = useLinkComponent();

  const toolData = useMemo(() => prepareToolsTable(tools, agents), [tools, agents]);

  const filteredData = useMemo(
    () =>
      sortBy(
        toolData.filter(tool => tool.id.toLowerCase().includes(search.toLowerCase())),
        sort,
        sortAccessors,
      ),
    [toolData, search, sort],
  );

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: true });

  if (isLoading) {
    return <DataListSkeleton columns="auto 1fr auto" />;
  }

  const sortFor = (key: ToolsSortKey) => (sort?.key === key ? sort.direction : undefined);

  return (
    <DataList columns="auto 1fr auto" scrollRef={containerRef}>
      <DataList.Top>
        {onSortChange ? (
          <DataList.SortableTopCell sortKey="name" sort={sortFor('name')} onSortChange={onSortChange}>
            Name
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Name</DataList.TopCell>
        )}
        <DataList.TopCell>Description</DataList.TopCell>
        {onSortChange ? (
          <DataList.SortableTopCell sortKey="agents" sort={sortFor('agents')} onSortChange={onSortChange} align="end">
            Agents
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCellSmart
            long="Agents"
            short={<AgentIcon />}
            tooltip="Attached Agents"
            className="text-center"
          />
        )}
      </DataList.Top>

      {filteredData.length === 0 && search ? <DataList.NoMatch message="No Tools match your search" /> : null}

      {filteredData.map((tool, index) => {
        const name = truncateString(tool.id, 50);
        const description = truncateString(tool.description ?? '', 200);
        const agentsCount = tool.agents.length;

        return (
          <DataList.RowLink
            key={tool.id}
            to={paths.toolLink(tool.id)}
            LinkComponent={Link}
            featured={tool.id === selectedToolId}
            {...getRowProps(index)}
          >
            <DataList.NameCell>{name}</DataList.NameCell>
            <DataList.DescriptionCell>{description}</DataList.DescriptionCell>
            <DataList.TextCell className="text-center">{agentsCount || ''}</DataList.TextCell>
          </DataList.RowLink>
        );
      })}
    </DataList>
  );
}
