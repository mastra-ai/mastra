import { Badge } from '@mastra/playground-ui/components/Badge';
import type { BadgeVariant } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';

import type { UserConnection } from '@mastra/playground-ui/domains/connect';

const COLUMNS = '1fr 1fr auto auto';

function statusVariant(status: string): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'neutral';
  return 'destructive';
}

export interface ConnectionsListProps {
  label: string;
  connections: UserConnection[];
  /** Present only for the caller's own connections — global rows are read-only. */
  onDisconnect?: (connectionId: string) => void;
  disconnectPendingId?: string | null;
}

/** One table of connect-surface connections (used for both Global and Your connections). */
export function ConnectionsList({ label, connections, onDisconnect, disconnectPendingId }: ConnectionsListProps) {
  return (
    <DataList columns={COLUMNS} aria-label={label}>
      <DataList.Top>
        <DataList.TopCell>Provider</DataList.TopCell>
        <DataList.TopCell>Account</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>{onDisconnect ? 'Actions' : ''}</DataList.TopCell>
      </DataList.Top>

      {connections.map(connection => (
        <DataList.RowStatic key={connection.id}>
          <DataList.NameCell>{connection.integrationId}</DataList.NameCell>
          <DataList.TextCell>{connection.accountLabel ?? '—'}</DataList.TextCell>
          <DataList.TextCell>
            <Badge variant={statusVariant(connection.status)}>{connection.status}</Badge>
          </DataList.TextCell>
          <DataList.ActionsCell>
            {onDisconnect ? (
              <Button
                variant="destructive-ghost"
                size="sm"
                disabled={disconnectPendingId === connection.id}
                onClick={() => onDisconnect(connection.id)}
              >
                Disconnect
              </Button>
            ) : null}
          </DataList.ActionsCell>
        </DataList.RowStatic>
      ))}
    </DataList>
  );
}
