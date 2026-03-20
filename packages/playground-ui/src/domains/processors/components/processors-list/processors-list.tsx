import { EntityList } from '@/ds/components/EntityList';
import { EntityListSkeleton } from '@/ds/components/EntityList';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMemo, useState } from 'react';
import { CheckIcon, Cpu, FileInput, FileOutput } from 'lucide-react';
import type { ProcessorInfo, ProcessorPhase } from '../../hooks/use-processors';

const phaseKeys: ProcessorPhase[] = ['input', 'inputStep', 'outputStep', 'outputStream', 'outputResult'];

export interface ProcessorsListProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  onSearch?: (search: string) => void;
}

export function ProcessorsList({ processors, isLoading, error, search: externalSearch }: ProcessorsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const processorData = useMemo(
    () => Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0),
    [processors],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return processorData.filter(p => p.id.toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term));
  }, [processorData, search]);

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="processors" />;
  }

  if (processorData.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<Cpu />}
          titleSlot="Configure Processors"
          descriptionSlot="No processors are configured yet. Add input or output processors to your agents to transform messages."
          actionSlot={
            <Button
              size="lg"
              className="w-full"
              variant="light"
              as="a"
              href="https://mastra.ai/docs/agents/processors"
              target="_blank"
            >
              <Icon>
                <Cpu />
              </Icon>
              Docs
            </Button>
          }
        />
      </div>
    );
  }

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

      {filteredData.map(processor => {
        const name = truncateString(processor.name || processor.id, 50);
        const description = truncateString(processor.description ?? '', 200);
        const agentsCount = processor.agentIds?.length ?? 0;
        const phaseSet = new Set(processor.phases || []);

        const linkTo = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);

        return (
          <EntityList.RowLink key={processor.id} to={linkTo}>
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
