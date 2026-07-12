import { useMemo, useState } from 'react';
import { ExistingConnectionsPanel } from './components/existing-connections-panel';
import { ProviderToolkitSelector } from './components/provider-toolkit-selector';
import { getGroupedConnectionsByAuthor } from './group-connections';
import { useAuthorize } from '@/domains/tool-providers/hooks/use-authorize';
import { useDisconnectConnection } from '@/domains/tool-providers/hooks/use-disconnect-connection';
import { useExistingConnections } from '@/domains/tool-providers/hooks/use-existing-connections';
import { useIsToolProviderAdmin } from '@/domains/tool-providers/hooks/use-is-tool-provider-admin';
import { useToolProviders } from '@/domains/tool-providers/hooks/use-tool-providers';
import { useToolkits } from '@/domains/tool-providers/hooks/use-toolkits';

/**
 * Minimal MVP page to exercise the v1 ToolProvider backend end-to-end:
 * pick a provider, pick a toolkit, run OAuth, list/disconnect connections.
 * Intentionally unstyled — verifies wiring, not UX.
 */
export default function IntegrationsPage() {
  const [providerId, setProviderId] = useState<string>('');
  const [toolkit, setToolkit] = useState<string>('');
  const [label, setLabel] = useState<string>('');

  const providersQuery = useToolProviders();
  const toolkitsQuery = useToolkits(providerId || null);
  const connectionsQuery = useExistingConnections(providerId || null, toolkit || null);
  const authorize = useAuthorize();
  const disconnect = useDisconnectConnection();
  const isAdmin = useIsToolProviderAdmin();

  const providers = providersQuery.data?.providers ?? [];
  const toolkits = toolkitsQuery.data?.data ?? [];
  const connections = useMemo(() => connectionsQuery.data?.items ?? [], [connectionsQuery.data?.items]);
  const groupedByAuthor = useMemo(() => getGroupedConnectionsByAuthor(connections, isAdmin), [connections, isAdmin]);

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId);
    setToolkit('');
  };

  const handleConnect = () => {
    if (!providerId || !toolkit) return;
    authorize.mutate(
      { providerId, toolkit, label: label.trim() || null },
      {
        onSuccess: () => {
          setLabel('');
          void connectionsQuery.refetch();
        },
      },
    );
  };

  const handleDisconnect = (connectionId: string) => {
    disconnect.mutate({ providerId, connectionId });
  };

  return (
    <div className="max-w-3xl space-y-6 p-6 text-sm">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <p className="text-gray-500">
        Minimal page to verify the ToolProvider backend. Pick a provider and toolkit, then connect.
      </p>

      <ProviderToolkitSelector
        providers={providers}
        toolkits={toolkits}
        providerId={providerId}
        toolkit={toolkit}
        label={label}
        providersLoading={providersQuery.isLoading}
        providersError={providersQuery.error}
        toolkitsLoading={toolkitsQuery.isLoading}
        toolkitsError={toolkitsQuery.error}
        authorizePending={authorize.isPending}
        authorizeError={authorize.error}
        authorizedConnection={authorize.data}
        onProviderChange={handleProviderChange}
        onToolkitChange={setToolkit}
        onLabelChange={setLabel}
        onConnect={handleConnect}
      />

      <ExistingConnectionsPanel
        providerId={providerId}
        toolkit={toolkit}
        connections={connections}
        groupedByAuthor={groupedByAuthor}
        isAdmin={isAdmin}
        isLoading={connectionsQuery.isLoading}
        error={connectionsQuery.error}
        disconnectPending={disconnect.isPending}
        disconnectError={disconnect.error}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
