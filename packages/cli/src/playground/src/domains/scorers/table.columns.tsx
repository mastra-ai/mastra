import { DataTableProps, EntryCell } from '@mastra/playground-ui';
import { GaugeIcon } from 'lucide-react';
import { Link } from 'react-router';

const ScorerNameCell = ({ row }: { row: any }) => {
  return (
    <EntryCell
      icon={<GaugeIcon />}
      name={
        <Link className="w-full space-y-0" to={`/scorers/${row.original.id}`}>
          {row.original.name}
        </Link>
      }
      description={row.original.instructions}
    />
  );
};

export const scorersTableColumns: DataTableProps<any, any>['columns'] = [
  {
    id: 'name',
    header: 'Name',
    cell: ScorerNameCell,
  },
];
