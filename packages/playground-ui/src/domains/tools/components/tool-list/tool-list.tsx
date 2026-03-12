import { GetAgentResponse, GetToolResponse } from '@mastra/client-js';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { ErrorState } from '@/ds/components/ErrorState';
import { is403ForbiddenError } from '@/lib/query-utils';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { Chip } from '@/index';
import { prepareToolsTable } from '@/domains/tools/utils/prepareToolsTable';
import { NoToolsInfo } from './no-tools-info';

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'agents', label: 'Agents', size: '8rem' },
];

export interface ToolListProps {
  tools: Record<string, GetToolResponse>;
  agents: Record<string, GetAgentResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function ToolList({ tools, agents, isLoading, error }: ToolListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const toolData = useMemo(() => prepareToolsTable(tools, agents), [tools, agents]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return toolData.filter(
      tool => tool.id.toLowerCase().includes(term) || tool.description?.toLowerCase().includes(term),
    );
  }, [toolData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="tools" />;
  }

  if (error) {
    return <ErrorState title="Failed to load tools" message={error.message} />;
  }

  if (toolData.length === 0 && !isLoading) {
    return <NoToolsInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter tools" placeholder="Filter by name or description" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(tool => {
                const agentsCount = tool.agents.length;

                return (
                  <ItemList.Row key={tool.id}>
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: tool.id }}
                      onClick={() => navigate(paths.toolLink(tool.id))}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid">
                        <span className="text-neutral4 text-ui-md truncate">{tool.id}</span>
                        {tool.description && (
                          <span className="text-neutral2 text-ui-md truncate">{tool.description}</span>
                        )}
                      </ItemList.TextCell>
                      <ItemList.Cell className="text-neutral2 text-ui-sm flex gap-2 items-center">
                        {agentsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Chip>{agentsCount}</Chip> agent{agentsCount !== 1 ? 's' : ''}
                          </span>
                        )}
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
