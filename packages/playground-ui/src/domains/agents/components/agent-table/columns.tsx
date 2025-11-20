import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';

import { AgentTableData } from './types';
import { useLinkComponent } from '@/lib/framework';
import { providerMapToIcon } from '../provider-map-icon';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { extractPrompt } from '../../utils/extractPrompt';

export type AgentTableColumn = {
  id: string;
} & AgentTableData;

const NameCell = ({ row }: { row: Row<AgentTableColumn> }) => {
  const { Link, paths } = useLinkComponent();

  return (
    <EntryCell
      name={
        <Link className="w-full space-y-0" href={paths.agentLink(row.original.id)}>
          {row.original.name}
        </Link>
      }
      description={extractPrompt(row.original.instructions)}
    />
  );
};

export const columns: ColumnDef<AgentTableColumn>[] = [
  {
    header: 'Name',
    accessorKey: 'name',
    cell: NameCell,
  },
  {
    header: 'Model',
    accessorKey: 'model',
    cell: ({ row }) => {
      return (
        <Cell>
          <Badge
            variant="default"
            icon={providerMapToIcon[row.original.provider as keyof typeof providerMapToIcon] || <OpenAIIcon />}
            className="truncate"
          >
            {row.original.modelId || 'N/A'}
          </Badge>
          {row.original.modelList && row.original.modelList.length > 1 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="info" className="ml-2">
                  + {row.original.modelList.length - 1} more
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="bg-surface5 flex flex-col gap-2">
                {row.original.modelList.slice(1).map(mdl => (
                  <div key={mdl.id}>
                    <Badge
                      variant="default"
                      icon={providerMapToIcon[mdl.model.provider as keyof typeof providerMapToIcon]}
                    >
                      {mdl.model.modelId}
                    </Badge>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </Cell>
      );
    },
  },
  {
    header: 'Attached entities',
    accessorKey: 'attachedEntities',
    cell: ({ row }) => {
      const agent = row.original;

      const agentsCount = Object.keys(agent.agents || {}).length;
      const toolsCount = Object.keys(agent.tools || {}).length;
      const workflowsCount = Object.keys(agent.workflows || {}).length;

      return (
        <Cell>
          <span className="flex flex-row gap-2 w-full items-center">
            <Badge variant="default" icon={<AgentIcon className="text-accent1" />}>
              {agentsCount} agent{agentsCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="default" icon={<ToolsIcon className="text-accent6" />}>
              {toolsCount} tool{toolsCount > 1 ? 's' : ''}
            </Badge>
            <Badge variant="default" icon={<WorkflowIcon className="text-accent3" />}>
              {workflowsCount} workflow{workflowsCount > 1 ? 's' : ''}
            </Badge>
          </span>
        </Cell>
      );
    },
  },
];
