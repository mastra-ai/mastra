import { EntityList } from '@/ds/components/EntityList';
import { Spinner } from '@/ds/components/Spinner';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { is403ForbiddenError } from '@/lib/query-utils';
import { useLinkComponent } from '@/lib/framework';
import { truncateString } from '@/lib/truncate-string';
import { useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
import type { ProcessorInfo } from '../../hooks/use-processors';

const phaseLabels: Record<string, string> = {
  input: 'Input',
  inputStep: 'Input Step',
  outputStream: 'Output Stream',
  outputResult: 'Output Result',
  outputStep: 'Output Step',
};

export interface ProcessorsListProps {
  processors: Record<string, ProcessorInfo>;
  isLoading: boolean;
  error?: Error | null;
  search?: string;
  onSearch?: (search: string) => void;
}

export function ProcessorsList({
  processors,
  isLoading,
  error,
  search: externalSearch,
  onSearch: externalOnSearch,
}: ProcessorsListProps) {
  const { paths } = useLinkComponent();
  const [internalSearch, setInternalSearch] = useState('');
  const search = externalSearch ?? internalSearch;

  const processorData = useMemo(
    () => Object.values(processors ?? {}).filter(p => p.phases && p.phases.length > 0),
    [processors],
  );

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return processorData.filter(
      p => p.id.toLowerCase().includes(term) || (p.name || '').toLowerCase().includes(term),
    );
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
            <Button size="lg" className="w-full" variant="light" as="a" href="https://mastra.ai/docs/agents/processors" target="_blank">
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
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  return (
    <EntityList columns="auto 1fr auto auto">
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Phases</EntityList.TopCell>
        <EntityList.TopCellSmart label="Agents" icon={<AgentIcon />} tooltip="Attached Agents" className="text-center" />
      </EntityList.Top>

      {filteredData.map(processor => {
        const name = truncateString(processor.name || processor.id, 50);
        const description = truncateString(processor.description ?? '', 200);
        const phases = (processor.phases || []).map(p => phaseLabels[p] || p).join(', ');
        const agentsCount = processor.agentIds?.length ?? 0;

        const linkTo = processor.isWorkflow
          ? paths.workflowLink(processor.id) + '/graph'
          : paths.processorLink(processor.id);

        return (
          <EntityList.RowLink key={processor.id} to={linkTo}>
              <EntityList.NameCell>{name}</EntityList.NameCell>
              <EntityList.DescriptionCell>{description}</EntityList.DescriptionCell>
              <EntityList.TextCell>{phases}</EntityList.TextCell>
              <EntityList.TextCell className="text-center">{agentsCount || ''}</EntityList.TextCell>
            </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}
