import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { Input } from '@mastra/playground-ui/components/Input';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../../shared/api/types';
import {
  useCancelProviderOAuth,
  useProvidersQuery,
  useRemoveProviderKey,
  useSignOutProviderOAuth,
  useStartProviderOAuth,
} from '../../../../../shared/hooks/use-providers';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { AddApiKeyDialog } from './AddApiKeyDialog';
import { ProviderOAuthDialog } from './ProviderOAuthDialog';
import { providerDisplayName } from './provider-display-name';

const SOURCE_LABEL: Record<ProviderInfo['source'], string> = {
  oauth: 'Signed in',
  'oauth-user': 'Signed in',
  stored: 'Key saved',
  'stored-user': 'Key saved',
  'stored-org': 'Org key',
  env: 'From env',
  none: 'Not set',
};

const SOURCE_VARIANT: Record<ProviderInfo['source'], 'success' | 'info' | 'default'> = {
  oauth: 'success',
  'oauth-user': 'success',
  stored: 'success',
  'stored-user': 'success',
  'stored-org': 'info',
  env: 'info',
  none: 'default',
};

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

const API_KEY_LIST_MAX_HEIGHT = 280;
const PROVIDER_LIST_COLUMNS = '1fr auto auto';

function mutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Provider credential management as a tabbed subsection of the Model settings
 * page: OAuth sign-in on one tab, API keys on the other.
 */
