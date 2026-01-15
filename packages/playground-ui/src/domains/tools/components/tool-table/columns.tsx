import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { CodeIcon } from 'lucide-react';
import { ToolCoinIcon } from '@/ds/icons/ToolCoinIcon';

import { ToolWithAgents } from '../../utils/prepareToolsTable';
import { useLinkComponent } from '@/lib/framework';

const NameCell = ({ row }: { row: Row<ToolWithAgents> }) => {
  const { Link, paths } = useLinkComponent();

  const tool = row.original;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.toolLink(tool.id)}>
          {tool.id}
        </Link>
      }
      description={tool.description}
    />
  );
};

export const columns: ColumnDef<ToolWithAgents>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Source',
    accessorKey: 'source',
    cell: ({ row }) => {
      const tool = row.original;
      const source = (tool as any).source || 'code';

      const isCodeTool = source === 'code';

      return (
        <Cell>
          <Badge
            variant={isCodeTool ? 'default' : 'success'}
            icon={isCodeTool ? <CodeIcon size={14} /> : <ToolCoinIcon />}
          >
            {source}
          </Badge>
        </Cell>
      );
    },
  },
  {
    header: 'Attached entities',
    accessorKey: 'attachedEntities',
    cell: ({ row }) => {
      const tool = row.original;

      const agentsCount = tool.agents.length;

      return (
        <Cell>
          <Badge variant="default" icon={<AgentIcon className="text-accent1" />}>
            {agentsCount} agent{agentsCount > 1 ? 's' : ''}
          </Badge>
        </Cell>
      );
    },
  },
];
