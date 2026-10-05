import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import {
  useAuthorize,
  useDisconnectConnection,
  useExistingConnections,
  useToolProviders,
  useToolkits,
} from '@mastra/react/hooks';
import { useMemo, useState } from 'react';
import { ExistingConnectionsPanel } from './components/existing-connections-panel';
import { ProviderToolkitSelector } from './components/provider-toolkit-selector';
import { getGroupedConnectionsByAuthor } from './group-connections';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import type { CrumbDef } from '@/domains/navigation/crumbs';
import { useIsToolProviderAdmin } from '@/domains/tool-providers/hooks/use-is-tool-provider-admin';

const crumbs: CrumbDef[] = [{ id: 'integrations', label: 'Integrations' }];

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
  const toolkitsQuery = useToolkits({ providerId: providerId || null, queryOptions: { enabled: !!providerId } });
  const connectionsQuery = useExistingConnections({ providerId: providerId || null, toolkit: toolkit || null });
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
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Integrations</h1>
      <div className="max-w-3xl space-y-6 text-body">
        <p className="text-muted-foreground">
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
    </PageLayout>
  );
}
