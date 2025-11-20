import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';

import { ColumnDef } from '@tanstack/react-table';
import { useLinkComponent } from '@/lib/framework';
import { Footprints } from 'lucide-react';
import { WorkflowTableData } from './types';

export const columns: ColumnDef<WorkflowTableData>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { Link, paths } = useLinkComponent();

      return (
        <EntryCell
          name={<Link href={paths.workflowLink(row.original.id)}>{row.original.name}</Link>}
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
    id: 'stepsCount',
    header: 'Steps',
    size: 300,
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
];
