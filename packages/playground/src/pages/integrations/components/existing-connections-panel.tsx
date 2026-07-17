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
  return (
    <li className="flex items-center justify-between border-b py-2">
      <div>
        <div className="font-mono text-xs">{connection.connectionId}</div>
        <div className="text-xs text-gray-500">
          {connection.label ?? '(no label)'} · {connection.status}
          {connection.scope ? ` · ${connection.scope}` : ''}
          {isAdmin && connection.authorId ? ` · author: ${connection.authorId}` : ''}
        </div>
      </div>
      <button
        type="button"
        className="text-red-600 underline disabled:opacity-50"
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
          <h3 className="text-sm font-semibold text-gray-700" data-testid={`integration-author-group-${authorKey}`}>
            {authorKey === 'shared' ? 'Shared' : `Owned by ${authorKey}`}
          </h3>
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
    <div className="space-y-2 border rounded p-4">
      <h2 className="text-lg font-semibold">Existing connections</h2>
      {!providerId || !toolkit ? (
        <p className="text-gray-500">Pick a provider and toolkit to list connections.</p>
      ) : isLoading ? (
        <p className="text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-red-600">{String(error)}</p>
      ) : connections.length === 0 ? (
        <p className="text-gray-500">No connections.</p>
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
      {disconnectError ? <p className="text-red-600">{String(disconnectError)}</p> : null}
    </div>
  );
}
