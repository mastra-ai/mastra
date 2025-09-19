import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';

import { ColumnDef } from '@tanstack/react-table';
import { useLinkComponent } from '@/lib/framework';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { Footprints } from 'lucide-react';
import { WorkflowTableData } from './types';

export const columns: ColumnDef<WorkflowTableData>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { Link } = useLinkComponent();

      return (
        <EntryCell
          icon={<WorkflowIcon />}
          name={<Link href={row.original.link}>{row.original.name}</Link>}
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
    cell: ({ row }) => (
      <Cell>
        <div className="flex justify-end items-center gap-2">
          <Badge icon={<Footprints />} className="!h-button-md">
            {row.original.stepsCount} step{row.original.stepsCount > 1 ? 's' : ''}
          </Badge>
        </div>
      </Cell>
    ),
  },
];
