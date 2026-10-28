import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useIncidentioSourcesQuery } from '../../../../hooks/useIncidentioData';
import type { IncidentioStatus } from '../../factory/services/incidentio';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

// A deployment API key serves follow-ups without a Platform connection.
export function isIncidentioDirectConfigured(status: IncidentioStatus | undefined) {
  return Boolean(status?.enabled && status.configured && status.mode === 'api-key' && status.reason === 'ready');
}

export function IncidentioIntakeSection({
  config,
  busy,
  update,
  listed,
  statusQuery,
  connectionsQuery,
}: IntakeSectionProps & {
  statusQuery: UseQueryResult<IncidentioStatus>;
  connectionsQuery: UseQueryResult<PlatformProviderConnection[]>;
}) {
  const factories = useFactoriesQuery().data ?? [];
  const directConfigured = isIncidentioDirectConfigured(statusQuery.data);
  const connections = connectionsQuery.data ?? [];
  const active = connections.filter(connection => connection.status === 'active');
  const credentialActive = directConfigured || active.length > 0;
  const sourcesQuery = useIncidentioSourcesQuery(credentialActive);
  const sources = sourcesQuery.data ?? [];
  const description = connectionDescription();
  function connectionDescription() {
    if (!directConfigured && connectionsQuery.isError) return "Couldn't load incident.io connections.";
    if (statusQuery.isError && !active.length) return "Couldn't load incident.io status.";
    if (!directConfigured && connections.some(connection => connection.status === 'needs_reauth')) {
      return 'An incident.io account needs to be reconnected to keep syncing follow-ups.';
    }
    if (!credentialActive) return 'Connect incident.io to sync follow-ups.';
    return undefined;
  }
  const account = directConfigured
    ? 'incident.io API key configured on this server'
    : connections.map(connection => connection.accountLabel ?? connection.id).join(', ');
  const unavailable = !directConfigured && (connectionsQuery.isError || statusQuery.isError);
  return (
    <IntakeProviderCard
      name="incident.io"
      icon={<SettingsIntegrationIcon provider="incidentio" />}
      account={account}
      listed={listed}
      description={description}
      syncControl={
        <IntakeSyncControl
          label="Sync follow-ups"
          accessibleLabel="Sync incident.io follow-ups"
          description="Outstanding follow-ups feed your board. Incidents stay out of intake."
          checked={config.incidentio.enabled}
          disabled={busy || !credentialActive}
          onCheckedChange={enabled => update({ ...config, incidentio: { ...config.incidentio, enabled } })}
        />
      }
      action={
        unavailable && (
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => {
              void connectionsQuery.refetch();
              void statusQuery.refetch();
            }}
          >
            Retry
          </Button>
        )
      }
    >
      {(directConfigured || connections.length > 0) && (
        <SettingsRow
          label="Incident board configuration"
          description="Configure a dedicated board for incident response."
        >
          <Badge size="sm" variant="neutral">
            Coming soon
          </Badge>
        </SettingsRow>
      )}
      {config.incidentio.enabled && (credentialActive || Boolean(config.incidentio.sourceIds?.length)) && (
        <RoutedSourcePicker
          integrationId="incidentio"
          routingLabel="incident.io"
          factories={factories}
          label="Follow-up sources"
          addLabel="Add follow-up source"
          itemIcon={<SettingsIntegrationIcon provider="incidentio" />}
          groups={[
            {
              id: 'incidentio-follow-ups',
              items: sources.map(source => ({ id: source.id, label: source.name })),
            },
          ]}
          selectedIds={config.incidentio.sourceIds}
          pending={busy}
          loading={credentialActive && sourcesQuery.isPending}
          error={
            !credentialActive
              ? 'Reconnect incident.io to add follow-up sources.'
              : sourcesQuery.isError
                ? "Couldn't load follow-up sources."
                : undefined
          }
          onRetry={credentialActive ? () => void sourcesQuery.refetch() : undefined}
          onToggleItem={id =>
            update({
              ...config,
              incidentio: { ...config.incidentio, sourceIds: toggleSourceId(config.incidentio.sourceIds, id) },
            })
          }
        />
      )}
    </IntakeProviderCard>
  );
}
