import { Button } from '@mastra/playground-ui/components/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useIncidentioSourcesQuery } from '../../../../hooks/useIncidentioData';
import type { IncidentioStatus } from '../../factory/services/incidentio';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';
import type { PlatformProviderConnection } from '../../factory/services/platformConnect';
import type { FactoryProject } from '../../workspaces/services/github';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SourcePicker } from './IntakeSourcePicker';
import { IntakeSourceRouting } from './LinearRouting';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function isIncidentioDirectConfigured(status: IncidentioStatus | undefined) {
  return Boolean(status?.enabled && status.configured && status.mode === 'api-key' && status.reason === 'ready');
}

export function IncidentioIntakeSection({
  config,
  busy,
  update,
  factories,
  statusQuery,
  connectionsQuery,
}: IntakeSectionProps & {
  factories: FactoryProject[];
  statusQuery: UseQueryResult<IncidentioStatus>;
  connectionsQuery: UseQueryResult<PlatformProviderConnection[]>;
}) {
  const directConfigured = isIncidentioDirectConfigured(statusQuery.data);
  const connections = connectionsQuery.data ?? [];
  const active = connections.filter(connection => connection.status === 'active');
  const credentialActive = directConfigured || active.length > 0;
  const sourcesQuery = useIncidentioSourcesQuery(credentialActive);
  const sources = sourcesQuery.data ?? [];
  const platformUnavailable = connectionsQuery.isError && isPlatformConnectUnavailableError(connectionsQuery.error);
  if (platformUnavailable && !directConfigured) return null;
  const description = connectionDescription();
  function connectionDescription() {
    if (connectionsQuery.isPending || statusQuery.isPending) return 'Checking the incident.io connection…';
    if (!directConfigured && connectionsQuery.isError && !platformUnavailable)
      return "Couldn't load incident.io connections.";
    if (statusQuery.isError && !active.length) return "Couldn't load incident.io status.";
    if (!directConfigured && connections.some(connection => connection.status === 'needs_reauth'))
      return 'An incident.io account needs to be reconnected to keep syncing follow-ups.';
    if (!credentialActive) return 'Connect incident.io to sync follow-ups.';
    return undefined;
  }
  const account = directConfigured
    ? 'incident.io API key configured on this server'
    : connections.map(connection => connection.accountLabel ?? connection.id).join(', ');
  const connected =
    credentialActive ||
    connections.length > 0 ||
    connectionsQuery.isPending ||
    statusQuery.isPending ||
    (!platformUnavailable && connectionsQuery.isError) ||
    statusQuery.isError;
  const unavailable = !directConfigured && (connectionsQuery.isError || statusQuery.isError);
  return (
    <IntakeProviderCard
      name="incident.io"
      icon={<SettingsIntegrationIcon provider="incidentio" />}
      account={account}
      connected={connected}
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
      {credentialActive && config.incidentio.enabled && (
        <>
          <SourcePicker
            label="Follow-up sources"
            addLabel="Add follow-up source"
            itemIcon={<SettingsIntegrationIcon provider="incidentio" />}
            groups={[
              { id: 'incidentio-follow-ups', items: sources.map(source => ({ id: source.id, label: source.name })) },
            ]}
            selectedIds={config.incidentio.sourceIds}
            disabled={busy}
            pending={busy}
            loading={sourcesQuery.isPending}
            error={sourcesQuery.isError ? "Couldn't load follow-up sources." : undefined}
            onRetry={() => void sourcesQuery.refetch()}
            onToggleItem={id =>
              update({
                ...config,
                incidentio: { ...config.incidentio, sourceIds: toggleSourceId(config.incidentio.sourceIds, id) },
              })
            }
          />
          {!sourcesQuery.isError && (
            <IntakeSourceRouting
              integrationId="incidentio"
              label="incident.io"
              sourceIds={config.incidentio.sourceIds ?? []}
              sources={sources}
              factories={factories}
            />
          )}
        </>
      )}
    </IntakeProviderCard>
  );
}
