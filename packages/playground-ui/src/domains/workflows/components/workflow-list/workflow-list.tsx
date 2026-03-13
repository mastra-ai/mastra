import { GetWorkflowResponse } from '@mastra/client-js';
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
import { NoWorkflowInfo } from './no-workflow-info';

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'steps', label: 'Steps', size: '120px' },
];

export interface WorkflowListProps {
  workflows: Record<string, GetWorkflowResponse>;
  isLoading: boolean;
  error?: Error | null;
}

export function WorkflowList({ workflows, isLoading, error }: WorkflowListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const workflowData = useMemo(() => {
    return Object.keys(workflows ?? {}).map(key => ({
      id: key,
      ...workflows[key as keyof typeof workflows],
    }));
  }, [workflows]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return workflowData.filter(
      workflow => workflow.name.toLowerCase().includes(term) || workflow.description?.toLowerCase().includes(term),
    );
  }, [workflowData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="workflows" />;
  }

  if (error) {
    return <ErrorState title="Failed to load workflows" message={error.message} />;
  }

  if (workflowData.length === 0 && !isLoading) {
    return <NoWorkflowInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter workflows" placeholder="Filter by name or description" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(workflow => {
                const stepsCount = Object.keys(workflow.steps ?? {}).length;

                return (
                  <ItemList.Row key={workflow.id}>
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: workflow.id }}
                      onClick={() => navigate(paths.workflowLink(workflow.id))}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid">
                        <span className="text-neutral4 text-ui-md truncate">{workflow.name}</span>
                        {workflow.description && (
                          <span className="text-neutral2 text-ui-md truncate">{workflow.description}</span>
                        )}
                      </ItemList.TextCell>
                      <ItemList.Cell className="text-neutral2 text-ui-sm flex gap-2 items-center">
                        <Chip>{stepsCount}</Chip> step{stepsCount !== 1 ? 's' : ''}
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
