import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { ItemList } from '@/ds/components/ItemList';
import { ItemListSkeleton } from '@/ds/components/ItemList/item-list-skeleton';
import { type ItemListColumn } from '@/ds/components/ItemList/types';
import { Fragment, useMemo, useState } from 'react';
import { useLinkComponent } from '@/lib/framework';
import { ListSearch } from '@/ds/components/ListSearch';
import { Column } from '@/ds/components/Columns';
import { Chip } from '@/index';
import { NoProcessorsInfo } from './no-processors-info';
import type { ProcessorInfo } from '../../hooks/use-processors';
import { ChevronRight, ChevronRightIcon, MoveRightIcon } from 'lucide-react';

const phaseLabels: Record<string, string> = {
  input: 'Input',
  inputStep: 'Input Step',
  outputStream: 'Output Stream',
  outputResult: 'Output Result',
  outputStep: 'Output Step',
};

const columns: ItemListColumn[] = [
  { name: 'name', label: 'Name & Description', size: '1fr' },
  { name: 'agents', label: 'Agents', size: '8rem' },
];

export interface ProcessorListProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  error?: Error | null;
}

export function ProcessorList({ processors, isLoading, error }: ProcessorListProps) {
  const [search, setSearch] = useState('');
  const { navigate, paths } = useLinkComponent();

  const processorData = useMemo(() => {
    return Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0);
  }, [processors]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return processorData.filter(p => {
      const id = p.id.toLowerCase();
      const name = (p.name || '').toLowerCase();
      return id.includes(term) || name.includes(term);
    });
  }, [processorData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="processors" />;
  }

  if (processorData.length === 0 && !isLoading) {
    return <NoProcessorsInfo />;
  }

  return (
    <Column>
      <Column.Toolbar>
        <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
      </Column.Toolbar>

      <Column.Content>
        {isLoading ? (
          <ItemListSkeleton columns={columns} />
        ) : (
          <ItemList>
            <ItemList.Items>
              {filteredData.map(processor => {
                const agentsCount = processor.agentIds?.length || 0;

                return (
                  <ItemList.Row key={processor.id} className="min-h-[5.875rem]">
                    <ItemList.RowButton
                      columns={columns}
                      item={{ id: processor.id }}
                      onClick={() => {
                        if (processor.isWorkflow) {
                          navigate(paths.workflowLink(processor.id) + '/graph');
                        } else {
                          navigate(paths.processorLink(processor.id));
                        }
                      }}
                      className="min-h-16"
                    >
                      <ItemList.TextCell className="grid gap-1">
                        <span className="text-neutral4 text-ui-md truncate">{processor.name || processor.id}</span>
                        {processor.description && (
                          <span className="text-neutral2 text-ui-md truncate">{processor.description}</span>
                        )}
                        <div className="flex items-center gap-x-2 flex-wrap text-neutral2 text-ui-sm">
                          <span className="uppercase font-normal text-neutral1 flex items-baseline gap-x-2">
                            <b className="font-bold text-neutral2">{processor.phases.length || 0}</b>{' '}
                            {processor.phases.length === 1 ? 'Phase' : 'Phases'}:
                          </span>
                          {processor.phases.map(phase => (
                            <Fragment key={phase}>
                              <ChevronRightIcon className="w-[1.2em] h-[1.2em] opacity-75 " />
                              <span>{phaseLabels[phase] || phase}</span>
                            </Fragment>
                          ))}
                        </div>
                      </ItemList.TextCell>
                      <ItemList.Cell className="text-neutral2 text-ui-sm flex gap-2 items-center">
                        {agentsCount > 0 && (
                          <span>
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
