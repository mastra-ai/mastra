import { EntryCell } from '@/ds/components/Table';

import { ColumnDef, Row } from '@tanstack/react-table';

import { useLinkComponent } from '@/lib/framework';
import { ScorerTableData } from './types';

const NameCell = ({ row }: { row: Row<ScorerTableData> }) => {
  const { Link, paths } = useLinkComponent();

  const scorer = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.scorerLink(scorer.id)}>
          {scorer.scorer.config.name}
        </Link>
      }
      description={scorer.scorer.config.description}
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
