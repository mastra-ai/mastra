/**
 * Knowledge Importers settings section.
 *
 * Renders a card per knowledge-importer provider (Notion, Confluence, Linear,
 * Zendesk, Fireflies) with live connection status and a Connect / Reconnect
 * affordance. Reuses the `ProviderConnectControl` mutation +
 * `@nangohq/frontend` popup driver that Jira and incident.io already use, so
 * OAuth flows behave identically to the intake section.
 *
 * Each active connection carries a "Sync to" dropdown that routes its imports
 * to all Factory projects or an explicit subset. Toggles save immediately
 * (optimistic, with a toast + revert on failure) — no Save/Cancel choreography.
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
import { ChevronDown } from 'lucide-react';

import { Button } from '@mastra/playground-ui/components/Button';
import { Card } from '@mastra/playground-ui/components/Card';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/components/Toaster';
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
import type {
  KnowledgeImporterRouting,
  PlatformConnectProviderId,
  PlatformProviderConnection,
} from '../../factory/services/platformConnect';
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
  linear: 'Sync Linear documents — project docs, PRDs, and initiative docs — into knowledge.',
  zendesk: 'Sync Zendesk Help Center articles into knowledge.',
  fireflies: 'Sync Fireflies meeting transcripts and summaries into knowledge.',
};

/**
 * Per-connection "Sync to" routing dropdown. The trigger summarizes where the
 * connection's imports land ("All projects" / "1 of 3 projects"); the menu
 * offers an "All projects" item plus one checkbox per Factory project.
 *
 * Every toggle saves immediately through the routing PUT — optimistically, so
 * the menu never blocks on the network. A failed save reverts the summary and
 * raises a toast. The importer picks changes up on its next cron fire.
 *
 * An empty selection is valid: the connection stays established on the
 * Platform ("Sync to: No projects") and its imports simply land in no
 * Factory project until one is linked.
 */
