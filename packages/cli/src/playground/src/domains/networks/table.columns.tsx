import { AgentIcon, Badge, Cell, DataTableProps, EntryCell } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { Users, Brain } from 'lucide-react';

type NetworksTableDataProps = {
  id: string;
  name: string;
  instructions: string;
  agentsSize: number;
  routingModel: string;
  workflowsSize?: number;
  isVNext?: boolean;
};

export const networksTableColumns: DataTableProps<NetworksTableDataProps, unknown>['columns'] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <EntryCell
        icon={<AgentIcon />}
        name={
          <Link
            className="w-full space-y-0"
            to={`/networks${row.original.isVNext ? '/v-next' : ''}/${row.original.id}/chat`}
          >
            {row.original.name}
          </Link>
        }
        description={row.original.instructions}
      ></EntryCell>
    ),
    meta: {
      width: 'auto',
    },
  },
  {
    id: 'agents',
    header: 'Agents',
    cell: ({ row }) => (
      <Cell>
        <Badge icon={<Users />}>{row.original.agentsSize}</Badge>
      </Cell>
    ),
  },
  {
    id: 'workflows',
    header: 'Workflows',
    cell: ({ row }) => (
      <Cell>
        <Badge icon={<Users />}>{row.original.workflowsSize}</Badge>
      </Cell>
    ),
  },
  {
    id: 'model',
    header: 'Routing Models',
    cell: ({ row }) => (
      <Cell>
        <Badge variant="default" icon={<Brain />}>
          {row.original.routingModel}
        </Badge>
        {row.original.isVNext ? <Badge className="!text-accent1 ml-2">vNext</Badge> : null}
      </Cell>
    ),
  },
];
