import { EntryCell } from '@/ds/components/Table';

import { ColumnDef, Row } from '@tanstack/react-table';

import { useLinkComponent } from '@/lib/framework';
import { ScorerTableData } from './types';
import { GaugeIcon } from 'lucide-react';

const NameCell = ({ row }: { row: Row<ScorerTableData> }) => {
  const { Link } = useLinkComponent();

  return (
    <EntryCell
      icon={<GaugeIcon />}
      name={
        <Link className="w-full space-y-0" href={row.original.id}>
          {row.original.name}
        </Link>
      }
      description={row.original.description}
    />
  );
};

export const columns: ColumnDef<ScorerTableData>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
];
