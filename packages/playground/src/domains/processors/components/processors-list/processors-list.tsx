import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import type { ProcessorInfo, ProcessorPhase } from '@mastra/react/hooks/processors';
import { CheckIcon, FileInput, FileOutput } from 'lucide-react';
import { useMemo } from 'react';

const phaseKeys: ProcessorPhase[] = ['input', 'inputStep', 'outputStep', 'outputStream', 'outputResult'];

export type ProcessorsSortKey = 'name' | 'agents';
export type ProcessorsSort = ListSort<ProcessorsSortKey>;

export interface ProcessorsListProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  search?: string;
  sort?: ProcessorsSort;
  onSortChange?: (direction: DataListSort, key: ProcessorsSortKey) => void;
}

const sortAccessors = {
  name: (processor: ProcessorInfo) => processor.name || processor.id,
  agents: (processor: ProcessorInfo) => processor.agentIds?.length ?? 0,
};

export function ProcessorsList({ processors, isLoading, search = '', sort, onSortChange }: ProcessorsListProps) {
  const { paths, Link } = useLinkComponent();

  const processorData = useMemo(
    () => Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0),
    [processors],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return sortBy(
      processorData.filter(p => p.id.toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term)),
      sort,
      sortAccessors,
    );
  }, [processorData, search, sort]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filteredData.length, global: true });

  if (isLoading) {
    return <DataListSkeleton scroll="page" columns="auto 1fr auto auto auto auto auto auto" />;
  }

  const sortFor = (key: ProcessorsSortKey) => (sort?.key === key ? sort.direction : undefined);

  return (
    <DataList scroll="page" columns="auto 1fr auto auto auto auto auto auto" scrollRef={containerRef}>
      <DataList.Top>
        {onSortChange ? (
          <DataList.SortableTopCell sortKey="name" sort={sortFor('name')} onSortChange={onSortChange}>
            Name
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCell>Name</DataList.TopCell>
        )}
        <DataList.TopCell>Description</DataList.TopCell>
        <DataList.TopCellSmart long="Input" short="Input" tooltip="Contains Input phase" className="text-center" />
        <DataList.TopCellSmart
          long="Input Step"
          short={
            <>
              <FileInput /> Step
            </>
          }
          tooltip="Contains Input Step phase"
          className="text-center"
        />
        <DataList.TopCellSmart
          long="Output Step"
          short={
            <>
              <FileOutput /> Step
            </>
          }
          tooltip="Contains Output Step phase"
          className="text-center"
        />
        <DataList.TopCellSmart
          long="Output Stream"
          short={
            <>
              <FileOutput /> Stream
            </>
          }
          tooltip="Contains Output Stream phase"
          className="text-center"
        />
        <DataList.TopCellSmart
          long="Output Result"
          short={
            <>
              <FileOutput /> Result
            </>
          }
          tooltip="Contains Output Result phase"
          className="text-center"
        />
        {onSortChange ? (
          <DataList.SortableTopCell sortKey="agents" sort={sortFor('agents')} onSortChange={onSortChange} align="end">
            Used by
          </DataList.SortableTopCell>
        ) : (
          <DataList.TopCellSmart short="Used by" long="Used by Agents" className="text-center" />
        )}
      </DataList.Top>

      {filteredData.length === 0 && search ? <DataList.NoMatch message="No Processors match your search" /> : null}

      {filteredData.map((processor, index) => {
        const name = truncateString(processor.name || processor.id, 50);
        const description = truncateString(processor.description ?? '', 200);
        const agentsCount = processor.agentIds?.length ?? 0;
        const phaseSet = new Set(processor.phases || []);

        const linkTo = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);

        return (
          <DataList.RowLink key={processor.id} to={linkTo} LinkComponent={Link} {...getRowProps(index)}>
            <DataList.NameCell>{name}</DataList.NameCell>
            <DataList.DescriptionCell>{description}</DataList.DescriptionCell>
            {phaseKeys.map(key => (
              <DataList.TextCell key={key} className="text-center">
                {phaseSet.has(key) && <CheckIcon className="mx-auto size-4" />}
              </DataList.TextCell>
            ))}
            <DataList.TextCell className="text-center">{agentsCount || ''}</DataList.TextCell>
          </DataList.RowLink>
        );
      })}
    </DataList>
  );
}
