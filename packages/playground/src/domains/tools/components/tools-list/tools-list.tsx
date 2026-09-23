import type { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { useMemo } from 'react';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
import type { ToolWithAgents } from '@/domains/tools/utils/prepareToolsTable';
import { useLinkComponent } from '@/lib/framework';

export type ToolsSortKey = 'name' | 'agents';
export type ToolsSort = ListSort<ToolsSortKey>;

export interface ToolsListProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  search?: string;
  sort?: ToolsSort;
  onSortChange?: (direction: DataListSort, key: ToolsSortKey) => void;
}

const sortAccessors = {
  name: (tool: ToolWithAgents) => tool.id,
  agents: (tool: ToolWithAgents) => tool.agents.length,
};

export function ToolsList({ tools, agents, isLoading, search = '', sort, onSortChange }: ToolsListProps) {
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
    return <EntityListSkeleton columns="auto 1fr auto" />;
  }

  const sortFor = (key: ToolsSortKey) => (sort?.key === key ? sort.direction : undefined);

  return (
    <EntityList columns="auto 1fr auto" scrollRef={containerRef}>
      <EntityList.Top>
        {onSortChange ? (
          <EntityList.SortableTopCell sortKey="name" sort={sortFor('name')} onSortChange={onSortChange}>
            Name
          </EntityList.SortableTopCell>
        ) : (
          <EntityList.TopCell>Name</EntityList.TopCell>
        )}
        <EntityList.TopCell>Description</EntityList.TopCell>
        {onSortChange ? (
          <EntityList.SortableTopCell sortKey="agents" sort={sortFor('agents')} onSortChange={onSortChange} align="end">
            Agents
          </EntityList.SortableTopCell>
        ) : (
          <EntityList.TopCellSmart
            long="Agents"
            short={<AgentIcon />}
            tooltip="Attached Agents"
            className="text-center"
          />
        )}
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Tools match your search" /> : null}

      {filteredData.map((tool, index) => {
        const name = truncateString(tool.id, 50);
        const description = truncateString(tool.description ?? '', 200);
        const agentsCount = tool.agents.length;

        return (
          <EntityList.RowLink key={tool.id} to={paths.toolLink(tool.id)} LinkComponent={Link} {...getRowProps(index)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
