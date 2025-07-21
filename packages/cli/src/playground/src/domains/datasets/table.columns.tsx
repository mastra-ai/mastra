import { DataTableProps, AgentIcon, EntryCell } from '@mastra/playground-ui';
import { Link } from 'react-router';

const ScorerNameCell = ({ row }: { row: any }) => {
  return (
    <EntryCell
      icon={<AgentIcon />}
      name={
        <Link className="w-full space-y-0" to={`/datasets/${row.original.id}`}>
          {row.original.name}
        </Link>
      }
      description={row.original.instructions}
    />
  );
};

export const datasetsTableColumns: DataTableProps<any, any>['columns'] = [
  {
    id: 'name',
    header: 'Name',
    cell: ScorerNameCell,
  },
];
