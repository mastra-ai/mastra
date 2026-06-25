import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { UseFormSetValue } from 'react-hook-form';

import { ManageConnectionDialog } from '../../../../tool-providers/components/manage-connection-dialog';
import { useAuthorize } from '../../../../tool-providers/hooks/use-authorize';
import { useExistingConnections } from '../../../../tool-providers/hooks/use-existing-connections';
import { useToolkits } from '../../../../tool-providers/hooks/use-toolkits';
import type { ToolProviderConnectionFormValue, ToolProvidersFormValue } from '../../../../tool-providers/schemas';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface ToolkitConnectionControlProps {
  providerId: string;
  toolkit: string;
  disabled?: boolean;
  /** Whether this provider's toolkits support more than one connection. */
  multipleAllowed?: boolean;
}

const MAX_LABEL_LENGTH = 32;

/**
 * Derives a stored-schema-valid fallback label for a connection that has no
 * user-provided label. The schema requires `[A-Za-z0-9 _-]+`, ≤ 32 chars, so we
 * sanitize the (already unique) connectionId into that charset and cap length.
 */
const deriveConnectionLabel = (connectionId: string): string => {
  const sanitized = connectionId.replace(/[^A-Za-z0-9 _-]+/g, '-').replace(/^[-\s]+|[-\s]+$/g, '');
  const base = sanitized.length > 0 ? sanitized : 'connection';
  return base.length > MAX_LABEL_LENGTH ? base.slice(0, MAX_LABEL_LENGTH) : base;
};

/**
 * Ensures the labels produced for a pin set are unique case-insensitively
 * (the stored schema rejects duplicate labels within a toolkit). Disambiguates
 * collisions with a short numeric suffix kept within the length budget.
 */
const dedupeLabels = (pins: ToolProviderConnectionFormValue[]): ToolProviderConnectionFormValue[] => {
  const seen = new Set<string>();
  return pins.map(pin => {
    let label = pin.label ?? '';
    const key = () => label.toLocaleLowerCase();
    let suffix = 2;
    while (seen.has(key())) {
      const tag = ` ${suffix++}`;
      label = `${label.slice(0, MAX_LABEL_LENGTH - tag.length)}${tag}`;
    }
    seen.add(key());
    return label === pin.label ? pin : { ...pin, label };
  });
};

