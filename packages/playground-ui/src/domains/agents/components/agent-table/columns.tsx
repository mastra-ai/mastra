import { Badge } from '@/ds/components/Badge';
import { Cell, EntryCell } from '@/ds/components/Table';
import { ApiIcon } from '@/ds/icons/ApiIcon';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';
import { ColumnDef, Row } from '@tanstack/react-table';
import { AgentIcon } from '@/ds/icons/AgentIcon';

import { AgentTableData } from './types';
import { useLinkComponent } from '@/lib/framework';
import { providerMapToIcon } from '../provider-map-icon';
import { ListIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type AgentTableColumn = {
  repoUrl: string;
  executedAt: Date | null;
  modelId: string;
  link: string;
} & AgentTableData;

const NameCell = ({ row }: { row: Row<AgentTableColumn> }) => {
  const { Link } = useLinkComponent();

  return (
    <EntryCell
      icon={<AgentIcon />}
      name={
        <Link className="w-full space-y-0" href={row.original.link}>
          {row.original.name}
        </Link>
      }
      description={row.original.instructions}
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
    size: 300,
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
    size: 160,
    header: 'Tools',
    accessorKey: 'tools',
    cell: ({ row }) => {
      const toolsCount = row.original.tools ? Object.keys(row.original.tools).length : 0;

      return (
        <Cell>
          <Badge variant="default" icon={<ApiIcon />}>
            {toolsCount} tool{toolsCount > 1 ? 's' : ''}
          </Badge>
        </Cell>
      );
    },
  },
];
