import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import type { Dataset } from '@mastra/client-js';

import { useLinkComponent } from '@/lib/framework';

export type DatasetRow = Dataset;

const NameCell = ({ row }: { row: Row<DatasetRow> }) => {
  const { Link, paths } = useLinkComponent();
  const dataset = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.datasetLink(dataset.id)}>
          {dataset.name}
        </Link>
      }
      description={dataset.description ?? undefined}
    />
  );
};

const formatDate = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const columns: ColumnDef<DatasetRow>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => {
      const dataset = row.original;
      return <Cell>{formatDate(dataset.createdAt)}</Cell>;
    },
  },
];
