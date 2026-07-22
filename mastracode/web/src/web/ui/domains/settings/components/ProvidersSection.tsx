import { Input } from '@mastra/playground-ui/components/Input';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useRef, useState } from 'react';

import type { OAuthStartResponse } from '../../../../../shared/api/types';
import {
  useCancelProviderOAuth,
  useProvidersQuery,
  useStartProviderOAuth,
} from '../../../../../shared/hooks/use-providers';
import { useFactoryAuth } from '../../../../../shared/hooks/useFactoryAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ProviderOAuthDialog } from './ProviderOAuthDialog';
import { ProviderRow } from './ProviderRow';

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

const API_KEY_LIST_MAX_HEIGHT = 280;

/** Provider OAuth and API-key management for local and tenant-scoped web deployments. */
export function ProvidersSection() {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [search, setSearch] = useState('');
  const [startingProvider, setStartingProvider] = useState<string>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();
  const apiKeyListRef = useRef<HTMLDivElement | null>(null);

  const providers = providersQuery.data ?? [];
  const authEnabled = authQuery.data?.authEnabled === true;
  const oauthProviders = providers
    .filter(provider => provider.oauth?.supported === true)
    .sort((left, right) => left.provider.localeCompare(right.provider));
  const oauthProviderIds = new Set(oauthProviders.map(provider => provider.provider));

  const apiKeyProviders = providers
    .filter(provider => !oauthProviderIds.has(provider.provider))
    .sort((left, right) => {
      if ((left.source !== 'none') !== (right.source !== 'none')) return left.source !== 'none' ? -1 : 1;
      return left.provider.localeCompare(right.provider);
    });
  const query = search.trim().toLowerCase();
  const results = query
    ? apiKeyProviders.filter(provider => provider.provider.toLowerCase().includes(query))
    : apiKeyProviders;

  const startOAuth = async (provider: string, mode?: string) => {
    setStartingProvider(provider);
    try {
      const session = await startOAuthMutation.mutateAsync({ provider, mode });
      setActiveOAuth({ provider, session });
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

  const updateSearch = (value: string) => {
    setSearch(value);
    apiKeyListRef.current?.scrollTo({ top: 0 });
  };

  const requestError = providersQuery.error ?? startOAuthMutation.error ?? cancelOAuthMutation.error;
  const error = requestError instanceof Error ? requestError.message : undefined;

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      <div className="flex flex-col gap-1">
        <Txt as="h3" variant="ui-lg" className="font-medium text-icon6">
          Sign in with a provider
        </Txt>
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Connect an existing provider account to use its models.
        </Txt>
      </div>

      {providersQuery.isPending ? (
        <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
      ) : oauthProviders.length === 0 ? (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          No providers support sign in.
        </Txt>
      ) : (
        <ul role="list" aria-label="Sign in providers" className="flex flex-col divide-y divide-border1">
          {oauthProviders.map(provider => (
            <ProviderRow
              key={provider.provider}
              provider={provider}
              authEnabled={authEnabled}
              disabled={startOAuthMutation.isPending}
              startingOAuth={startingProvider === provider.provider}
              onStartOAuth={startOAuth}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border1" />
        <Txt as="span" variant="ui-xs" className="text-icon3">
          OR
        </Txt>
        <div className="h-px flex-1 bg-border1" />
      </div>

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-icon3" />
        <Input
          type="text"
          placeholder="Search providers to add an API key…"
          value={search}
          onChange={event => updateSearch(event.target.value)}
          aria-label="Search providers"
          className="pl-8"
        />
      </div>

      {!providersQuery.isPending &&
        (results.length === 0 ? (
          <Txt as="p" variant="ui-sm" className="text-icon3">
            {query ? `No providers match “${search.trim()}”.` : 'No API key providers are available.'}
          </Txt>
        ) : (
          <ScrollArea
            maxHeight={`${API_KEY_LIST_MAX_HEIGHT}px`}
            viewportRef={apiKeyListRef}
            className="min-h-0 rounded-md border border-border1"
          >
            <ul role="list" aria-label="API key providers" className="flex flex-col divide-y divide-border1 px-2">
              {results.map(provider => (
                <ProviderRow
                  key={provider.provider}
                  provider={provider}
                  authEnabled={authEnabled}
                  disabled={startOAuthMutation.isPending}
                  startingOAuth={startingProvider === provider.provider}
                  onStartOAuth={startOAuth}
                />
              ))}
            </ul>
          </ScrollArea>
        ))}

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
