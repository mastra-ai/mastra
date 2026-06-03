import { useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useExistingConnections } from '../hooks/use-existing-connections';
import type { ToolProviderConnectionFormValue } from '../schemas';
import { ConnectionBadge } from './connection-badge';
import { ManageConnectionDialog } from './manage-connection-dialog';

export interface ConnectionBadgesProps {
  providerId: string;
  toolkit: string;
  /** When the tool is selected, its active connections are the ones the agent uses. */
  isChecked?: boolean;
  disabled?: boolean;
}

/**
 * Renders the toolkit's active connections as inline badges on the tool card.
 * Each badge opens one manage dialog for renaming or disconnecting the account.
 * While the tool is selected, the badges ARE the connections the agent uses: the
 * saved form is kept in sync with the active connections.
 */
export const ConnectionBadges = ({ providerId, toolkit, isChecked = false, disabled = false }: ConnectionBadgesProps) => {
  const { setValue } = useFormContext();
  const connectionsQuery = useExistingConnections(providerId, toolkit, { scopeToSelf: true });

  const [managingConnectionId, setManagingConnectionId] = useState<string | null>(null);

  const fieldName = `toolProviders.${providerId}.connections.${toolkit}` as const;
  const pinnedRaw = useWatch({ name: fieldName }) as ToolProviderConnectionFormValue[] | undefined;
  const pinned = useMemo(() => pinnedRaw ?? [], [pinnedRaw]);

  const activeConnections = useMemo(
    () => (connectionsQuery.data?.items ?? []).filter(connection => connection.status === 'active'),
    [connectionsQuery.data?.items],
  );
  const managingConnection = activeConnections.find(connection => connection.connectionId === managingConnectionId);

  // Badges = used: while the tool is selected, make sure every active connection
  // is pinned in the form so the agent actually uses it. New accounts (created via
  // Connect) and previously-authorized ones both get picked up here.
  useEffect(() => {
    if (!isChecked) return;
    const pinnedIds = new Set(pinned.map(connection => connection.connectionId));
    const missing = activeConnections.filter(connection => !pinnedIds.has(connection.connectionId));
    if (missing.length === 0) return;
    setValue(
      fieldName,
      [
        ...pinned,
        ...missing.map(connection => ({
          kind: 'author' as const,
          toolkit,
          connectionId: connection.connectionId,
          ...(connection.label?.trim() ? { label: connection.label.trim() } : {}),
          scope: 'per-author' as const,
        })),
      ],
      { shouldDirty: true },
    );
  }, [isChecked, activeConnections, pinned, fieldName, toolkit, setValue]);

  const unpinConnection = (connectionId: string) => {
    if (!pinned.some(connection => connection.connectionId === connectionId)) return;
    setValue(
      fieldName,
      pinned.filter(connection => connection.connectionId !== connectionId),
      { shouldDirty: true },
    );
  };

  if (activeConnections.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid={`connection-badges-${providerId}-${toolkit}`}>
      {activeConnections.map(connection => (
        <ConnectionBadge
          key={connection.connectionId}
          providerId={providerId}
          toolkit={toolkit}
          connectionId={connection.connectionId}
          label={connection.label}
          disabled={disabled}
          onManage={() => setManagingConnectionId(connection.connectionId)}
        />
      ))}

      {managingConnection && (
        <ManageConnectionDialog
          open
          onOpenChange={next => {
            if (!next) setManagingConnectionId(null);
          }}
          providerId={providerId}
          connectionId={managingConnection.connectionId}
          initialLabel={managingConnection.label ?? ''}
          disabled={disabled}
          testIdPrefix={`connection-badge-manage-${providerId}-${toolkit}`}
          onDisconnected={unpinConnection}
        />
      )}
    </div>
  );
};
