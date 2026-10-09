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
export type ProviderConnectionMethod = 'api_key' | 'oauth';
export type PreviewProvider = (providerId: string | undefined, method?: ProviderConnectionMethod) => void;

export interface ActiveProviderOAuth {
  provider: string;
  session: OAuthStartResponse;
  replaces?: ProviderConnectionMethod;
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
  method?: ProviderConnectionMethod;
  hasConfiguredProvider: boolean;
  pending: boolean;
  error?: string;
  keyDialogProvider?: ProviderInfo;
  activeOAuth?: ActiveProviderOAuth;
  isConfigured: (provider: ProviderInfo, method?: ProviderConnectionMethod) => boolean;
  canConfigure: (provider: ProviderInfo, method?: ProviderConnectionMethod) => boolean;
  retry: () => void;
  clear: () => void;
  chooseSignInProvider: (provider: ProviderInfo) => void;
  chooseKeyProvider: (provider: ProviderInfo) => void;
  closeKeyDialog: () => void;
  closeOAuth: () => void;
  completeOAuth: () => void;
}

/** Read the requested scope, independently of the caller's winning credential. */
export function providerCredentialMethod(
  provider: ProviderInfo,
  scope?: ProviderCredentialScope,
): ProviderConnectionMethod | undefined {
  if (provider.source === 'deployment') return scope === 'user' ? undefined : 'api_key';
  if (scope === 'org') {
    if (provider.orgCredential) return provider.orgCredential;
    if (provider.orgKey || provider.source === 'stored-org') return 'api_key';
    if (provider.source === 'oauth-org') return 'oauth';
    return undefined;
  }
  if (scope === 'user') {
    if (provider.userCredential) return provider.userCredential;
    if (provider.source === 'stored-user') return 'api_key';
    if (provider.source === 'oauth-user') return 'oauth';
    return undefined;
  }
  if (provider.source === 'none') return undefined;
  return provider.source.startsWith('oauth') ? 'oauth' : 'api_key';
}

export function matchesProviderQuery(provider: ProviderInfo, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    provider.provider.toLowerCase().includes(normalized) ||
    providerDisplayName(provider.provider).toLowerCase().includes(normalized)
  );
}

function offersApiKey(provider: ProviderInfo): boolean {
  if (provider.envVar || !provider.oauth?.supported) return true;
  if (provider.userCredential === 'api_key' || provider.orgCredential === 'api_key') return true;
  // `orgKey` also represents shared OAuth. It is not an API-key capability.
  return ['stored-org', 'stored-user', 'stored'].includes(provider.source);
}

/** Pick a model provider and connect it, by browser sign-in or by API key. */
export function useProviderConnection({
  scope,
  initialSelection,
}: {
  scope?: ProviderCredentialScope;
  initialSelection?: { providerId: string; method: ProviderConnectionMethod };
} = {}): ProviderConnection {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const [selection, setSelection] = useState(initialSelection);
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveProviderOAuth>();
  const [error, setError] = useState<string>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const orgKeyAdmin = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const credentialScope = authEnabled ? scope : undefined;
  const isConfigured = (provider: ProviderInfo, method?: ProviderConnectionMethod) => {
    const saved = providerCredentialMethod(provider, credentialScope);
    // Unscoped credentials resolve by precedence (sign-in over saved key), so any one serves both methods.
    return method && credentialScope ? saved === method : saved !== undefined;
  };
  const byConfiguredThenName = (left: ProviderInfo, right: ProviderInfo): number => {
    if (isConfigured(left) !== isConfigured(right)) return isConfigured(left) ? -1 : 1;
    return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
  };
  const providers = (providersQuery.data ?? []).toSorted(byConfiguredThenName);
  const provider = providers.find(candidate => candidate.provider === selection?.providerId);

  const select = (nextSelection: typeof selection) => {
    setSelection(nextSelection);
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
      setActiveOAuth({
        provider: chosen.provider,
        session,
        replaces: providerCredentialMethod(chosen, credentialScope),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start provider sign in');
    }
  };

  const authError = scope === undefined ? undefined : authQuery.error;

  const canConfigure = (chosen: ProviderInfo, method?: ProviderConnectionMethod) =>
    scope !== 'org' || !authEnabled || orgKeyAdmin || isConfigured(chosen, method);

  return {
    isPending:
      providersQuery.isPending ||
      (scope !== undefined && authQuery.isPending) ||
      (scope === 'org' && authEnabled && orgKeyAdminQuery.isPending),
    catalogError: providersQuery.error ?? authError ?? undefined,
    authEnabled,
    orgKeyAdmin,
    // A provider can offer both methods; sign-in support must not hide API-key access.
    signInProviders: providers.filter(candidate => candidate.oauth?.supported === true),
    keyProviders: providers.filter(
      candidate => !(authEnabled && scope === 'user' && candidate.source === 'deployment') && offersApiKey(candidate),
    ),
    provider,
    connected: provider ? isConfigured(provider, selection?.method) : false,
    method: selection?.method,
    hasConfiguredProvider: providers.some(candidate => isConfigured(candidate)),
    pending: startOAuthMutation.isPending,
    error,
    keyDialogProvider,
    activeOAuth,
    isConfigured,
    canConfigure,
    retry: () => {
      void providersQuery.refetch();
      if (scope !== undefined) void authQuery.refetch();
    },
    clear: () => select(undefined),
    chooseSignInProvider: chosen => {
      if (!canConfigure(chosen, 'oauth')) return;
      select({ providerId: chosen.provider, method: 'oauth' });
      if (!isConfigured(chosen, 'oauth')) void startOAuth(chosen);
    },
    chooseKeyProvider: chosen => {
      if (!canConfigure(chosen, 'api_key')) return;
      select({ providerId: chosen.provider, method: 'api_key' });
      if (!isConfigured(chosen, 'api_key')) setKeyDialogProvider(chosen);
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
