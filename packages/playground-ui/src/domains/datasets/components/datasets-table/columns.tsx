import { EntryCell } from '@/ds/components/Table';

import { ColumnDef, Row } from '@tanstack/react-table';

import { useLinkComponent } from '@/lib/framework';
import { DatasetsTableData } from './types';

const NameCell = ({ row }: { row: Row<DatasetsTableData> }) => {
  const { Link, paths } = useLinkComponent();

  const dataset = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.datasetLink(dataset.id)}>
          {dataset.name}
        </Link>
      }
      description={dataset.description}
    />
  );
};

export const columns: ColumnDef<DatasetsTableData>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
];
