import { Txt, cn } from '@mastra/playground-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useAuthorize } from '../hooks/use-authorize';
import { useExistingConnections } from '../hooks/use-existing-connections';
import { useUpdateConnection } from '../hooks/use-update-connection';
import type { ToolProviderConnectionFormValue } from '../schemas';

export interface IntegrationConnectionPickerProps {
  providerId: string;
  toolkit: string;
  /**
   * Mirror of `ToolProviderCapabilities.multipleConnectionsPerToolkit`. When
   * `false`, the Add button is disabled once one connection is pinned.
   */
  multipleAllowed: boolean;
  disabled?: boolean;
}

/**
 * Compact picker rendered beneath a checked integration tool card. Lets the
 * caller pin one or more existing OAuth connections (from `useExistingConnections`)
 * into the form field `toolProviders[providerId].connections[toolkit]`.
 *
 * Each pinned row shows the connection's persisted label (or its connectionId
 * if unlabeled) with a small pencil affordance to rename it inline — renames
 * hit `PATCH /tool-providers/:providerId/connections/:connectionId` and stay
 * with the connection itself, visible across every agent that pins it.
 *
 * Locked to `scope: 'per-author'` — Builder surfaces own a single bucket scope.
 */
export const IntegrationConnectionPicker = ({
  providerId,
  toolkit,
  multipleAllowed,
  disabled = false,
}: IntegrationConnectionPickerProps) => {
  const { setValue } = useFormContext();
  const queryClient = useQueryClient();
  const authorize = useAuthorize();
  const updateConnection = useUpdateConnection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState<{ connectionId: string; draft: string } | null>(null);

  // Subscribe to this toolkit's pinned list.
  const fieldName = `toolProviders.${providerId}.connections.${toolkit}` as const;
  const pinnedRaw = useWatch({ name: fieldName }) as ToolProviderConnectionFormValue[] | undefined;
  const pinned = useMemo(() => pinnedRaw ?? [], [pinnedRaw]);

  // `scopeToSelf: true` ensures admins viewing/editing another user's agent
  // only see their own connections in the picker — never other authors' rows.
  const connectionsQuery = useExistingConnections(providerId, toolkit, { scopeToSelf: true });
  const allConnections = useMemo(() => connectionsQuery.data?.items ?? [], [connectionsQuery.data?.items]);

  const pinnedIds = useMemo(() => new Set(pinned.map(c => c.connectionId)), [pinned]);
  const available = useMemo(
    () => allConnections.filter(c => !pinnedIds.has(c.connectionId)),
    [allConnections, pinnedIds],
  );

  const addDisabled = disabled || (!multipleAllowed && pinned.length >= 1);

  const writePinned = (next: ToolProviderConnectionFormValue[]) => {
    setValue(fieldName, next, { shouldDirty: true });
  };

  const handlePick = (connectionId: string) => {
    const entry: ToolProviderConnectionFormValue = {
      kind: 'author',
      toolkit,
      connectionId,
      scope: 'per-author',
    };
    writePinned([...pinned, entry]);
    setMenuOpen(false);
  };

  const handleRemove = (connectionId: string) => {
    writePinned(pinned.filter(c => c.connectionId !== connectionId));
  };

  const handleConnectNew = () => {
    setMenuOpen(false);
    authorize.mutate(
      { providerId, toolkit, scope: 'per-author' },
      {
        onSuccess: result => {
          void queryClient.invalidateQueries({
            queryKey: ['tool-integration-connections', providerId, toolkit],
          });
          void queryClient.invalidateQueries({
            queryKey: ['tool-integration-connections-all', providerId, toolkit],
          });
          // Auto-pin the freshly-authorized connection so users don't have to
          // re-open the picker after the OAuth flow. Defensive guard against
          // racing dupes and against violating the single-connection cap.
          if (result.status !== 'completed') return;
          if (!multipleAllowed && pinned.length >= 1) return;
          if (pinned.some(c => c.connectionId === result.connectionId)) return;
          writePinned([...pinned, { kind: 'author', toolkit, connectionId: result.connectionId, scope: 'per-author' }]);
        },
      },
    );
  };

  const labelFor = (connectionId: string): string => {
    const summary = allConnections.find(c => c.connectionId === connectionId);
    return summary?.label?.trim() || connectionId;
  };

  const startEdit = (connectionId: string) => {
    const summary = allConnections.find(c => c.connectionId === connectionId);
    setEditing({ connectionId, draft: summary?.label?.trim() ?? '' });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = () => {
    if (!editing) return;
    const { connectionId, draft } = editing;
    updateConnection.mutate(
      { providerId, connectionId, label: draft.trim().length > 0 ? draft.trim() : null },
      { onSuccess: () => setEditing(null) },
    );
  };

  return (
    <div
      data-testid={`integration-connection-picker-${providerId}-${toolkit}`}
      className="flex flex-col gap-1 rounded border border-border1 bg-surface3 p-2"
    >
      {pinned.length === 0 ? (
        <Txt variant="ui-xs" className="text-neutral3 px-1">
          {allConnections.length === 0
            ? 'No connections yet — Connect to add one.'
            : 'Pick a connection for this toolkit.'}
        </Txt>
      ) : (
        <ul className="flex flex-col gap-1">
          {pinned.map(conn => {
            const isEditing = editing?.connectionId === conn.connectionId;
            return (
              <li
                key={conn.connectionId}
                data-testid={`integration-connection-pinned-${providerId}-${toolkit}-${conn.connectionId}`}
                className="flex items-center gap-2 px-1"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editing.draft}
                      onChange={e => setEditing({ connectionId: conn.connectionId, draft: e.target.value })}
                      disabled={disabled || updateConnection.isPending}
                      placeholder="label"
                      data-testid={`integration-connection-label-input-${providerId}-${toolkit}-${conn.connectionId}`}
                      className="min-w-0 flex-1 rounded border border-border1 bg-surface4 px-1 py-0.5 text-ui-xs text-neutral6"
                    />
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={disabled || updateConnection.isPending}
                      data-testid={`integration-connection-label-save-${providerId}-${toolkit}-${conn.connectionId}`}
                      className="shrink-0 rounded px-1 text-ui-xs text-neutral6 hover:text-green-500 disabled:opacity-60"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={updateConnection.isPending}
                      data-testid={`integration-connection-label-cancel-${providerId}-${toolkit}-${conn.connectionId}`}
                      className="shrink-0 rounded px-1 text-ui-xs text-neutral3 hover:text-neutral6 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <Txt variant="ui-xs" className="min-w-0 flex-1 truncate text-neutral6">
                      {labelFor(conn.connectionId)}
                    </Txt>
                    <button
                      type="button"
                      onClick={() => startEdit(conn.connectionId)}
                      disabled={disabled}
                      data-testid={`integration-connection-label-edit-${providerId}-${toolkit}-${conn.connectionId}`}
                      className="shrink-0 rounded px-1 text-ui-xs text-neutral3 hover:text-neutral6 disabled:opacity-60"
                      aria-label={`Rename ${labelFor(conn.connectionId)}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(conn.connectionId)}
                      disabled={disabled}
                      data-testid={`integration-connection-remove-${providerId}-${toolkit}-${conn.connectionId}`}
                      className="shrink-0 rounded px-1 text-ui-xs text-neutral3 hover:text-red-500 disabled:opacity-60"
                      aria-label={`Remove ${labelFor(conn.connectionId)}`}
                    >
                      ×
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          disabled={addDisabled}
          data-testid={`integration-connection-add-${providerId}-${toolkit}`}
          className={cn(
            'rounded border border-border1 bg-surface4 px-2 py-0.5 text-ui-xs text-neutral6',
            'hover:bg-surface5 disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          + Add connection
        </button>
        {!multipleAllowed && pinned.length >= 1 && (
          <Txt variant="ui-xs" className="text-neutral3">
            Only one connection allowed
          </Txt>
        )}
        {authorize.isPending && (
          <Txt variant="ui-xs" className="text-neutral3">
            Connecting…
          </Txt>
        )}
        {menuOpen && (
          <div
            data-testid={`integration-connection-menu-${providerId}-${toolkit}`}
            className="absolute top-full left-0 z-10 mt-1 w-60 rounded border border-border1 bg-surface3 p-1 shadow"
          >
            {available.length === 0 ? (
              <Txt variant="ui-xs" className="px-2 py-1 text-neutral3">
                No other connections
              </Txt>
            ) : (
              <ul className="flex flex-col">
                {available.map(c => (
                  <li key={c.connectionId}>
                    <button
                      type="button"
                      onClick={() => handlePick(c.connectionId)}
                      data-testid={`integration-connection-pick-${providerId}-${toolkit}-${c.connectionId}`}
                      className="w-full truncate px-2 py-1 text-left text-ui-xs text-neutral6 hover:bg-surface4"
                    >
                      {c.label?.trim() || c.connectionId}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-1 border-t border-border1 pt-1">
              <button
                type="button"
                onClick={handleConnectNew}
                disabled={authorize.isPending}
                data-testid={`integration-connection-connect-new-${providerId}-${toolkit}`}
                className="w-full px-2 py-1 text-left text-ui-xs text-neutral6 hover:bg-surface4 disabled:opacity-60"
              >
                Connect new account
              </button>
            </div>
          </div>
        )}
      </div>
      {authorize.error && (
        <Txt variant="ui-xs" className="px-1 text-red-500">
          {String(authorize.error)}
        </Txt>
      )}
      {updateConnection.error && (
        <Txt variant="ui-xs" className="px-1 text-red-500">
          {String(updateConnection.error)}
        </Txt>
      )}
    </div>
  );
};
