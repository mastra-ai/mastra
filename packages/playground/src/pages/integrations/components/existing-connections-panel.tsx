import { Badge } from '@mastra/playground-ui/components/Badge';
import { Metadata } from '@mastra/playground-ui/components/Metadata';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ConnectionItem, GroupedConnections } from '../types';

function ConnectionRow({
  connection,
  isAdmin,
  disconnectPending,
  onDisconnect,
}: {
  connection: ConnectionItem;
  isAdmin: boolean;
  disconnectPending: boolean;
  onDisconnect: () => void;
}) {
  const authorId = isAdmin ? connection.authorId : undefined;

  return (
    <li className="flex items-center justify-between gap-4 border-b py-2">
      <div className="flex min-w-0 flex-col gap-2">
        <Txt as="p" variant="caption" font="mono" className="wrap-anywhere">
          {connection.connectionId}
        </Txt>
        <Metadata>
          <Metadata.Item>
            <Txt as="span" variant="caption">
              {connection.label ?? '(no label)'}
            </Txt>
          </Metadata.Item>
          <Metadata.Item>
            <Badge size="xs" emphasis="subtle">
              {connection.status}
            </Badge>
          </Metadata.Item>
        </Metadata>
        {(connection.scope || authorId) && (
          <dl className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {connection.scope && (
              <div className="flex min-w-0 items-baseline gap-1">
                <dt>
                  <Txt as="span" variant="caption" tone="faint">
                    Scope
                  </Txt>
                </dt>
                <dd className="min-w-0">
                  <Txt as="span" variant="caption" tone="muted">
                    {connection.scope}
                  </Txt>
                </dd>
              </div>
            )}
            {authorId && (
              <div className="flex min-w-0 items-baseline gap-1">
                <dt>
                  <Txt as="span" variant="caption" tone="faint">
                    Author
                  </Txt>
                </dt>
                <dd className="min-w-0 wrap-anywhere">
                  <Txt as="span" variant="caption" tone="muted">
                    {authorId}
                  </Txt>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
      <button
        type="button"
        className="shrink-0 text-destructive-foreground underline disabled:opacity-50"
        onClick={onDisconnect}
        disabled={disconnectPending}
      >
        Disconnect
      </button>
    </li>
  );
}

function ConnectionList({
  connections,
  isAdmin,
  disconnectPending,
  onDisconnect,
}: {
  connections: ConnectionItem[];
  isAdmin: boolean;
  disconnectPending: boolean;
  onDisconnect: (connectionId: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {connections.map(connection => (
        <ConnectionRow
          key={connection.connectionId}
          connection={connection}
          isAdmin={isAdmin}
          disconnectPending={disconnectPending}
          onDisconnect={() => onDisconnect(connection.connectionId)}
        />
      ))}
    </ul>
  );
}

function ConnectionGroups({
  groups,
  isAdmin,
  disconnectPending,
  onDisconnect,
}: {
  groups: GroupedConnections;
  isAdmin: boolean;
  disconnectPending: boolean;
  onDisconnect: (connectionId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map(([authorKey, rows]) => (
        <div key={authorKey}>
          <Txt as="h3" variant="subheading" tone="ink" data-testid={`integration-author-group-${authorKey}`}>
            {authorKey === 'shared' ? 'Shared' : `Owned by ${authorKey}`}
          </Txt>
          <ConnectionList
            connections={rows}
            isAdmin={isAdmin}
            disconnectPending={disconnectPending}
            onDisconnect={onDisconnect}
          />
        </div>
      ))}
    </div>
  );
}

interface ExistingConnectionsPanelProps {
  providerId: string;
  toolkit: string;
  connections: ConnectionItem[];
  groupedByAuthor: GroupedConnections | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: unknown;
  disconnectPending: boolean;
  disconnectError: unknown;
  onDisconnect: (connectionId: string) => void;
}

export function ExistingConnectionsPanel({
  providerId,
  toolkit,
  connections,
  groupedByAuthor,
  isAdmin,
  isLoading,
  error,
  disconnectPending,
  disconnectError,
  onDisconnect,
}: ExistingConnectionsPanelProps) {
  return (
    <div className="space-y-2 rounded border p-4">
      <Txt as="h2" variant="heading">
        Existing connections
      </Txt>
      {!providerId || !toolkit ? (
        <p className="text-muted-foreground">Pick a provider and toolkit to list connections.</p>
      ) : isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="text-destructive-foreground">{String(error)}</p>
      ) : connections.length === 0 ? (
        <p className="text-muted-foreground">No connections.</p>
      ) : groupedByAuthor ? (
        <ConnectionGroups
          groups={groupedByAuthor}
          isAdmin={isAdmin}
          disconnectPending={disconnectPending}
          onDisconnect={onDisconnect}
        />
      ) : (
        <ConnectionList
          connections={connections}
          isAdmin={isAdmin}
          disconnectPending={disconnectPending}
          onDisconnect={onDisconnect}
        />
      )}
      {disconnectError ? <p className="text-destructive-foreground">{String(disconnectError)}</p> : null}
    </div>
  );
}
