import { AgentIcon, Badge, Cell, DataTableProps, EntryCell } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { Users, Brain } from 'lucide-react';

const NameCell = ({ row }: { row: any }) => {
  return (
    <EntryCell
      icon={<AgentIcon />}
      name={
        <Link className="w-full space-y-0" to={`/networks/${row.original.id}/chat`}>
          {row.original.name}
        </Link>
      }
      description={row.original.instructions}
    ></EntryCell>
  );
};

export const networksTableColumns: DataTableProps<any, any>['columns'] = [
  {
    id: 'name',
    header: 'Name',
    cell: NameCell,
    meta: {
      width: 'auto',
    },
  },
  {
    id: 'agents',
    header: 'Agents',
    cell: ({ row }: { row: any }) => (
      <Cell>
        <Badge icon={<Users />}>{row.original.agents.length}</Badge>
      </Cell>
    ),
  },
  {
    id: 'model',
    header: 'Routing Models',
    cell: ({ row }: { row: any }) => (
      <Cell>
        <Badge variant="default" icon={<Brain />}>
          {row.original.routingModel.modelId}
        </Badge>
      </Cell>
    ),
  },
];
