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

import { useMemo, useState } from 'react';

import { Card } from '@mastra/playground-ui/components/Card';
import { Button } from '@mastra/playground-ui/components/Button';
import { Checkbox } from '@mastra/playground-ui/components/Checkbox';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import {
  useKnowledgeImporterRoutingQuery,
  usePlatformCatalogQuery,
  usePlatformConnectionsQuery,
  useSaveKnowledgeImporterRoutingMutation,
} from '../../../../hooks/usePlatformConnections';
import { useServerFeatures } from '../../../../hooks/useServerFeatures';
import { relativeTime } from '../../../../lib/date/relativeTime';
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
 * Per-connection "Sync to" control. Collapsed it summarizes where the
 * connection's imports land ("Syncs to all projects" / "Syncs to 2 of 5
 * projects") with a Change affordance; expanded it offers an All-projects
 * toggle plus a per-project checkbox list, saved through the routing PUT.
 * The importer picks the change up on its next cron fire — no restart.
 */
function ConnectionRoutingControl({
  provider,
  connectionId,
}: {
  provider: PlatformConnectProviderId;
  connectionId: string;
}) {
  const routingQuery = useKnowledgeImporterRoutingQuery(provider, connectionId);
  const factoriesQuery = useFactoriesQuery();
  const saveMutation = useSaveKnowledgeImporterRoutingMutation(provider, connectionId);
  const [editing, setEditing] = useState(false);
  const [draftAll, setDraftAll] = useState(true);
  const [draftIds, setDraftIds] = useState<ReadonlySet<string>>(new Set());

  // A 403/404 means the feature isn't offered for this connection — an
  // older server without the routing routes, or a connection this provider
  // doesn't own — so the control hides rather than advertising a dead
  // Change button. A transient failure (5xx, network) gets a retry instead,
  // so a blip doesn't silently hide where the connection syncs to.
  if (routingQuery.isError && isPlatformConnectUnavailableError(routingQuery.error)) return null;
  if (routingQuery.isError) {
    return (
      <div className="flex items-center justify-between gap-2">
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Couldn't load sync destinations.
        </Txt>
        <Button size="xs" variant="ghost" onClick={() => void routingQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  if (routingQuery.isPending) return null;

  const routing = routingQuery.data;
  const projects = factoriesQuery.data ?? [];
  const selectedCount =
    routing.mode === 'all' ? projects.length : projects.filter(p => routing.projectIds.includes(p.id)).length;
  const summary =
    routing.mode === 'all'
      ? 'Syncs to all projects'
      : `Syncs to ${selectedCount} of ${projects.length} project${projects.length === 1 ? '' : 's'}`;

  const beginEditing = () => {
    saveMutation.reset();
    setDraftAll(routing.mode === 'all');
    setDraftIds(new Set(routing.projectIds));
    setEditing(true);
  };

  const save = () => {
    saveMutation.mutate(
      draftAll ? { mode: 'all', projectIds: [] } : { mode: 'selected', projectIds: [...draftIds] },
      { onSuccess: () => setEditing(false) },
    );
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {summary}
        </Txt>
        <Button size="xs" variant="ghost" onClick={beginEditing}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={draftAll} onCheckedChange={() => setDraftAll(current => !current)} />
        <Txt as="span" variant="ui-sm" className="text-icon5">
          All projects
        </Txt>
      </label>
      {!draftAll && (
        <ul className="flex flex-col gap-1 pl-1">
          {projects.map(project => (
            <li key={project.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={draftIds.has(project.id)}
                  onCheckedChange={() =>
                    setDraftIds(current => {
                      const next = new Set(current);
                      if (next.has(project.id)) next.delete(project.id);
                      else next.add(project.id);
                      return next;
                    })
                  }
                />
                <Txt as="span" variant="ui-sm" className="text-icon5 truncate">
                  {project.name}
                </Txt>
              </label>
            </li>
          ))}
          {projects.length === 0 && (
            <Txt as="span" variant="ui-xs" className="text-icon3">
              No projects yet.
            </Txt>
          )}
        </ul>
      )}
      {saveMutation.isError && (
        <Txt as="span" variant="ui-xs" className="text-red-400">
          Couldn't save routing. Try again.
        </Txt>
      )}
      <div className="flex items-center gap-2">
        <Button
          size="xs"
          onClick={save}
          disabled={saveMutation.isPending || (!draftAll && draftIds.size === 0)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button size="xs" variant="ghost" onClick={() => setEditing(false)} disabled={saveMutation.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Render the list of active + needs-reauth connections for a provider. The
 * card's connected-vs-not state is conveyed implicitly by the presence of
 * this list (connected) or a bare Connect button (not connected) — no
 * "Not connected" / "Not yet connected" copy on the card itself.
 *
 * We never surface the raw connection id: if the Platform can't supply an
 * `accountLabel`, we fall back to "Connected by <displayName>". The
 * connection's `connectedAt` timestamp — when present — is rendered as a
 * compact relative time so users can see how fresh each connection is.
 */
function ConnectionLabels({
  provider,
  displayName,
  connections,
}: {
  provider: PlatformConnectProviderId;
  displayName: string;
  connections: PlatformProviderConnection[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {connections.map(connection => {
        const needsReauth = connection.status === 'needs_reauth';
        const label = connection.accountLabel ?? `Connected by ${displayName}`;
        const connectedAt = connection.connectedAt ? relativeTime(connection.connectedAt) : '';
        return (
          <li key={connection.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${needsReauth ? 'bg-red-400' : 'bg-emerald-400'}`}
                />
                <Txt as="span" variant="ui-sm" className="text-icon5 truncate">
                  {label}
                </Txt>
                {connectedAt && (
                  <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0">
                    · Connected at: {connectedAt}
                  </Txt>
                )}
              </span>
              {needsReauth && (
                <ProviderConnectControl
                  provider={provider}
                  reconnectConnectionId={connection.id}
                  label="Reconnect"
                  size="xs"
                />
              )}
            </div>
            <div className="pl-3.5">
              <ConnectionRoutingControl provider={provider} connectionId={connection.id} />
            </div>
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
            <ConnectionLabels provider={provider} displayName={meta.displayName} connections={liveConnections} />
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
