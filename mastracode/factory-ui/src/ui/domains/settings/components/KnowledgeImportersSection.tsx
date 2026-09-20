/**
 * Knowledge Importers settings section.
 *
 * Renders one row per knowledge-importer provider (Notion, Confluence, Linear,
 * Zendesk, Fireflies) with live connection status and a Connect / Reconnect
 * button. Reuses the same `ProviderConnectControl` /
 * `ProviderConnectionsList` primitives, the `useProviderConnection` hook, and
 * the `@nangohq/frontend` popup driver that Jira and incident.io already use
 * for intake — the only difference is the surface it's exposed on.
 *
 * Gated on `useServerFeatures().data?.knowledge === true`, which matches the
 * router-level gate for `KnowledgePage`. When the flag is absent or false the
 * component renders nothing so a non-platform Factory boot never surfaces a
 * dead "Connect Notion" button.
 *
 * Jira is intentionally excluded from this section because it's already
 * surfaced via the intake connections above — one Jira connection powers both
 * features, and listing it twice would confuse the connection-state
 * semantics.
 */

import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';

import { usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import {
  isPlatformConnectUnavailableError,
  KNOWLEDGE_IMPORTER_PROVIDER_IDS,
  PLATFORM_CONNECT_PROVIDERS,
} from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId } from '../../factory/services/platformConnect';
import { ProviderConnectControl, ProviderConnectionsList } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * One row per importer provider: name + connection status + Connect button.
 * Extracted so a transient connection-list error on one provider doesn't
 * blank the whole section — each provider fetches independently.
 */
function KnowledgeImporterRow({ provider }: { provider: PlatformConnectProviderId }) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const connectionsQuery = usePlatformConnectionsQuery(provider);

  if (connectionsQuery.isPending) {
    return (
      <SettingsRow
        label={meta.displayName}
        description="Loading connection status…"
      />
    );
  }

  if (connectionsQuery.isError) {
    // 403/404 → Platform connect isn't offered here (auth off or no Platform
    // credentials). We can still show the row with a Connect affordance
    // disabled; but the whole section is gated on the knowledge feature flag
    // upstream, so this branch is only reached for transient failures.
    if (isPlatformConnectUnavailableError(connectionsQuery.error)) {
      return (
        <SettingsRow label={meta.displayName} description="Platform connect isn't available in this deployment." />
      );
    }
    return (
      <SettingsRow
        label={meta.displayName}
        description="Couldn't load connections."
      >
        <Button size="xs" variant="ghost" onClick={() => void connectionsQuery.refetch()}>
          Retry
        </Button>
      </SettingsRow>
    );
  }

  const connections = connectionsQuery.data;
  const active = connections.filter(connection => connection.status === 'active');
  const needsReauth = connections.some(connection => connection.status === 'needs_reauth');

  const description = (() => {
    if (connections.length === 0) return `Sync ${meta.displayName} into knowledge.`;
    if (needsReauth) return `A ${meta.displayName} account needs to be reconnected to keep syncing.`;
    if (active.length === 1) return active[0]?.accountLabel ?? `${meta.displayName} connected`;
    return `${active.length} ${meta.displayName} accounts connected`;
  })();

  return (
    <>
      <SettingsRow label={meta.displayName} description={description}>
        {connections.length === 0 ? (
          <ProviderConnectControl provider={provider} label={`Connect ${meta.displayName}`} size="xs" />
        ) : (
          <ProviderConnectControl provider={provider} label="Connect another" size="xs" variant="ghost" />
        )}
      </SettingsRow>
      {connections.length > 0 && <ProviderConnectionsList provider={provider} connections={connections} />}
    </>
  );
}

/**
 * Composed subsection listing every knowledge-importer provider. Renders
 * nothing when the server hasn't lit up the knowledge feature flag.
 */
export function KnowledgeImportersSection() {
  const features = useServerFeatures();
  if (features.data?.knowledge !== true) return null;
  return (
    <SettingsSubsection
      scope="org"
      title="Knowledge importers"
      description="Connect a source to sync into knowledge. Each active connection starts syncing on the next importer tick."
    >
      <SettingsContainer>
        {KNOWLEDGE_IMPORTER_PROVIDER_IDS.map(provider => (
          <KnowledgeImporterRow key={provider} provider={provider} />
        ))}
      </SettingsContainer>
    </SettingsSubsection>
  );
}
