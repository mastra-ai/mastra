import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';

import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';

import { useLinkComponent } from '@/lib/framework';

import { ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { MCPTableColumn } from './types';
import { useMastraClient } from '@mastra/react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMCPServerTools } from '../../hooks/useMCPServerTools';

const NameCell = ({ row }: { row: Row<MCPTableColumn> }) => {
  const client = useMastraClient();
  const mcp = row.original;
  const { Link, paths } = useLinkComponent();
  const effectiveBaseUrl = client.options.baseUrl || 'http://localhost:4111';
  const sseUrl = `${effectiveBaseUrl}/api/mcp/${mcp.id}/sse`;

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.mcpServerLink(row.original.id)}>
          {row.original.name}
        </Link>
      }
      description={sseUrl}
    />
  );
};

export const columns: ColumnDef<MCPTableColumn>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Attached tools',
    accessorKey: 'attachedTools',
    cell: ({ row }) => {
      const mcpServer = row.original;
      const { data: tools, isLoading } = useMCPServerTools(mcpServer);

      if (isLoading)
        return (
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
        );

      const toolsCount = Object.keys(tools || {}).length;
      const agentToolsCount = Object.keys(tools || {}).filter(tool => tools?.[tool]?.toolType === 'agent').length;
      const workflowToolsCount = Object.keys(tools || {}).filter(tool => tools?.[tool]?.toolType === 'workflow').length;

      return (
        <Cell>
          <span className="flex flex-row gap-2 w-full items-center">
            <Badge variant="default" icon={<AgentIcon className="text-accent1" />}>
              {agentToolsCount} agent{agentToolsCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="default" icon={<ToolsIcon className="text-accent6" />}>
              {toolsCount} tool{toolsCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="default" icon={<WorkflowIcon className="text-accent3" />}>
              {workflowToolsCount} workflow{workflowToolsCount > 1 ? 's' : ''}
            </Badge>
          </span>
        </Cell>
      );
    },
  },
];
