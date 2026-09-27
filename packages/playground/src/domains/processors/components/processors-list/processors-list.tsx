import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
  useDataListKeyboard,
} from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { truncateString } from '@mastra/playground-ui/utils/truncate-string';
import { CheckIcon, FileInput, FileOutput } from 'lucide-react';
import { useMemo } from 'react';
import type { ProcessorInfo, ProcessorPhase } from '../../hooks/use-processors';

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
    return <EntityListSkeleton columns="auto 1fr auto auto auto auto auto auto" />;
  }

  const sortFor = (key: ProcessorsSortKey) => (sort?.key === key ? sort.direction : undefined);

  return (
    <EntityList columns="auto 1fr auto auto auto auto auto auto" scrollRef={containerRef}>
      <EntityList.Top>
        {onSortChange ? (
          <EntityList.SortableTopCell sortKey="name" sort={sortFor('name')} onSortChange={onSortChange}>
            Name
          </EntityList.SortableTopCell>
        ) : (
          <EntityList.TopCell>Name</EntityList.TopCell>
        )}
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCellSmart long="Input" short="Input" tooltip="Contains Input phase" className="text-center" />
        <EntityList.TopCellSmart
          long="Input Step"
          short={
            <>
              <FileInput /> Step
            </>
          }
          tooltip="Contains Input Step phase"
          className="text-center"
        />
        <EntityList.TopCellSmart
          long="Output Step"
          short={
            <>
              <FileOutput /> Step
            </>
          }
          tooltip="Contains Output Step phase"
          className="text-center"
        />
        <EntityList.TopCellSmart
          long="Output Stream"
          short={
            <>
              <FileOutput /> Stream
            </>
          }
          tooltip="Contains Output Stream phase"
          className="text-center"
        />
        <EntityList.TopCellSmart
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
          <EntityList.SortableTopCell sortKey="agents" sort={sortFor('agents')} onSortChange={onSortChange} align="end">
            Used by
          </EntityList.SortableTopCell>
        ) : (
          <EntityList.TopCellSmart short="Used by" long="Used by Agents" className="text-center" />
        )}
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Processors match your search" /> : null}

      {filteredData.map((processor, index) => {
        const name = truncateString(processor.name || processor.id, 50);
        const description = truncateString(processor.description ?? '', 200);
        const agentsCount = processor.agentIds?.length ?? 0;
        const phaseSet = new Set(processor.phases || []);

        const linkTo = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);

        return (
          <EntityList.RowLink key={processor.id} to={linkTo} LinkComponent={Link} {...getRowProps(index)}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            {phaseKeys.map(key => (
              <EntityList.TextCell key={key} className="text-center">
                {phaseSet.has(key) && <CheckIcon className="mx-auto size-4" />}
              </EntityList.TextCell>
            ))}
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
