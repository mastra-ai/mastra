import { ColumnDef } from '@tanstack/react-table';

import Link from 'next/link';

import { Icon } from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

import { formatDate } from '@/lib/date';

import last from 'lodash/last';

import { useConnections } from '../../hooks/use-integration';
import { Integration, IntegrationWithConnection } from '../../types';
import { IntegrationLogo } from '../integration-logo';

interface IIntegrationsTableColumns {
  handleConnectionButtonSnippet: (integration: Integration) => void;
  handleConnectIntegration: (integration: Integration) => void;
  handlevViewDocs?: (integration: Integration) => void;
}

const NameCell = ({ name, logoUrl, connections }: { name: string; logoUrl: string; connections: number }) => {
  return (
    <div className="flex gap-3 items-center">
      <IntegrationLogo name={name} logoUrl={logoUrl} className="relative" withConnectionsDot={!!connections} />
      <div className="flex flex-col">
        <Text size="sm" weight="medium" className="text-mastra-el-5 capitalize">
          {name.toLowerCase()}
        </Text>
        {typeof connections === 'number' ? (
          <Text size="xs" className="text-mastra-el-4 text-[0.67rem] line-clamp-1 w-[500px] text-ellipsis">
            {connections} connection{connections > 1 ? 's' : ''}
          </Text>
        ) : null}
      </div>
    </div>
  );
};

const CreatedAtCell = ({ name }: { name: string }) => {
  const { connections } = useConnections({ name });
  const firstConnection = last(connections);
  return firstConnection ? (
    <div className="flex items-center gap-1">
      <Icon name="calendar-empty" className="text-mastra-el-3" />
      <Text size="xs" className="text-mastra-el-3">
        {formatDate(firstConnection.createdAt, { month: 'short' })}
      </Text>
    </div>
  ) : (
    <Text size="xs" className="text-mastra-el-3">
      -
    </Text>
  );
};

export const integrationsTableColumns = ({
  handleConnectionButtonSnippet,
  handleConnectIntegration,
  handlevViewDocs,
}: IIntegrationsTableColumns): ColumnDef<IntegrationWithConnection>[] => [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { name, logoUrl, connections, isLoading } = row.original;

      if (isLoading)
        return (
          <div className="flex gap-3 items-center">
            <Skeleton className="h-8 w-8 rounded-sm" />
            <div className="flex flex-col gap-0.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        );

      return <NameCell name={name} logoUrl={logoUrl} connections={connections} />;
    },
  },
  {
    id: 'connected',
    header: 'Connected',
    cell: ({ row }) => {
      if (row.original.isLoading)
        return (
          <div className="flex gap-1 items-center">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3 w-24" />
          </div>
        );
      return <CreatedAtCell name={row.original.name} />;
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      if (row.original.isLoading)
        return (
          <div className="flex gap-2 items-center">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-1 w-4 rounded-md" />
          </div>
        );

      return (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="primary"
            className="text-xs"
            onClick={() => {
              handleConnectionButtonSnippet(row.original);
            }}
          >
            <Icon name="activity" className="text-mastra-el-3 mr-1" />
            Add app button
          </Button>
          <Button
            size="xs"
            variant="primary"
            className="text-xs"
            onClick={() => {
              handleConnectIntegration(row.original);
            }}
          >
            <Icon name="plus-icon" className="text-mastra-el-3 mr-1" />
            Connect account
          </Button>
          <Link
            href={`/playground?integration=${row.original.name.toUpperCase()}`}
            className="text-xs h-6 rounded-md px-3 border-[0.5px] border-mastra-border-1 bg-mastra-bg-4 hover:bg-mastra-bg-2/80 text-kp-el-6 flex gap-1 items-center"
          >
            <Icon name="playground" className="text-mastra-el-3  h-3 w-3 mr-1" />
            Playground
          </Link>
        </div>
      );
    },
  },
];