const pinsEqual = (a: ToolProviderConnectionFormValue[], b: ToolProviderConnectionFormValue[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((pin, index) => {
    const other = b[index]!;
    return (
      pin.connectionId === other.connectionId &&
      pin.toolkit === other.toolkit &&
      pin.scope === other.scope &&
      (pin.label ?? undefined) === (other.label ?? undefined)
    );
  });
};

interface ActiveConnection {
  connectionId: string;
  label?: string | null;
}

const getToolkitConnectionPins = ({
  activeConnections,
  pinned,
  toolkit,
}: {
  activeConnections: ActiveConnection[];
  pinned: ToolProviderConnectionFormValue[];
  toolkit: string;
}): ToolProviderConnectionFormValue[] => {
  const pinnedById = new Map(pinned.map(connection => [connection.connectionId, connection]));
  const desired = activeConnections.map(connection => {
    const existing = pinnedById.get(connection.connectionId);
    return {
      kind: 'author' as const,
      toolkit,
      connectionId: connection.connectionId,
      scope: existing?.scope ?? ('per-author' as const),
      label: existing?.label?.trim() || connection.label?.trim() || undefined,
    };
  });

  if (desired.length < 2) return desired;

  return dedupeLabels(desired.map(pin => ({ ...pin, label: pin.label || deriveConnectionLabel(pin.connectionId) })));
};

const useSyncActiveConnectionsToForm = ({
  hasSelectedTool,
  currentPins,
  desiredPins,
  connectionsField,
  setValue,
}: {
  hasSelectedTool: boolean;
  currentPins: ToolProviderConnectionFormValue[];
  desiredPins: ToolProviderConnectionFormValue[];
  connectionsField: `toolProviders.${string}.connections.${string}`;
  setValue: UseFormSetValue<AgentBuilderEditFormValues>;
}) => {
  useEffect(() => {
    if (!hasSelectedTool || pinsEqual(currentPins, desiredPins)) return;
    setValue(connectionsField, desiredPins, { shouldDirty: true });
  }, [hasSelectedTool, desiredPins, currentPins, connectionsField, setValue]);
};

/**
 * Per-toolkit connection control rendered on the right edge of a toolkit row in
 * the left filter pane. Connections are keyed by `(providerId, toolkit)`, so a
 * single control manages the connection shared by every tool in the toolkit.
 *
 * - No active connection → an outline "Connect" button that runs OAuth.
 * - Has a connection → a settings cog that opens {@link ManageConnectionDialog}
 *   (rename + disconnect-with-confirmation). When the provider allows multiple
 *   connections per toolkit, a "+" button lets the author add another account.
 *
 * It also keeps the saved form in sync: while any tool in this toolkit is
 * selected, every active connection is pinned into
 * `toolProviders.${providerId}.connections.${toolkit}` so the agent actually
 * uses it. Disconnecting an account unpins it.
 */
export const ToolkitConnectionControl = ({
  providerId,
  toolkit,
  disabled = false,
  multipleAllowed = false,
}: ToolkitConnectionControlProps) => {
  const { setValue } = useFormContext<AgentBuilderEditFormValues>();
  const queryClient = useQueryClient();
  const authorize = useAuthorize();
  const connectionsQuery = useExistingConnections(providerId, toolkit, { scopeToSelf: true });

  const [manageOpen, setManageOpen] = useState(false);

  // Only resolve the toolkit icon while the manage dialog is open.
  const toolkitsQuery = useToolkits(manageOpen ? providerId : null);
  const iconUrl = useMemo(
    () => toolkitsQuery.data?.data?.find(entry => entry.slug === toolkit)?.icon,
    [toolkitsQuery.data?.data, toolkit],
  );

  const connectionsField = useMemo(
    () => `toolProviders.${providerId}.connections.${toolkit}` as const,
    [providerId, toolkit],
  );
  const pinnedRaw = useWatch({ name: connectionsField }) as ToolProviderConnectionFormValue[] | undefined;
  const pinned = useMemo(() => pinnedRaw ?? [], [pinnedRaw]);

  // Any selected tool in this toolkit means the toolkit's connections are used.
  const providerConfig = useWatch({ name: `toolProviders.${providerId}` }) as
    | ToolProvidersFormValue[string]
    | undefined;
  const hasSelectedTool = useMemo(
    () => Object.values(providerConfig?.tools ?? {}).some(tool => tool?.toolkit === toolkit),
    [providerConfig?.tools, toolkit],
  );

  const activeConnections = useMemo(
    () => (connectionsQuery.data?.items ?? []).filter(connection => connection.status === 'active'),
    [connectionsQuery.data?.items],
  );

  const desiredPins = useMemo(
    () => getToolkitConnectionPins({ activeConnections, pinned, toolkit }),
    [activeConnections, pinned, toolkit],
  );

  const manageableConnections = useMemo(
    () =>
      activeConnections.map(connection => ({
        connectionId: connection.connectionId,
        label: connection.label,
      })),
    [activeConnections],
  );

  useSyncActiveConnectionsToForm({ hasSelectedTool, currentPins: pinned, desiredPins, connectionsField, setValue });

  const unpinConnection = (connectionId: string) => {
    if (!pinned.some(connection => connection.connectionId === connectionId)) return;
    setValue(
      connectionsField,
      pinned.filter(connection => connection.connectionId !== connectionId),
      { shouldDirty: true },
    );
  };

  const handleConnect = () => {
    authorize.mutate(
      { providerId, toolkit, scope: 'per-author' },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: ['tool-integration-connections', providerId, toolkit] });
          void queryClient.invalidateQueries({
            queryKey: ['tool-integration-connections-all', providerId, toolkit],
          });
        },
      },
    );
  };

  const testIdSuffix = `${providerId}-${toolkit}`;

  // Until the connections query settles, show a skeleton so the Connect button
  // doesn't flash before a possible cog/manage control.
  if (connectionsQuery.isPending) {
    return <Skeleton className="h-7 w-20" data-testid={`toolkit-connection-loading-${testIdSuffix}`} />;
  }

  if (activeConnections.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleConnect}
        disabled={disabled || authorize.isPending}
        data-testid={`toolkit-connect-${testIdSuffix}`}
      >
        {authorize.isPending ? 'Connecting…' : 'Connect'}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1" data-testid={`toolkit-connection-${testIdSuffix}`}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tooltip="Manage connection"
        aria-label={`Manage ${toolkit} connection`}
        onClick={() => setManageOpen(true)}
        disabled={disabled}
        data-testid={`toolkit-manage-${testIdSuffix}`}
      >
        <Settings />
      </Button>

      {manageOpen && (
        <ManageConnectionDialog
          open
          onOpenChange={setManageOpen}
          providerId={providerId}
          connections={manageableConnections}
          disabled={disabled}
          testIdPrefix={`toolkit-manage-${testIdSuffix}`}
          onDisconnected={unpinConnection}
          iconUrl={iconUrl}
          onAddConnection={multipleAllowed ? handleConnect : undefined}
          addingConnection={authorize.isPending}
        />
      )}
    </div>
  );
};
