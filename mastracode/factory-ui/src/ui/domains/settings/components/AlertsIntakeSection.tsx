import { Button } from '@mastra/playground-ui/components/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useApiConfig } from '../../../../api/config';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useIntakeSelection } from '../hooks/useIntakeSelection';
import { IntakeProviderCard, toggleSource } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { LabelRoutedSourcePicker } from './label-routing/LabelRoutedSourcePicker';
import type { RoutingTerms } from './label-routing/terms';

export const MASTRA_ALERTS_INTEGRATION_ID = 'mastra-alerts';
const ALERTS_SOURCE_ID = 'alerts';
const STATUS_KEY = ['mastra-alerts', 'status'] as const;
const ROUTING_TERMS: RoutingTerms = {
  integrationId: MASTRA_ALERTS_INTEGRATION_ID,
  provider: 'Mastra Alerts',
  source: 'source',
  items: 'alerts',
};

export interface MastraAlertsStatus {
  enabled: boolean;
  configured: boolean;
  reason: 'ready' | 'missing_config' | 'organization_required' | 'auth_required';
  connected?: boolean;
}

/** Mastra Alerts status; a 404 means this deployment has no Platform credentials, so the integration isn't installed. */
export function useMastraAlertsStatusQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/web/mastra-alerts/status`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (res.status === 404) throw new Error('Mastra Alerts is not available on this server.');
      if (!res.ok && res.status !== 401) throw new Error(`Request failed (${res.status})`);
      return (await res.json()) as MastraAlertsStatus;
    },
    retry: false,
  });
}

function useConnectMastraAlertsMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${baseUrl}/web/mastra-alerts/connect`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function AlertsIntakeSection({
  config,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<MastraAlertsStatus> }) {
  const selection = useIntakeSelection(MASTRA_ALERTS_INTEGRATION_ID);
  const factories = useFactoriesQuery().data ?? [];
  const connect = useConnectMastraAlertsMutation();
  const alerts = config[MASTRA_ALERTS_INTEGRATION_ID] ?? { enabled: false, sourceIds: null };
  const connected = statusQuery.data?.connected === true;
  const description = statusQuery.isError
    ? "Couldn't load Mastra Alerts status."
    : connect.isError
      ? connect.error.message
      : !connected
        ? 'Connect to turn alerts from this organization into cards the Factory diagnoses.'
        : "Error and critical alerts become cards the Factory triages; re-fires update the same card. Route a Platform project's alerts with the label platform-project:<id>, and take warnings with severity:warning.";

  return (
    <IntakeProviderCard
      name="Mastra Alerts"
      icon={<SettingsIntegrationIcon provider="mastra-alerts" />}
      account={connected ? 'This organization' : undefined}
      listed={listed}
      description={description}
      connection={
        !statusQuery.isError &&
        !connected && (
          <Button size="sm" variant="default" disabled={connect.isPending} onClick={() => connect.mutate()}>
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </Button>
        )
      }
      action={
        statusQuery.isError && (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        )
      }
    >
      {(connected || Boolean(alerts.sourceIds?.length)) && (
        <LabelRoutedSourcePicker
          terms={ROUTING_TERMS}
          factories={factories}
          label="Alert sources"
          addLabel="Add alert source"
          itemIcon={<SettingsIntegrationIcon provider="mastra-alerts" />}
          groups={[{ id: 'mastra-alerts', items: [{ id: ALERTS_SOURCE_ID, label: 'Organization alerts' }] }]}
          selectedIds={alerts.sourceIds}
          saving={selection.saving}
          onToggleItem={id => selection.update(current => toggleSource(current, id))}
        />
      )}
    </IntakeProviderCard>
  );
}
