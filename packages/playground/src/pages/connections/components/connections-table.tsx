import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Table } from '@mastra/playground-ui/components/Table';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { UserConnectProvider, UserConnection } from '@mastra/playground-ui/domains/connect';
import { ProviderLogo } from '@mastra/playground-ui/domains/connect';

import { MoreVertical, Unplug } from 'lucide-react';

function statusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'neutral';
  return 'destructive';
}

interface ConnectionRowsProps {
  label: string;
  connections: UserConnection[];
  /** Catalog lookup used to resolve display names and logos. */
  providersById: ReadonlyMap<string, UserConnectProvider>;
  emptyMessage: string;
  loading?: boolean;
  /** Present only for the caller's own connections — global rows are read-only. */
  onDisconnect?: (connectionId: string, displayName: string) => void;
  disconnectPendingId?: string | null;
}

const SKELETON_ROWS = [0, 1, 2];

function ConnectionRows({
  label,
  connections,
  providersById,
  emptyMessage,
  loading = false,
  onDisconnect,
  disconnectPendingId,
}: ConnectionRowsProps) {
  const columnCount = 4;

  return (
    <Table.Body aria-label={label}>
      <Table.Row>
        <Table.Head scope="rowgroup" colSpan={columnCount}>
          {onDisconnect ? 'User' : 'Global'}
        </Table.Head>
      </Table.Row>
      {loading ? (
        SKELETON_ROWS.map(index => (
          <Table.Row key={index}>
            {Array.from({ length: columnCount }, (_, cell) => (
              <Table.Cell key={cell}>
                <SkeletonText />
              </Table.Cell>
            ))}
          </Table.Row>
        ))
      ) : connections.length === 0 ? (
        <Table.Row>
          <Table.Cell colSpan={columnCount}>
            <Txt as="span" variant="body-sm" tone="muted">
              {emptyMessage}
            </Txt>
          </Table.Cell>
        </Table.Row>
      ) : (
        connections.map(connection => {
          // Row metadata first (resolved server-side from the full catalog);
          // the policy-filtered provider list is only a fallback for older
          // servers that don't send it.
          const provider = providersById.get(connection.integrationId);
          const displayName = connection.displayName ?? provider?.displayName ?? connection.integrationId;
          return (
            <Table.Row key={connection.id}>
              <Table.Cell>
                <span className="flex items-center gap-2">
                  <ProviderLogo logoUrl={connection.logoUrl ?? provider?.logoUrl} />
                  <Txt as="span" variant="body-sm">
                    {displayName}
                  </Txt>
                </span>
              </Table.Cell>
              <Table.Cell>
                <Txt as="span" variant="body-sm" tone="muted">
                  {connection.accountLabel ?? '—'}
                </Txt>
              </Table.Cell>
              <Table.Cell>
                <Badge variant={statusVariant(connection.status)} emphasis="subtle" size="sm">
                  {connection.status}
                </Badge>
              </Table.Cell>
              <Table.Cell align="right">
                {onDisconnect ? (
                  <DropdownMenu>
                    <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label={`Actions for ${displayName}`}>
                      <MoreVertical />
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" className="w-44">
                      <DropdownMenu.Item
                        variant="destructive"
                        disabled={disconnectPendingId === connection.id}
                        onSelect={() => onDisconnect(connection.id, displayName)}
                      >
                        <Unplug /> Disconnect
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                ) : null}
              </Table.Cell>
            </Table.Row>
          );
        })
      )}
    </Table.Body>
  );
}

interface ConnectionsTableProps {
  globalConnections: UserConnection[];
  userConnections: UserConnection[];
  providersById: ReadonlyMap<string, UserConnectProvider>;
  loading?: boolean;
  onDisconnect: (connectionId: string, displayName: string) => void;
  disconnectPendingId?: string | null;
}

export function ConnectionsTable({
  globalConnections,
  userConnections,
  providersById,
  loading,
  onDisconnect,
  disconnectPendingId,
}: ConnectionsTableProps) {
  return (
    <Table variant="inset" aria-label="Connections" aria-busy={loading || undefined}>
      <Table.Header>
        <Table.Row>
          <Table.Head>Integration</Table.Head>
          <Table.Head>Account</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head align="right">
            <span className="sr-only">Actions</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <ConnectionRows
        label="Global connections"
        connections={globalConnections}
        providersById={providersById}
        loading={loading}
        emptyMessage="No global connections are linked to this project."
      />
      <ConnectionRows
        label="Your connections"
        connections={userConnections}
        providersById={providersById}
        loading={loading}
        emptyMessage="You haven't connected any accounts yet."
        onDisconnect={onDisconnect}
        disconnectPendingId={disconnectPendingId}
      />
    </Table>
  );
}
