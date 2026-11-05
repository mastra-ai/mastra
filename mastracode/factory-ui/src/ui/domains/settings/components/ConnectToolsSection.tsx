import { Button } from '@mastra/playground-ui/components/Button';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { SearchInput } from '@mastra/playground-ui/components/SearchInput';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { supportsHeadlessAuth } from '@mastra/playground-ui/domains/connect/headless-connect';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Blocks, Check, Link2, Plus } from 'lucide-react';
import { useId, useState } from 'react';

import type { ConnectToolsSettings } from '../../../../api/types';
import { useConnectToolsQuery, useSetConnectToolProviderMutation } from '../../../../hooks/useConnectTools';
import { useAllPlatformConnectionsQuery, usePlatformCatalogQuery } from '../../../../hooks/usePlatformConnections';
import { SettingsRowsSkeleton } from '../../../ui/SettingsRowsSkeleton';
import { isPlatformConnectUnavailableError } from '../../factory/services/platformConnect';
import type { PlatformCatalogProvider, PlatformProviderConnection } from '../../factory/services/platformConnect';
import { connectionName, ProviderConnectControl } from './PlatformProviderConnections';
import { SettingsSubsection } from './SettingsSubsection';
import { NotConfiguredRow, RetryRow } from './common/ConnectionStateRows';

const SECTION_LABEL = 'Mastra Connect';

interface ConnectedProvider {
  provider: PlatformCatalogProvider;
  connections: PlatformProviderConnection[];
}

export function ConnectToolsSection() {
  const settingsQuery = useConnectToolsQuery();
  const settings = settingsQuery.data;
  const available = settings?.available === true;
  const catalogQuery = usePlatformCatalogQuery(available);
  const connectionsQuery = useAllPlatformConnectionsQuery(available);
  const [adding, setAdding] = useState(false);
  const listId = useId();
  const loaded = catalogQuery.isSuccess && connectionsQuery.isSuccess;

  return (
    <SettingsSubsection
      scope="org"
      title="Mastra Connect tools"
      description={
        settings?.canEdit === false
          ? 'Sessions run enabled tools without asking for approval. Only organization admins can change this.'
          : 'Sessions run enabled tools without asking for approval.'
      }
      action={
        available &&
        loaded && (
          <Button
            size="sm"
            icon={adding ? <Check /> : <Plus />}
            aria-expanded={adding}
            aria-controls={listId}
            onClick={() => setAdding(!adding)}
          >
            {adding ? 'Done' : 'Add provider'}
          </Button>
        )
      }
    >
      <div id={listId} className="flex flex-col gap-3">
        {settingsQuery.isPending ? (
          <SettingsContainer>
            <SettingsRowsSkeleton label="Loading Mastra Connect tools" />
          </SettingsContainer>
        ) : settingsQuery.isError ? (
          <SettingsContainer>
            <RetryRow
              label={SECTION_LABEL}
              errorMsg="Couldn't load tool settings."
              onRetry={() => void settingsQuery.refetch()}
            />
          </SettingsContainer>
        ) : !settingsQuery.data.available ? (
          <SettingsContainer>
            <NotConfiguredRow
              label={SECTION_LABEL}
              showAvailable
              description={
                <>
                  Set <InlineCode>MASTRA_PLATFORM_SECRET_KEY</InlineCode> and <InlineCode>MASTRA_PROJECT_ID</InlineCode>{' '}
                  on this server to use Mastra Connect tools.
                </>
              }
            />
          </SettingsContainer>
        ) : catalogQuery.isPending || connectionsQuery.isPending ? (
          <SettingsContainer>
            <SettingsRowsSkeleton label="Loading Mastra Connect providers" />
          </SettingsContainer>
        ) : catalogQuery.isError || connectionsQuery.isError ? (
          <SettingsContainer>
            {isPlatformConnectUnavailableError(catalogQuery.error ?? connectionsQuery.error) ? (
              <NotConfiguredRow label={SECTION_LABEL} showAvailable />
            ) : (
              <RetryRow
                label={SECTION_LABEL}
                errorMsg="Couldn't load Mastra Connect providers."
                onRetry={() => {
                  if (catalogQuery.isError) void catalogQuery.refetch();
                  if (connectionsQuery.isError) void connectionsQuery.refetch();
                }}
              />
            )}
          </SettingsContainer>
        ) : (
          <ProviderLists
            settings={settingsQuery.data}
            catalog={catalogQuery.data}
            connections={connectionsQuery.data}
            adding={adding}
          />
        )}
      </div>
    </SettingsSubsection>
  );
}