export function ProviderAccessSection() {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const signOutMutation = useSignOutProviderOAuth();
  const removeKeyMutation = useRemoveProviderKey();
  const [search, setSearch] = useState('');
  const [startingProvider, setStartingProvider] = useState<string>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();

  const providers = providersQuery.data ?? [];
  const authEnabled = authQuery.data?.authEnabled === true;
  const oauthProviders = providers
    .filter(provider => provider.oauth?.supported === true)
    .sort((left, right) => left.provider.localeCompare(right.provider));

  // OAuth-capable providers usually accept API keys too, so the API-key tab
  // lists every provider, credentialed-first.
  const apiKeyProviders = [...providers].sort((left, right) => {
    if ((left.source !== 'none') !== (right.source !== 'none')) return left.source !== 'none' ? -1 : 1;
    return left.provider.localeCompare(right.provider);
  });
  const query = search.trim().toLowerCase();
  const results = query
    ? apiKeyProviders.filter(provider => provider.provider.toLowerCase().includes(query))
    : apiKeyProviders;

  const startOAuth = async (provider: ProviderInfo) => {
    const modes = provider.oauth?.modes ?? [];
    setStartingProvider(provider.provider);
    try {
      const session = await startOAuthMutation.mutateAsync({
        provider: provider.provider,
        mode: modes.length === 1 ? modes[0] : undefined,
      });
      setActiveOAuth({ provider: provider.provider, session });
    } catch {
      // Mutation error is rendered below.
    } finally {
      setStartingProvider(undefined);
    }
  };

  const closeOAuth = () => {
    const flow = activeOAuth;
    setActiveOAuth(undefined);
    if (flow) {
      cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
    }
  };

  const signOut = (provider: ProviderInfo) => {
    signOutMutation.mutate(
      { provider: provider.provider },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to sign out')) },
    );
  };

  const removeKey = (provider: ProviderInfo) => {
    removeKeyMutation.mutate(
      {
        provider: provider.provider,
        ...(authEnabled ? { scope: provider.source === 'stored-org' ? 'org' : 'user' } : {}),
      },
      { onError: error => toast.error(mutationErrorMessage(error, 'Failed to remove API key')) },
    );
  };

  const isSigningOut = (provider: ProviderInfo) =>
    signOutMutation.isPending && signOutMutation.variables?.provider === provider.provider;
  const isRemoving = (provider: ProviderInfo) =>
    removeKeyMutation.isPending && removeKeyMutation.variables?.provider === provider.provider;

  const requestError = providersQuery.error ?? startOAuthMutation.error ?? cancelOAuthMutation.error;
  const error = requestError instanceof Error ? requestError.message : undefined;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      <Tabs defaultTab="oauth">
        <TabList variant="pill">
          <Tab value="oauth">Sign in with a provider</Tab>
          <Tab value="api-key">Connect with API key</Tab>
        </TabList>

        <TabContent value="oauth" className="flex flex-col gap-3">
          {providersQuery.isPending ? (
            <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
          ) : oauthProviders.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              No providers support sign in.
            </Txt>
          ) : (
            <DataList aria-label="Sign in providers" variant="lined" columns={PROVIDER_LIST_COLUMNS}>
              {oauthProviders.map(provider => {
                const displayName = providerDisplayName(provider.provider);
                const signedIn = provider.source === 'oauth' || provider.source === 'oauth-user';
                return (
                  <DataList.RowStatic key={provider.provider}>
                    <DataList.NameCell>{displayName}</DataList.NameCell>
                    <DataList.Cell>
                      <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
                        {SOURCE_LABEL[provider.source]}
                      </Badge>
                    </DataList.Cell>
                    <DataList.Cell className="justify-end">
                      {signedIn ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Sign out of ${displayName}`}
                          disabled={isSigningOut(provider)}
                          onClick={() => signOut(provider)}
                        >
                          {isSigningOut(provider) ? 'Signing out…' : 'Sign out'}
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          aria-label={`Sign in to ${displayName}`}
                          disabled={startOAuthMutation.isPending}
                          onClick={() => void startOAuth(provider)}
                        >
                          {startingProvider === provider.provider ? 'Starting…' : 'Sign in'}
                        </Button>
                      )}
                    </DataList.Cell>
                  </DataList.RowStatic>
                );
              })}
            </DataList>
          )}
        </TabContent>

        <TabContent value="api-key" className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="text-icon3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search providers to add an API key…"
              value={search}
              onChange={event => setSearch(event.target.value)}
              aria-label="Search providers"
              className="pl-8"
            />
          </div>

          {providersQuery.isPending ? (
            <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
          ) : results.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {query ? `No providers match “${search.trim()}”.` : 'No API key providers are available.'}
            </Txt>
          ) : (
            <DataList
              aria-label="API key providers"
              variant="lined"
              columns={PROVIDER_LIST_COLUMNS}
              maxHeight={`${API_KEY_LIST_MAX_HEIGHT}px`}
              className="min-h-0"
            >
              {results.map(provider => {
                const displayName = providerDisplayName(provider.provider);
                const storedKey =
                  provider.source === 'stored' || provider.source === 'stored-user' || provider.source === 'stored-org';
                return (
                  <DataList.RowStatic key={provider.provider}>
                    <DataList.NameCell>{displayName}</DataList.NameCell>
                    <DataList.Cell>
                      <Badge size="sm" variant={SOURCE_VARIANT[provider.source]}>
                        {SOURCE_LABEL[provider.source]}
                      </Badge>
                    </DataList.Cell>
                    <DataList.Cell className="justify-end">
                      <span className="flex items-center gap-2">
                        <Button
                          size="sm"
                          aria-label={`${storedKey ? 'Update key' : 'Add API key'} for ${displayName}`}
                          disabled={isRemoving(provider)}
                          onClick={() => setKeyDialogProvider(provider)}
                        >
                          {storedKey ? 'Update key' : 'Add API key'}
                        </Button>
                        {storedKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Remove key for ${displayName}`}
                            disabled={isRemoving(provider)}
                            onClick={() => removeKey(provider)}
                          >
                            {isRemoving(provider) ? 'Removing…' : 'Remove'}
                          </Button>
                        )}
                      </span>
                    </DataList.Cell>
                  </DataList.RowStatic>
                );
              })}
            </DataList>
          )}
        </TabContent>
      </Tabs>

      {keyDialogProvider && (
        <AddApiKeyDialog
          provider={keyDialogProvider}
          authEnabled={authEnabled}
          onClose={() => setKeyDialogProvider(undefined)}
        />
      )}

      {activeOAuth && (
        <ProviderOAuthDialog
          provider={activeOAuth.provider}
          session={activeOAuth.session}
          onClose={closeOAuth}
          onComplete={() => setActiveOAuth(undefined)}
        />
      )}
    </div>
  );
}
