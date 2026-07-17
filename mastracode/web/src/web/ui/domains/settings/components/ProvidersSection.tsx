import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';

import type { OAuthStartResponse } from '../../../../../shared/api/types';
import {
  useCancelProviderOAuth,
  useProvidersQuery,
  useStartProviderOAuth,
} from '../../../../../shared/hooks/use-providers';
import { useWebAuth } from '../../../../../shared/hooks/useWebAuth';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ProviderOAuthDialog } from './ProviderOAuthDialog';
import { ProviderRow } from './ProviderRow';

interface ActiveOAuthSession {
  provider: string;
  session: OAuthStartResponse;
}

/** Provider OAuth and API-key management for local and tenant-scoped web deployments. */
export function ProvidersSection() {
  const providersQuery = useProvidersQuery();
  const authQuery = useWebAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [search, setSearch] = useState('');
  const [startingProvider, setStartingProvider] = useState<string>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveOAuthSession>();

  const providers = providersQuery.data ?? [];
  const authEnabled = authQuery.data?.authEnabled === true;
  const configured = providers
    .filter(provider => provider.source !== 'none')
    .sort((left, right) => left.provider.localeCompare(right.provider));

  const query = search.trim().toLowerCase();
  const results = query
    ? providers
        .filter(provider => provider.provider.toLowerCase().includes(query))
        .sort((left, right) => {
          if ((left.source !== 'none') !== (right.source !== 'none')) return left.source !== 'none' ? -1 : 1;
          return left.provider.localeCompare(right.provider);
        })
        .slice(0, 50)
    : [];

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

  const searching = query.length > 0;
  const list = searching ? results : configured;
  const requestError = providersQuery.error ?? startOAuthMutation.error ?? cancelOAuthMutation.error;
  const error = requestError instanceof Error ? requestError.message : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-icon3" />
        <Input
          type="text"
          placeholder="Search providers to sign in or add a key…"
          value={search}
          onChange={event => setSearch(event.target.value)}
          aria-label="Search providers"
          className="pl-8"
        />
      </div>

      {error && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {error}
        </Txt>
      )}

      {providersQuery.isPending ? (
        <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
      ) : (
        <>
          {!searching && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {configured.length > 0
                ? `${configured.length} configured. Search above to add more.`
                : 'No providers configured yet. Search above to sign in or add a key.'}
            </Txt>
          )}
          {list.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {searching ? `No providers match “${search.trim()}”.` : 'No providers configured.'}
            </Txt>
          ) : (
            <ul role="list" className="flex flex-col divide-y divide-border1">
              {list.map(provider => (
                <ProviderRow
                  key={provider.provider}
                  provider={provider}
                  authEnabled={authEnabled}
                  startingOAuth={startingProvider === provider.provider}
                  onStartOAuth={startOAuth}
                />
              ))}
            </ul>
          )}
        </>
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
