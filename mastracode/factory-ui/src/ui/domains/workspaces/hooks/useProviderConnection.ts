import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../api/types';
import { useCancelProviderOAuth, useProvidersQuery, useStartProviderOAuth } from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { providerDisplayName } from '../../settings/components/provider-display-name';

export interface ActiveProviderOAuth {
  provider: string;
  session: OAuthStartResponse;
}

export interface ProviderConnection {
  isPending: boolean;
  catalogError?: Error;
  authEnabled: boolean;
  signInProviders: ProviderInfo[];
  keyProviders: ProviderInfo[];
  provider?: ProviderInfo;
  connected: boolean;
  pending: boolean;
  error?: string;
  keyDialogProvider?: ProviderInfo;
  activeOAuth?: ActiveProviderOAuth;
  clear: () => void;
  chooseSignInProvider: (provider: ProviderInfo) => void;
  chooseKeyProvider: (provider: ProviderInfo) => void;
  closeKeyDialog: () => void;
  closeOAuth: () => void;
  completeOAuth: () => void;
}

export function isProviderConfigured(provider: ProviderInfo): boolean {
  return provider.source !== 'none';
}

export function matchesProviderQuery(provider: ProviderInfo, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    provider.provider.toLowerCase().includes(normalized) ||
    providerDisplayName(provider.provider).toLowerCase().includes(normalized)
  );
}

function byConfiguredThenName(left: ProviderInfo, right: ProviderInfo): number {
  if (isProviderConfigured(left) !== isProviderConfigured(right)) return isProviderConfigured(left) ? -1 : 1;
  return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
}

/** Pick a model provider and connect it, by browser sign-in or by API key. */
export function useProviderConnection(): ProviderConnection {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [providerId, setProviderId] = useState<string>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveProviderOAuth>();
  const [error, setError] = useState<string>();

  const providers = (providersQuery.data ?? []).toSorted(byConfiguredThenName);
  const provider = providers.find(candidate => candidate.provider === providerId);

  const select = (nextProviderId: string | undefined) => {
    setProviderId(nextProviderId);
    setError(undefined);
  };

  const startOAuth = async (chosen: ProviderInfo) => {
    setError(undefined);
    try {
      const modes = chosen.oauth?.modes ?? [];
      const session = await startOAuthMutation.mutateAsync({
        provider: chosen.provider,
        mode: modes.length === 1 ? modes[0] : undefined,
      });
      setActiveOAuth({ provider: chosen.provider, session });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start provider sign in');
    }
  };

  return {
    isPending: providersQuery.isPending,
    catalogError: providersQuery.error ?? undefined,
    authEnabled: authQuery.data?.authEnabled === true,
    // Providers with a browser sign-in flow get their own action; the rest connect with an API key.
    signInProviders: providers.filter(candidate => candidate.oauth?.supported === true),
    keyProviders: providers.filter(candidate => candidate.oauth?.supported !== true),
    provider,
    connected: provider ? isProviderConfigured(provider) : false,
    pending: startOAuthMutation.isPending,
    error,
    keyDialogProvider,
    activeOAuth,
    clear: () => select(undefined),
    chooseSignInProvider: chosen => {
      select(chosen.provider);
      if (!isProviderConfigured(chosen)) void startOAuth(chosen);
    },
    chooseKeyProvider: chosen => {
      select(chosen.provider);
      if (!isProviderConfigured(chosen)) setKeyDialogProvider(chosen);
    },
    closeKeyDialog: () => setKeyDialogProvider(undefined),
    closeOAuth: () => {
      const flow = activeOAuth;
      setActiveOAuth(undefined);
      if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
    },
    completeOAuth: () => setActiveOAuth(undefined),
  };
}
