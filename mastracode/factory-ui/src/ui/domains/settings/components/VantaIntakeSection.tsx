import { Button } from '@mastra/playground-ui/components/Button';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useApiConfig } from '../../../../api/config';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';
import { connectionName, PlatformConnectButton, PlatformConnectionActions } from './PlatformProviderConnections';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export interface VantaStatus {
  enabled: boolean;
  configured: boolean;
  reason: 'ready' | 'missing_config' | 'organization_required' | 'auth_required';
}

interface VantaSource {
  id: string;
  name: string;
  integrationId: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (res.status === 404) throw new Error('Vanta intake is not available on this server.');
  if (!res.ok && res.status !== 401) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Vanta status; a 404 means this deployment has no Platform credentials, so Vanta isn't installed. */
export function useVantaStatusQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: ['vanta', 'status'],
    queryFn: () => getJson<VantaStatus>(`${baseUrl}/web/vanta/status`),
    retry: false,
  });
}

function useVantaSourcesQuery(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: ['vanta', 'sources'],
    queryFn: async () => {
      const response = await getJson<{
        sources?: VantaSource[];
        failures?: { integrationId: string; message: string }[];
      }>(`${baseUrl}/web/intake/sources?integrationId=vanta`);
      const failure = response.failures?.find(entry => entry.integrationId === 'vanta');
      if (failure) throw new Error(failure.message);
      return (response.sources ?? []).filter(source => source.integrationId === 'vanta');
    },
    enabled,
  });
}

export function VantaIntakeSection({
  config,
  listed,
  statusQuery,
  connectionsQuery,
}: IntakeSectionProps & {
  statusQuery: UseQueryResult<VantaStatus>;
  connectionsQuery: UseQueryResult<PlatformProviderConnection[]>;
}) {
  const selection = useIntakeSelection('vanta');
  const factories = useFactoriesQuery().data ?? [];
  const vanta = config.vanta ?? { enabled: false, sourceIds: null };
  const ready = statusQuery.data?.reason === 'ready';
  const connections = connectionsQuery.data ?? [];
  const connected = connections.some(connection => connection.status === 'active');
  const sourcesQuery = useVantaSourcesQuery(ready && connected);
  const sources = sourcesQuery.data ?? [];
  const unavailable = connectionsQuery.isError || statusQuery.isError;
  const description = connectionsQuery.isError
    ? "Couldn't load Vanta connections."
    : statusQuery.isError
      ? "Couldn't load Vanta status."
      : connections.some(connection => connection.status === 'needs_reauth')
        ? 'A Vanta account needs to be reconnected to keep syncing vulnerabilities.'
        : !connected
          ? 'Connect Vanta to sync vulnerabilities.'
          : undefined;

  return (
    <IntakeProviderCard
      name="Vanta"
      icon={<SettingsIntegrationIcon provider="vanta" />}
      account={connections.map(connectionName).join(', ')}
      listed={listed}
      description={description}
      connection={
        !unavailable &&
        (listed ? (
          <PlatformConnectionActions provider="vanta" connections={connections} />
        ) : (
          <PlatformConnectButton provider="vanta" />
        ))
      }
      syncControl={
        <IntakeSyncControl
          label="Sync vulnerabilities"
          accessibleLabel="Sync Vanta vulnerabilities"
          description="Active Vanta vulnerabilities become security-labeled cards."
          checked={vanta.enabled}
          disabled={!connected}
          onCheckedChange={enabled => selection.update(current => ({ ...current, enabled }))}
        />
      }
      action={
        (unavailable || sourcesQuery.isError) && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => {
              void connectionsQuery.refetch();
              void statusQuery.refetch();
              void sourcesQuery.refetch();
            }}
          >
            Retry
          </Button>
        )
      }
    >
      {vanta.enabled && (connected || Boolean(vanta.sourceIds?.length)) && (
        <RoutedSourcePicker
          integrationId="vanta"
          routingLabel="Vanta"
          factories={factories}
          label="Vulnerability sources"
          addLabel="Add vulnerability source"
          itemIcon={<SettingsIntegrationIcon provider="vanta" />}
          groups={[
            { id: 'vanta-vulnerabilities', items: sources.map(source => ({ id: source.id, label: source.name })) },
          ]}
          selectedIds={vanta.sourceIds}
          saving={selection.saving}
          loading={ready && sourcesQuery.isPending}
          error={sourcesQuery.isError ? "Couldn't load Vanta sources." : undefined}
          onRetry={() => void sourcesQuery.refetch()}
          onToggleItem={id =>
            selection.update(current => ({ ...current, sourceIds: toggleSourceId(current.sourceIds, id) }))
          }
        />
      )}
    </IntakeProviderCard>
  );
}