function ProviderLists({
  settings,
  catalog,
  connections,
  adding,
}: {
  settings: ConnectToolsSettings;
  catalog: PlatformCatalogProvider[];
  connections: PlatformProviderConnection[];
  adding: boolean;
}) {
  const connected = connectedProviders(catalog, connections);
  const connectedIds = new Set(connected.map(entry => entry.provider.id));
  return (
    <>
      {connected.length > 0 && (
        <SettingsContainer>
          {connected.map(entry => (
            <ConnectedProviderRow key={entry.provider.id} entry={entry} settings={settings} />
          ))}
        </SettingsContainer>
      )}
      {adding && (
        <AddProviderList
          providers={catalog.filter(
            provider => !connectedIds.has(provider.id) && supportsHeadlessAuth(provider.authType, provider.authFields),
          )}
        />
      )}
    </>
  );
}

function connectedProviders(
  catalog: PlatformCatalogProvider[],
  connections: PlatformProviderConnection[],
): ConnectedProvider[] {
  const byId = new Map<string, ConnectedProvider>();
  for (const connection of connections) {
    const entry = byId.get(connection.integrationId);
    if (entry) {
      entry.connections.push(connection);
      continue;
    }
    const provider = catalog.find(candidate => candidate.id === connection.integrationId) ?? {
      id: connection.integrationId,
      displayName: connection.integrationId,
      logoUrl: null,
      authType: null,
      mcp: false,
      authFields: [],
    };
    byId.set(connection.integrationId, { provider, connections: [connection] });
  }
  return [...byId.values()].sort((a, b) => a.provider.displayName.localeCompare(b.provider.displayName));
}

function ConnectedProviderRow({ entry, settings }: { entry: ConnectedProvider; settings: ConnectToolsSettings }) {
  const { provider, connections } = entry;
  const setProvider = useSetConnectToolProviderMutation();
  const enabled = settings.enabledProviders.includes(provider.id);
  const usable = connections.some(connection => connection.status === 'active');
  const reauth = connections.find(connection => connection.status === 'needs_reauth');

  const toggle = (on: boolean) =>
    setProvider.mutate(
      { providerId: provider.id, enabled: on },
      {
        onError: error =>
          toast.error(`Couldn't turn ${on ? 'on' : 'off'} ${provider.displayName} tools: ${error.message}`),
      },
    );

  return (
    <SettingsRow
      label={<ProviderLabel provider={provider} />}
      description={connections.map(connectionName).join(', ')}
      errorMsg={reauth ? 'Needs reauthorization' : usable ? undefined : 'Not connected'}
    >
      <div className="flex items-center gap-2">
        {reauth && (
          <ProviderConnectControl
            provider={provider}
            reconnectConnectionId={reauth.id}
            label={`Reconnect ${provider.displayName}`}
            buttonLabel="Reconnect"
            icon={<Link2 />}
          />
        )}
        <Switch
          aria-label={`${provider.displayName} tools`}
          checked={enabled}
          disabled={!settings.canEdit || (!enabled && !usable)}
          onCheckedChange={toggle}
        />
      </div>
    </SettingsRow>
  );
}

function AddProviderList({ providers }: { providers: PlatformCatalogProvider[] }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? providers.filter(provider => provider.displayName.toLowerCase().includes(needle))
    : providers;
  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        label="Search providers"
        placeholder="Search providers"
        value={query}
        onValueChange={setQuery}
        className="w-full"
      />
      {matches.length > 0 ? (
        <SettingsContainer>
          {matches.map(provider => (
            <SettingsRow
              key={provider.id}
              label={<ProviderLabel provider={provider} />}
              description={provider.mcp ? 'MCP server' : undefined}
            >
              <ProviderConnectControl
                provider={provider}
                label={`Connect ${provider.displayName}`}
                buttonLabel="Connect"
                icon={<Link2 />}
              />
            </SettingsRow>
          ))}
        </SettingsContainer>
      ) : (
        <Txt as="p" variant="caption" tone="muted">
          {needle ? 'No providers match.' : 'Every catalog provider is connected.'}
        </Txt>
      )}
    </div>
  );
}

function ProviderLabel({ provider }: { provider: PlatformCatalogProvider }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span className="flex items-center gap-2">
      {provider.logoUrl && failedSrc !== provider.logoUrl ? (
        <img
          src={provider.logoUrl}
          alt=""
          className="size-4 shrink-0 object-contain"
          onError={() => setFailedSrc(provider.logoUrl ?? undefined)}
        />
      ) : (
        <Blocks aria-hidden className="text-muted-foreground size-4 shrink-0" />
      )}
      {provider.displayName}
    </span>
  );
}
