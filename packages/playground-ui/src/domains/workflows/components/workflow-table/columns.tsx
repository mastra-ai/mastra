import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';

import { ColumnDef } from '@tanstack/react-table';
import { useLinkComponent } from '@/lib/framework';
import { Footprints, Code, Database, Cpu, Pencil } from 'lucide-react';
import { WorkflowTableData, WorkflowType } from './types';

const typeConfig: Record<WorkflowType, { icon: React.ReactNode; label: string; className: string }> = {
  code: {
    icon: <Code className="h-3 w-3" />,
    label: 'Code',
    className: '!h-badge-sm',
  },
  stored: {
    icon: <Database className="h-3 w-3" />,
    label: 'Stored',
    className: '!h-badge-sm bg-blue-500/20 text-blue-400',
  },
  processor: {
    icon: <Cpu className="h-3 w-3" />,
    label: 'Processor',
    className: '!h-badge-sm bg-violet-500/20 text-violet-400',
  },
};

export const columns: ColumnDef<WorkflowTableData>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { Link, paths } = useLinkComponent();

      return (
        <EntryCell
          name={
            <div className="flex items-center gap-2">
              <Link href={paths.workflowLink(row.original.id)}>{row.original.name}</Link>
            </div>
          }
          description={undefined}
          meta={undefined}
        />
      );
    },
    meta: {
      width: 'auto',
    },
  },
  {
    id: 'type',
    header: 'Type',
    size: 130,
    cell: ({ row }) => {
      const workflowType = row.original.workflowType || 'code';
      const config = typeConfig[workflowType];
      return (
        <Cell>
          <Badge icon={config.icon} className={config.className}>
            {config.label}
          </Badge>
        </Cell>
      );
    },
  },
  {
    id: 'stepsCount',
    header: 'Steps',
    size: 120,
    cell: ({ row }) => {
      const workflow = row.original;
      const stepsCount = Object.keys(workflow.steps ?? {}).length;
      return (
        <Cell>
          <div className="flex justify-end items-center gap-2">
            <Badge icon={<Footprints />} className="!h-button-md">
              {stepsCount} step{stepsCount > 1 ? 's' : ''}
            </Badge>
          </div>
        </Cell>
      );
    },
  },
  {
    id: 'actions',
    header: '',
    size: 80,
    cell: ({ row }) => {
      const { Link, paths } = useLinkComponent();
      const isStored = row.original.workflowType === 'stored';

      if (!isStored) {
        return (
          <Cell>
            <span />
          </Cell>
        );
      }

      return (
        <Cell>
          <Link
            href={paths.workflowEditLink(row.original.id)}
            className="inline-flex items-center gap-1 text-xs text-icon3 hover:text-icon6 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Link>
        </Cell>
      );
    },
  },
];
