import { Badge, Cell, EntryCell, WorkflowIcon } from '@mastra/playground-ui';
import { Footprints } from 'lucide-react';
import { Link } from 'react-router';

type ColumnDef<T> = {
  id: string;
  header: string;
  cell: (props: { row: { original: T } }) => React.ReactNode;
  meta?: {
    width?: string;
  };
  size?: number;
};

export const workflowsTableColumns: ColumnDef<{ id: string; name: string; stepsCount: number; isLegacy?: boolean }>[] =
  [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <EntryCell
          icon={<WorkflowIcon />}
          name={
            <Link to={`/workflows${row.original.isLegacy ? '/legacy' : ''}/${row.original.id}/graph`}>
              {row.original.name}
            </Link>
          }
        />
      ),
      meta: {
        width: 'auto',
      },
    },
    {
      id: 'action',
      header: 'Action',
      size: 300,
      cell: ({ row }) => (
        <Cell>
          <div className="flex justify-end items-center gap-2">
            <Badge icon={<Footprints />} className="!h-button-md">
              {row.original.stepsCount} step{row.original.stepsCount > 1 ? 's' : ''}
            </Badge>

            {row.original.isLegacy ? <Badge className="!text-foreground/80 !h-button-md">Legacy</Badge> : null}
          </div>
        </Cell>
      ),
    },
  ];
