import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../api/types';
import {
  useCancelProviderOAuth,
  useOrgKeyAdminQuery,
  useProvidersQuery,
  useStartProviderOAuth,
} from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { providerDisplayName } from '../../settings/components/provider-display-name';

export type ProviderCredentialScope = 'org' | 'user';

export interface ActiveProviderOAuth {
  provider: string;
  session: OAuthStartResponse;
}

export interface ProviderConnection {
  isPending: boolean;
  catalogError?: Error;
  authEnabled: boolean;
  orgKeyAdmin: boolean;
  signInProviders: ProviderInfo[];
  keyProviders: ProviderInfo[];
  provider?: ProviderInfo;
  connected: boolean;
  hasConfiguredProvider: boolean;
  pending: boolean;
  error?: string;
  keyDialogProvider?: ProviderInfo;
  activeOAuth?: ActiveProviderOAuth;
  isConfigured: (provider: ProviderInfo) => boolean;
  canConfigure: (provider: ProviderInfo) => boolean;
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

function hasScopedCredential(provider: ProviderInfo, scope: ProviderCredentialScope): boolean {
  if (scope === 'org') {
    return (
      provider.orgCredential !== undefined ||
      provider.orgKey === true ||
      provider.source === 'oauth-org' ||
      provider.source === 'stored-org'
    );
  }
  return provider.userCredential !== undefined || provider.source === 'oauth-user' || provider.source === 'stored-user';
}

export function matchesProviderQuery(provider: ProviderInfo, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    provider.provider.toLowerCase().includes(normalized) ||
    providerDisplayName(provider.provider).toLowerCase().includes(normalized)
  );
}

/** Pick a model provider and connect it, by browser sign-in or by API key. */
export function useProviderConnection({ scope }: { scope?: ProviderCredentialScope } = {}): ProviderConnection {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [providerId, setProviderId] = useState<string>();
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveProviderOAuth>();
  const [error, setError] = useState<string>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const orgKeyAdmin = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const isConfigured = (provider: ProviderInfo) =>
    scope && authEnabled ? hasScopedCredential(provider, scope) : isProviderConfigured(provider);
  const byConfiguredThenName = (left: ProviderInfo, right: ProviderInfo): number => {
    if (isConfigured(left) !== isConfigured(right)) return isConfigured(left) ? -1 : 1;
    return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
  };
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
        ...(authEnabled && scope ? { scope } : {}),
      });
      setActiveOAuth({ provider: chosen.provider, session });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start provider sign in');
    }
  };

  const canConfigure = (chosen: ProviderInfo) => scope !== 'org' || !authEnabled || orgKeyAdmin || isConfigured(chosen);

  return {
    isPending:
      providersQuery.isPending ||
      (scope !== undefined && authQuery.isPending) ||
      (scope === 'org' && authEnabled && orgKeyAdminQuery.isPending),
    catalogError: providersQuery.error ?? (scope !== undefined ? authQuery.error : undefined) ?? undefined,
    authEnabled,
    orgKeyAdmin,
    // Providers with a browser sign-in flow get their own action; the rest connect with an API key.
    signInProviders: providers.filter(candidate => candidate.oauth?.supported === true),
    keyProviders: providers.filter(candidate => candidate.oauth?.supported !== true),
    provider,
    connected: provider ? isConfigured(provider) : false,
    hasConfiguredProvider: providers.some(isConfigured),
    pending: startOAuthMutation.isPending,
    error,
    keyDialogProvider,
    activeOAuth,
    isConfigured,
    canConfigure,
    clear: () => select(undefined),
    chooseSignInProvider: chosen => {
      if (!canConfigure(chosen)) return;
      select(chosen.provider);
      if (!isConfigured(chosen)) void startOAuth(chosen);
    },
    chooseKeyProvider: chosen => {
      if (!canConfigure(chosen)) return;
      select(chosen.provider);
      if (!isConfigured(chosen)) setKeyDialogProvider(chosen);
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
