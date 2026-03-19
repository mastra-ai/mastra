import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef } from '@tanstack/react-table';
import type { DatasetRecord } from '@mastra/client-js';

import { useLinkComponent } from '@/lib/framework';

// Column type includes id for row identification
export type DatasetTableColumn = {
  id: string;
} & DatasetRecord;

const NameCell = ({ row }: { row: { original: DatasetTableColumn } }) => {
  const { Link, paths } = useLinkComponent();

  return (
    <EntryCell
      name={
        <Link className="w-full" href={paths.datasetLink(row.original.id)}>
          {row.original.name}
        </Link>
      }
      description={row.original.description || 'No description'}
    />
  );
};

export const columns: ColumnDef<DatasetTableColumn>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: ({ row }) => <NameCell row={row} />,
  },
  {
    header: 'Version',
    accessorKey: 'version',
    cell: ({ row }) => <Cell>v{row.original.version}</Cell>,
    size: 150,
  },
  {
    header: 'Created',
    accessorKey: 'createdAt',
    cell: ({ row }) => (
      <Cell>
        {row.original.createdAt instanceof Date
          ? row.original.createdAt.toLocaleDateString()
          : new Date(row.original.createdAt).toLocaleDateString()}
      </Cell>
    ),
    size: 150,
  },
];