function RoutingMenu({ provider, connectionId }: { provider: PlatformConnectProviderId; connectionId: string }) {
  const routingQuery = useKnowledgeImporterRoutingQuery(provider, connectionId);
  const factoriesQuery = useFactoriesQuery();
  const saveMutation = useSaveKnowledgeImporterRoutingMutation(provider, connectionId);
  // While a save is in flight the menu reflects the value being written, not
  // the (stale) cache. Cleared on settle: success writes the cache via the
  // mutation hook, failure reverts to the server copy.
  const [optimistic, setOptimistic] = useState<KnowledgeImporterRouting | null>(null);

  // A 403/404 means the feature isn't offered for this connection — an older
  // server without the routing routes, or a connection this provider doesn't
  // own — so the control hides rather than advertising a dead dropdown. A
  // transient failure (5xx, network) gets a retry instead, so a blip doesn't
  // silently hide where the connection syncs to.
  if (routingQuery.isError && isPlatformConnectUnavailableError(routingQuery.error)) return null;
  if (routingQuery.isError) {
    return (
      <span className="flex items-center gap-1">
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Couldn't load sync destinations.
        </Txt>
        <Button size="xs" variant="ghost" onClick={() => void routingQuery.refetch()}>
          Retry
        </Button>
      </span>
    );
  }
  if (routingQuery.isPending) return null;

  const routing = optimistic ?? routingQuery.data;
  const projects = factoriesQuery.data ?? [];
  const isAll = routing.mode === 'all';
  const selectedIds = new Set(isAll ? projects.map(p => p.id) : routing.projectIds);
  const selectedCount = projects.filter(p => selectedIds.has(p.id)).length;
  const summary = isAll
    ? 'All projects'
    : selectedCount === 0
      ? 'No projects'
      : `${selectedCount} of ${projects.length} project${projects.length === 1 ? '' : 's'}`;

  const commit = (next: KnowledgeImporterRouting) => {
    setOptimistic(next);
    saveMutation.mutate(next, {
      onSettled: () => setOptimistic(null),
      onError: () => toast.error("Couldn't update sync destinations — your previous selection is unchanged."),
    });
  };

  const toggleProject = (projectId: string) => {
    if (isAll) {
      // Narrowing from "all": everything except the toggled project. With a
      // single project this yields an (allowed) empty selection.
      commit({ mode: 'selected', projectIds: projects.filter(p => p.id !== projectId).map(p => p.id) });
      return;
    }
    const next = new Set(routing.projectIds);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    // Re-selecting every project is the same as "all" — store it that way so
    // projects created later are included automatically.
    if (projects.length > 0 && projects.every(p => next.has(p.id))) {
      commit({ mode: 'all', projectIds: [] });
      return;
    }
    commit({ mode: 'selected', projectIds: [...next] });
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger size="xs" variant="ghost" aria-label={`Sync to: ${summary}`}>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          Sync to
        </Txt>
        {summary}
        <ChevronDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-56">
        <DropdownMenu.Label>Sync destinations</DropdownMenu.Label>
        <DropdownMenu.CheckboxItem
          checked={isAll}
          closeOnClick={false}
          onCheckedChange={() => {
            if (!isAll) commit({ mode: 'all', projectIds: [] });
          }}
        >
          All projects
        </DropdownMenu.CheckboxItem>
        {projects.length > 0 && <DropdownMenu.Separator />}
        {projects.map(project => (
          <DropdownMenu.CheckboxItem
            key={project.id}
            checked={selectedIds.has(project.id)}
            closeOnClick={false}
            onCheckedChange={() => toggleProject(project.id)}
          >
            <span className="truncate">{project.name}</span>
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/**
 * One connection row: status dot, account label, relative connect time on the
 * left; routing dropdown and (when stale) a Reconnect button on the right.
 *
 * We never surface the raw connection id: if the Platform can't supply an
 * `accountLabel`, we fall back to "Connected by <displayName>".
 */
function ConnectionRow({
  provider,
  displayName,
  connection,
}: {
  provider: PlatformConnectProviderId;
  displayName: string;
  connection: PlatformProviderConnection;
}) {
  const needsReauth = connection.status === 'needs_reauth';
  const label = connection.accountLabel ?? `Connected by ${displayName}`;
  const connectedAt = connection.connectedAt ? relativeTime(connection.connectedAt) : '';
  return (
    <li className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
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
            · {connectedAt}
          </Txt>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {needsReauth ? (
          <ProviderConnectControl provider={provider} reconnectConnectionId={connection.id} label="Reconnect" size="xs" />
        ) : (
          <RoutingMenu provider={provider} connectionId={connection.id} />
        )}
      </span>
    </li>
  );
}

/**
 * One card per importer provider — logo, name, description, and either the
 * list of live connections (when connected) or a Connect button (when not).
 * The connection state is conveyed implicitly by the card contents: a card
 * with account rows is a connected card; a card with a Connect button isn't.
 * Each provider fetches independently so a transient failure on one doesn't
 * blank the grid.
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
      <header className="flex min-w-0 items-center gap-3">
        <IntegrationLogo provider={provider} displayName={meta.displayName} logoUrl={logoUrl ?? undefined} />
        <div className="min-w-0 flex-1">
          <Txt as="h4" variant="ui-md" className="text-icon6 font-semibold">
            {meta.displayName}
          </Txt>
        </div>
        {!isLoading && !isError && !isConnected && (
          <ProviderConnectControl provider={provider} label={`Connect ${meta.displayName}`} size="xs" />
        )}
      </header>
      <Txt as="p" variant="ui-xs" className="text-icon3">
        {description}
      </Txt>

      {isLoading && (
        <Txt as="span" variant="ui-xs" className="text-icon3 mt-auto border-t border-border1 pt-3">
          Loading connection status…
        </Txt>
      )}
      {isError && !unavailable && (
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border1 pt-3">
          <Txt as="span" variant="ui-xs" className="text-icon3">
            Couldn't load connections.
          </Txt>
          <Button size="xs" variant="ghost" onClick={() => void connectionsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {isError && unavailable && (
        <Txt as="span" variant="ui-xs" className="text-icon3 mt-auto border-t border-border1 pt-3">
          Platform connect isn't available in this deployment.
        </Txt>
      )}
      {!isLoading && !isError && isConnected && (
        <ul className="mt-auto flex flex-col gap-1 border-t border-border1 pt-2">
          {liveConnections.map(connection => (
            <ConnectionRow
              key={connection.id}
              provider={provider}
              displayName={meta.displayName}
              connection={connection}
            />
          ))}
        </ul>
      )}
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
