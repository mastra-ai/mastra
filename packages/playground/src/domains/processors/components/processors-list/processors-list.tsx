import { EntityList, EntityListSkeleton, truncateString } from '@mastra/playground-ui';
import { CheckIcon, FileInput, FileOutput } from 'lucide-react';
import { useMemo } from 'react';
import type { ProcessorInfo, ProcessorPhase } from '../../hooks/use-processors';
import { useLinkComponent } from '@/lib/framework';

const phaseKeys: ProcessorPhase[] = ['input', 'inputStep', 'outputStep', 'outputStream', 'outputResult'];

export interface ProcessorsListProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  search?: string;
}

export function ProcessorsList({ processors, isLoading, search = '' }: ProcessorsListProps) {
  const { paths, Link } = useLinkComponent();

  const processorData = useMemo(
    () => Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0),
    [processors],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return processorData.filter(p => p.id.toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term));
  }, [processorData, search]);

  if (isLoading) {
    return <EntityListSkeleton columns="auto 1fr auto auto auto auto auto auto" />;
  }

  return (
    <EntityList columns="auto 1fr auto auto auto auto auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
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
        <EntityList.TopCellSmart short="Used by" long="Used by Agents" className="text-center" />
      </EntityList.Top>

      {filteredData.length === 0 && search ? <EntityList.NoMatch message="No Processors match your search" /> : null}

      {filteredData.map(processor => {
        const name = truncateString(processor.name || processor.id, 50);
        const description = truncateString(processor.description ?? '', 200);
        const agentsCount = processor.agentIds?.length ?? 0;
        const phaseSet = new Set(processor.phases || []);

        const linkTo = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);

        return (
          <EntityList.RowLink key={processor.id} to={linkTo} LinkComponent={Link}>
            <EntityList.NameCell>{name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
            {phaseKeys.map(key => (
              <EntityList.TextCell key={key} className="text-center">
                {phaseSet.has(key) && <CheckIcon className="size-4 mx-auto" />}
              </EntityList.TextCell>
            ))}
            <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
