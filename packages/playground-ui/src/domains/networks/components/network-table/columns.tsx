import { AgentIcon } from '@/ds/icons/AgentIcon';
import { Badge } from '@/ds/components/Badge';

import { EntryCell, Cell } from '@/ds/components/Table/Cells';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { useLinkComponent } from '@/lib/framework';
import { Users, Brain } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { NetworkTableColumn } from './types';

export const columns: ColumnDef<NetworkTableColumn>[] = [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { Link } = useLinkComponent();

      return (
        <EntryCell
          icon={<AgentIcon />}
          name={
            <Link className="w-full space-y-0" href={`/networks/v-next/${row.original.id}/chat`}>
              {row.original.name}
            </Link>
          }
          description={row.original.instructions}
        />
      );
    },
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
        <Badge icon={<WorkflowIcon />}>{row.original.workflowsSize}</Badge>
      </Cell>
    ),
  },
  {
    id: 'tools',
    header: 'Tools',
    cell: ({ row }) => (
      <Cell>
        <Badge icon={<ToolsIcon />}>{row.original.toolsSize}</Badge>
      </Cell>
    ),
  },
  {
    id: 'model',
    header: 'Routing Models',
    cell: ({ row }) => (
      <Cell className="truncate">
        <Badge variant="default" icon={<Brain />}>
          {row.original.routingModel}
        </Badge>
      </Cell>
    ),
  },
];
