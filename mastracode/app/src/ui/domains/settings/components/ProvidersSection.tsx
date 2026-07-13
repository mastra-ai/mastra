import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { ProviderInfo, StartProviderOAuthResponse } from '#shared/api/types';
import {
  useCompleteProviderOAuth,
  useProvidersQuery,
  useRemoveProviderKey,
  useRemoveProviderOAuth,
  useSaveProviderKey,
  useStartProviderOAuth,
} from '#shared/hooks/use-providers';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { ProviderRow } from './ProviderRow';

const EMPTY_PROVIDERS: ProviderInfo[] = [];

function compareDefaultProviders(a: ProviderInfo, b: ProviderInfo): number {
  if (Boolean(a.oauthSupported) !== Boolean(b.oauthSupported)) return a.oauthSupported ? -1 : 1;
  return a.provider.localeCompare(b.provider);
}

function compareSearchResults(a: ProviderInfo, b: ProviderInfo): number {
  const aConfigured = a.source !== 'none';
  const bConfigured = b.source !== 'none';
  if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
  return a.provider.localeCompare(b.provider);
}

function providerSummary({
  hasSubscriptionLogin,
  configuredCount,
  credentialManagementEnabled,
}: {
  hasSubscriptionLogin: boolean;
  configuredCount: number;
  credentialManagementEnabled: boolean;
}): string {
  if (hasSubscriptionLogin) return 'Sign in with a subscription, or search for another provider.';
  if (configuredCount > 0) {
    return credentialManagementEnabled
      ? `${configuredCount} configured. Search above to add more.`
      : `${configuredCount} configured.`;
  }
  return credentialManagementEnabled
    ? 'No providers configured yet. Search above to add one.'
    : 'No providers configured.';
}

export function ProvidersSection() {
  const providersQuery = useProvidersQuery();
  const saveKeyMutation = useSaveProviderKey();
  const removeKeyMutation = useRemoveProviderKey();
  const startOAuthMutation = useStartProviderOAuth();
  const completeOAuthMutation = useCompleteProviderOAuth();
  const removeOAuthMutation = useRemoveProviderOAuth();

  const [search, setSearch] = useState('');

  const providers = providersQuery.data?.providers ?? EMPTY_PROVIDERS;
  const credentialManagementEnabled = providersQuery.data?.credentialManagementEnabled ?? false;
  const loading = providersQuery.isPending;
  const busy =
    saveKeyMutation.isPending ||
    removeKeyMutation.isPending ||
    startOAuthMutation.isPending ||
    completeOAuthMutation.isPending ||
    removeOAuthMutation.isPending;
  const mutationError = [
    providersQuery.error,
    saveKeyMutation.error,
    removeKeyMutation.error,
    startOAuthMutation.error,
    completeOAuthMutation.error,
    removeOAuthMutation.error,
  ].find((error): error is Error => error instanceof Error);

  const defaultProviders = providers
    .filter(provider => provider.source !== 'none' || provider.oauthSupported)
    .toSorted(compareDefaultProviders);
  const configuredCount = providers.filter(provider => provider.source !== 'none').length;
  const hasSubscriptionLogin = defaultProviders.some(
    provider => provider.oauthSupported && provider.source !== 'oauth',
  );

  const q = search.trim().toLowerCase();
  const results = q
    ? providers
        .filter(p => `${p.provider} ${p.displayName ?? ''}`.toLowerCase().includes(q))
        .toSorted(compareSearchResults)
        .slice(0, 50)
    : [];

  const saveKey = async (provider: string, key: string, envVar?: string): Promise<boolean> => {
    try {
      await saveKeyMutation.mutateAsync({ provider, key, envVar });
      return true;
    } catch {
      return false;
    }
  };

  const removeKey = async (provider: string) => {
    try {
      await removeKeyMutation.mutateAsync({ provider });
    } catch {
      // Error surfaced via the mutation state above.
    }
  };

  const startOAuth = async (provider: string): Promise<StartProviderOAuthResponse | undefined> => {
    try {
      return await startOAuthMutation.mutateAsync({ provider });
    } catch {
      return undefined;
    }
  };

  const completeOAuth = async (provider: string, loginId: string, code: string): Promise<boolean> => {
    try {
      await completeOAuthMutation.mutateAsync({ provider, loginId, code });
      return true;
    } catch {
      return false;
    }
  };

  const removeOAuth = async (provider: string) => {
    try {
      await removeOAuthMutation.mutateAsync({ provider });
    } catch {
      // Error surfaced via the mutation state above.
    }
  };

  const searching = search.trim().length > 0;
  const list = searching ? results : defaultProviders;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon3" />
        <Input
          type="text"
          placeholder="Search providers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search providers"
          className="pl-8"
        />
      </div>

      {mutationError && (
        <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg">
          {mutationError.message}
        </Txt>
      )}

      {!loading && !credentialManagementEnabled && (
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Provider credentials are managed by this deployment.
        </Txt>
      )}

      {loading ? (
        <SkeletonRows label="Loading providers" rows={3} rowClassName="h-9 w-full" />
      ) : (
        <>
          {!searching && (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {providerSummary({ hasSubscriptionLogin, configuredCount, credentialManagementEnabled })}
            </Txt>
          )}
          {list.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3">
              {searching ? `No providers match “${search.trim()}”.` : 'No providers configured.'}
            </Txt>
          ) : (
            <ul className="flex flex-col divide-y divide-border1">
              {list.map(provider => (
                <ProviderRow
                  key={provider.provider}
                  provider={provider}
                  credentialManagementEnabled={credentialManagementEnabled}
                  busy={busy}
                  onSaveKey={(key, envVar) => saveKey(provider.provider, key, envVar)}
                  onRemoveKey={() => removeKey(provider.provider)}
                  onStartOAuth={() => startOAuth(provider.provider)}
                  onCompleteOAuth={(loginId, code) => completeOAuth(provider.provider, loginId, code)}
                  onRemoveOAuth={() => removeOAuth(provider.provider)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
