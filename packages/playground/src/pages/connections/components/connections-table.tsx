import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Table } from '@mastra/playground-ui/components/Table';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { UserConnectProvider, UserConnection } from '@mastra/playground-ui/domains/connect';
import { MoreVertical, Unplug } from 'lucide-react';

import { ProviderLogo } from './provider-logo';

function statusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'neutral';
  return 'destructive';
}

export interface ConnectionsTableProps {
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

/** One table of connect-surface connections (used for both Global and Your connections). */
export function ConnectionsTable({
  label,
  connections,
  providersById,
  emptyMessage,
  loading = false,
  onDisconnect,
  disconnectPendingId,
}: ConnectionsTableProps) {
  const columnCount = onDisconnect ? 4 : 3;

  return (
    <Table variant="inset" aria-label={label} aria-busy={loading || undefined}>
      <Table.Header>
        <Table.Row>
          <Table.Head>Integration</Table.Head>
          <Table.Head>Account</Table.Head>
          <Table.Head>Status</Table.Head>
          {onDisconnect ? (
            <Table.Head align="right">
              <span className="sr-only">Actions</span>
            </Table.Head>
          ) : null}
        </Table.Row>
      </Table.Header>
      <Table.Body>
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
              <Txt as="span" variant="body" tone="muted">
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
                    <Txt as="span" variant="body">
                      {displayName}
                    </Txt>
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <Txt as="span" variant="body" tone="muted">
                    {connection.accountLabel ?? '—'}
                  </Txt>
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={statusVariant(connection.status)}>{connection.status}</Badge>
                </Table.Cell>
                {onDisconnect ? (
                  <Table.Cell align="right">
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
                  </Table.Cell>
                ) : null}
              </Table.Row>
            );
          })
        )}
      </Table.Body>
    </Table>
  );
}
