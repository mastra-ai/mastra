import { ColumnDef } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import IconButton from '@/components/ui/icon-button';
import { Text } from '@/components/ui/text';

import { formatDate } from '@/lib/date';

import { Icon } from '@/app/components/icon';

import { useConnections } from '../../hooks/use-integration';
import { Integration } from '../../types';
import { IntegrationLogo } from '../integration-logo';

interface IIntegrationsTableColumns {
  handleConnectionButtonSnippet: (integration: Integration) => void;
  handleConnectIntegration: (integration: Integration) => void;
  handlevViewDocs?: (integration: Integration) => void;
}

const NameCell = ({ name, logoUrl }: { name: string; logoUrl: string }) => {
  const { connections } = useConnections({ name });
  const connectionsNo = connections?.length;

  return (
    <div className="flex gap-3">
      <IntegrationLogo name={name} logoUrl={logoUrl} className="relative">
        {!!connectionsNo && (
          <div className="w-[8px] h-[8px] bg-kpl-bg-connected border-2 border-kpl-border-6 rounded-full absolute bottom-[2px] -right-[4px]" />
        )}
      </IntegrationLogo>
      <div className="flex flex-col">
        <Text size="sm" weight="semibold" className="text-kpl-el-5">
          {name}
        </Text>
        {typeof connectionsNo === 'number' ? (
          <Text size="xs" className="text-kpl-el-4 line-clamp-1 w-[500px] text-ellipsis">
            {connectionsNo} connection{connectionsNo > 1 ? 's' : ''}
          </Text>
        ) : null}
      </div>
    </div>
  );
};

const CreatedAtCell = ({ name }: { name: string }) => {
  const { connections } = useConnections({ name });
  const latestConnection = connections?.[0];
  return latestConnection ? (
    <div className="flex items-center gap-1">
      <Icon name="calendar-empty" className="text-kpl-el-3" />
      <Text size="xs" className="text-kpl-el-3">
        {formatDate(latestConnection.createdAt, { month: 'short' })}
      </Text>
    </div>
  ) : (
    <Text size="xs" className="text-kpl-el-3">
      -
    </Text>
  );
};

export const integrationsTableColumns = ({
  handleConnectionButtonSnippet,
  handleConnectIntegration,
  handlevViewDocs,
}: IIntegrationsTableColumns): ColumnDef<Integration>[] => [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const { name, logoUrl } = row.original;

      return <NameCell name={name} logoUrl={logoUrl} />;
    },
  },
  {
    id: 'connected',
    header: 'Connected',
    cell: ({ row }) => {
      return <CreatedAtCell name={row.original.name} />;
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      return (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="primay"
            className="text-xs"
            onClick={() => {
              handleConnectionButtonSnippet(row.original);
            }}
          >
            <Icon name="activity" className="text-kpl-el-3 mr-1" />
            Add app button
          </Button>
          <Button
            size="xs"
            variant="primay"
            className="text-xs"
            onClick={() => {
              handleConnectIntegration(row.original);
            }}
          >
            <Icon name="plus-icon" className="text-kpl-el-3 mr-1" />
            Connect account
          </Button>
          <Button variant="primay" size="xs" className="text-xs">
            <Icon name="book" className="text-kpl-el-3 mr-1" />
            Docs
          </Button>
          <IconButton icon="dot-menu-sleep" className="p-[6px]" />
        </div>
      );
    },
  },
];
