/**
 * Knowledge Importers settings section.
 *
 * Renders a card per knowledge-importer provider (Notion, Confluence, Linear,
 * Zendesk, Fireflies) with live connection status and a Connect / Manage
 * affordance. Reuses the `ProviderConnectControl` mutation +
 * `@nangohq/frontend` popup driver that Jira and incident.io already use, so
 * OAuth flows behave identically to the intake section.
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

import { useMemo } from 'react';

import { Card } from '@mastra/playground-ui/components/Card';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { usePlatformCatalogQuery, usePlatformConnectionsQuery } from '../../../../hooks/usePlatformConnections';
import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { IntegrationLogo } from '../../../ui/IntegrationLogo';
import {
  isPlatformConnectUnavailableError,
  KNOWLEDGE_IMPORTER_PROVIDER_IDS,
  PLATFORM_CONNECT_PROVIDERS,
} from '../../factory/services/platformConnect';
import type { PlatformConnectProviderId, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { ProviderConnectControl } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * Per-provider one-line description shown under the provider name. The
 * brand mark itself is fetched at runtime via `IntegrationLogo` so we don't
 * need to ship SVG assets here.
 */
const PROVIDER_DESCRIPTIONS: Record<PlatformConnectProviderId, string> = {
  jira: 'Sync Jira issues and comments into knowledge.',
  'incident-io': 'Sync incident.io incidents and follow-ups into knowledge.',
  notion: 'Sync Notion pages and databases into knowledge.',
  confluence: 'Sync Confluence spaces and pages into knowledge.',
  linear: 'Sync Linear issues, projects, and comments into knowledge.',
  zendesk: 'Sync Zendesk tickets and conversations into knowledge.',
  fireflies: 'Sync Fireflies meeting transcripts and summaries into knowledge.',
};

/**
 * Render the list of active + needs-reauth connections for a provider. The
 * card's connected-vs-not state is conveyed implicitly by the presence of
 * this list (connected) or a bare Connect button (not connected) — no
 * "Not connected" / "Not yet connected" copy on the card itself.
 */
function ConnectionLabels({
  provider,
  connections,
}: {
  provider: PlatformConnectProviderId;
  connections: PlatformProviderConnection[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {connections.map(connection => {
        const needsReauth = connection.status === 'needs_reauth';
        return (
          <li key={connection.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${needsReauth ? 'bg-red-400' : 'bg-emerald-400'}`}
              />
              <Txt as="span" variant="ui-sm" className="text-icon5 truncate">
                {connection.accountLabel ?? connection.id}
              </Txt>
            </span>
            {needsReauth && (
              <ProviderConnectControl
                provider={provider}
                reconnectConnectionId={connection.id}
                label="Reconnect"
                size="xs"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One card per importer provider — logo, name, description, and either the
 * list of live connections (when connected) or a Connect button (when not).
 * The connection state is conveyed implicitly by the card contents: a card
 * with account labels is a connected card; a card with a Connect button
 * isn't. Each provider fetches independently so a transient failure on one
 * doesn't blank the grid.
 */
function KnowledgeImporterCard({ provider, logoUrl }: { provider: PlatformConnectProviderId; logoUrl: string | null }) {
  const meta = PLATFORM_CONNECT_PROVIDERS[provider];
  const description = PROVIDER_DESCRIPTIONS[provider];
  const connectionsQuery = usePlatformConnectionsQuery(provider);

  const isLoading = connectionsQuery.isPending;
  const isError = connectionsQuery.isError;
  const unavailable = isError && isPlatformConnectUnavailableError(connectionsQuery.error);
  const connections = connectionsQuery.data ?? [];
  const liveConnections = connections.filter(c => c.status === 'active' || c.status === 'needs_reauth');
  const isConnected = liveConnections.length > 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <header className="flex min-w-0 items-start gap-3">
        <IntegrationLogo provider={provider} displayName={meta.displayName} logoUrl={logoUrl ?? undefined} />
        <div className="min-w-0">
          <Txt as="h4" variant="ui-md" className="text-icon6 font-semibold">
            {meta.displayName}
          </Txt>
          <Txt as="p" variant="ui-sm" className="text-icon3 mt-0.5">
            {description}
          </Txt>
        </div>
      </header>

      <div className="mt-auto border-t border-border1 pt-3">
        {isLoading && (
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Loading connection status…
          </Txt>
        )}
        {isError && !unavailable && (
          <div className="flex items-center justify-between gap-2">
            <Txt as="span" variant="ui-xs" className="text-icon3">
              Couldn't load connections.
            </Txt>
            <Button size="xs" variant="ghost" onClick={() => void connectionsQuery.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {isError && unavailable && (
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Platform connect isn't available in this deployment.
          </Txt>
        )}
        {!isLoading && !isError && (
          isConnected ? (
            <ConnectionLabels provider={provider} connections={liveConnections} />
          ) : (
            <ProviderConnectControl provider={provider} label={`Connect ${meta.displayName}`} size="xs" />
          )
        )}
      </div>
    </Card>
  );
}

/**
 * Composed subsection rendering every knowledge-importer provider as a card
 * grid. Renders nothing when the server hasn't lit up the knowledge feature
 * flag.
 */
export function KnowledgeImportersSection() {
  const features = useServerFeatures();
  const catalogQuery = usePlatformCatalogQuery(features.data?.knowledge === true);
  // Index the catalog once — every card looks its `logoUrl` up by slug so the
  // Platform's catalog fetch happens once for the whole grid. Memoize so an
  // unrelated re-render doesn't rebuild the map (five iterations × parent
  // re-render adds up in practice).
  const logoByProvider = useMemo(
    () => new Map<string, string | null>((catalogQuery.data ?? []).map(entry => [entry.provider, entry.logoUrl])),
    [catalogQuery.data],
  );
  if (features.data?.knowledge !== true) return null;
  return (
    <SettingsSubsection
      scope="org"
      title="Knowledge importers"
      description="Connect a source to sync into knowledge. Each active connection starts syncing on the next importer tick."
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {KNOWLEDGE_IMPORTER_PROVIDER_IDS.map(provider => (
          <KnowledgeImporterCard key={provider} provider={provider} logoUrl={logoByProvider.get(provider) ?? null} />
        ))}
      </div>
    </SettingsSubsection>
  );
}
