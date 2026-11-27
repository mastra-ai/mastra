import { VantaIntakeCard, vantaSourcesEnabled } from '@mastra/playground-ui/domains/factory';
import type { VantaIntakeStatus } from '@mastra/playground-ui/domains/factory';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useApiConfig } from '../../../../api/config';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';

export type VantaStatus = VantaIntakeStatus;

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
  const sourcesQuery = useVantaSourcesQuery(vantaSourcesEnabled(statusQuery.data, connectionsQuery.data));
  return (
    <VantaIntakeCard
      config={config}
      listed={listed}
      selection={selection}
      statusQuery={statusQuery}
      connectionsQuery={connectionsQuery}
      sourcesQuery={sourcesQuery}
      renderPicker={picker => <RoutedSourcePicker {...picker} factories={factories} />}
    />
  );
}
