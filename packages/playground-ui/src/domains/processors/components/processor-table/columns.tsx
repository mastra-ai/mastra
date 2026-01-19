import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useLinkComponent } from '@/lib/framework';
import type { ProcessorRow } from './processor-table';

export type NameCellProps = { row: Row<ProcessorRow> };
export type PhasesCellProps = { row: Row<ProcessorRow> };
export type AgentsCellProps = { row: Row<ProcessorRow> };

const NameCell = ({ row }: NameCellProps) => {
  const { Link, paths } = useLinkComponent();
  const processor = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.processorLink(processor.id)}>
          {processor.name || processor.id}
        </Link>
      }
      description={processor.description}
    />
  );
};

const PhasesCell = ({ row }: PhasesCellProps) => {
  const processor = row.original;
  const phases = processor.phases || [];

  const phaseLabels: Record<string, string> = {
    input: 'Input',
    inputStep: 'Input Step',
    outputStream: 'Output Stream',
    outputResult: 'Output Result',
    outputStep: 'Output Step',
  };

  return (
    <Cell>
      <div className="flex flex-wrap gap-1">
        {phases.map(phase => (
          <Badge key={phase} variant="default">
            {phaseLabels[phase] || phase}
          </Badge>
        ))}
      </div>
    </Cell>
  );
};

const AgentsCell = ({ row }: AgentsCellProps) => {
  const processor = row.original;
  const agentsCount = processor.agentIds?.length || 0;

  return (
    <Cell>
      <Badge variant="default" icon={<AgentIcon className="text-accent1" />}>
        {agentsCount} agent{agentsCount !== 1 ? 's' : ''}
      </Badge>
    </Cell>
  );
};

export const columns: ColumnDef<ProcessorRow>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Phases',
    accessorKey: 'phases',
    cell: PhasesCell,
  },
  {
    header: 'Used by',
    accessorKey: 'agentIds',
    cell: AgentsCell,
  },
];
