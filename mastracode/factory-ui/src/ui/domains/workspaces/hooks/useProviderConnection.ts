import { useState } from 'react';

import type { OAuthStartResponse, ProviderInfo } from '../../../../api/types';
import {
  useCancelProviderOAuth,
  useConnectMastraGateway,
  useOrgKeyAdminQuery,
  useProvidersQuery,
  useStartProviderOAuth,
} from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { credentialAt, signInRequest } from '../../settings/components/provider-credential';

export type ProviderCredentialScope = 'org' | 'user';
export type ProviderConnectionMethod = 'api_key' | 'oauth';
export type PreviewProvider = (providerId: string | undefined, method?: ProviderConnectionMethod) => void;

export const CONNECTION_METHOD_LABEL: Record<ProviderConnectionMethod, string> = {
  api_key: 'API key',
  oauth: 'Provider sign-in',
};

export interface ActiveProviderOAuth {
  provider: string;
  session: OAuthStartResponse;
  replaces?: ProviderConnectionMethod;
}

export interface ProviderConnection {
  isPending: boolean;
  catalogError?: Error;
  /** The provider list (or auth) is being fetched again, e.g. after Retry. */
  retrying: boolean;
  authEnabled: boolean;
  orgKeyAdmin: boolean;
  signInProviders: ProviderInfo[];
  keyProviders: ProviderInfo[];
  gatewayProvider?: ProviderInfo;
  provider?: ProviderInfo;
  /** The selected provider id, even when it is gone from the provider list. */
  selectedProviderId?: string;
  connected: boolean;
  method?: ProviderConnectionMethod;
  hasConfiguredProvider: boolean;
  pending: boolean;
  connectingGateway: boolean;
  error?: string;
  keyDialogProvider?: ProviderInfo;
  activeOAuth?: ActiveProviderOAuth;
  isConfigured: (provider: ProviderInfo, method?: ProviderConnectionMethod) => boolean;
  canConfigure: (provider: ProviderInfo, method?: ProviderConnectionMethod) => boolean;
  retry: () => void;
  clear: () => void;
  /** Drops a connect error once the user has moved on from the action that failed. */
  clearError: () => void;
  /** `onFailedToStart` runs when the sign-in could not start, so a caller can undo what it showed for it. */
  chooseSignInProvider: (provider: ProviderInfo, onFailedToStart?: () => void) => void;
  chooseKeyProvider: (provider: ProviderInfo) => void;
  chooseCustomProvider: (providerId: string) => void;
  chooseGateway: () => void;
  /** `saved` selects the provider the dialog was for; a cancel keeps the previous choice. */
  closeKeyDialog: (saved: boolean) => void;
  closeOAuth: () => void;
  completeOAuth: () => void;
}

export function providerCredentialMethod(
  provider: ProviderInfo,
  scope?: ProviderCredentialScope,
): ProviderConnectionMethod | undefined {
  if (provider.custom) return 'api_key';
  if (scope === 'user') return credentialAt(provider, 'user');
  if (provider.source === 'deployment') return 'api_key';
  if (scope === 'org') return credentialAt(provider, 'org');
  if (provider.source === 'none') return undefined;
  return provider.source.startsWith('oauth') ? 'oauth' : 'api_key';
}

export function isProviderConnected(
  provider: ProviderInfo,
  scope?: ProviderCredentialScope,
  method?: ProviderConnectionMethod,
): boolean {
  const saved = providerCredentialMethod(provider, scope);
  // Unscoped credentials resolve by precedence (sign-in over saved key), so any one serves both methods.
  return method && scope ? saved === method : saved !== undefined;
}

export function companyAccountNeedsAdmin(connection: ProviderConnection): boolean {
  return (
    !connection.isPending &&
    !connection.catalogError &&
    connection.authEnabled &&
    !connection.orgKeyAdmin &&
    !connection.hasConfiguredProvider
  );
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

export interface ProviderSelection {
  providerId: string;
  method: ProviderConnectionMethod;
}

export function useProviderConnection({
  scope,
  initialSelection,
  onSelectionChange,
}: {
  scope?: ProviderCredentialScope;
  initialSelection?: ProviderSelection;
  /** Called whenever the user picks or clears a provider. A provider that needs a key or a sign-in is only
   *  picked once that succeeds, so cancelling keeps the working choice. */
  onSelectionChange?: (selection: ProviderSelection | undefined) => void;
} = {}): ProviderConnection {
  const providersQuery = useProvidersQuery();
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const startOAuthMutation = useStartProviderOAuth();
  const cancelOAuthMutation = useCancelProviderOAuth();
  const connectGatewayMutation = useConnectMastraGateway();
  const [selection, setSelection] = useState<ProviderSelection | undefined>(initialSelection);
  const [keyDialogProvider, setKeyDialogProvider] = useState<ProviderInfo>();
  const [activeOAuth, setActiveOAuth] = useState<ActiveProviderOAuth>();
  const [error, setError] = useState<string>();

  const authEnabled = authQuery.data?.authEnabled === true;
  const orgKeyAdmin = !authEnabled || (orgKeyAdminQuery.data ?? true);
  const credentialScope = authEnabled ? scope : undefined;
  const hidesDeploymentKeys = authEnabled && scope === 'user';
  const isConfigured = (provider: ProviderInfo, method?: ProviderConnectionMethod) =>
    isProviderConnected(provider, credentialScope, method);
  const byConfiguredThenName = (left: ProviderInfo, right: ProviderInfo): number => {
    if (isConfigured(left) !== isConfigured(right)) return isConfigured(left) ? -1 : 1;
    return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
  };
  const providers = (providersQuery.data ?? []).toSorted(byConfiguredThenName);
  const provider = providers.find(candidate => candidate.provider === selection?.providerId);
  const gatewayProvider = providers.find(candidate => candidate.connectWithMastraAccount);
  const providerChoices = providers.filter(candidate => candidate !== gatewayProvider);

  const select = (nextSelection: ProviderSelection | undefined) => {
    setSelection(nextSelection);
    setError(undefined);
    onSelectionChange?.(nextSelection);
  };

  const startOAuth = async (chosen: ProviderInfo, onFailedToStart?: () => void) => {
    setError(undefined);
    try {
      const session = await startOAuthMutation.mutateAsync(signInRequest(chosen, credentialScope));
      setActiveOAuth({
        provider: chosen.provider,
        session,
        replaces: providerCredentialMethod(chosen, credentialScope),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to start provider sign in');
      onFailedToStart?.();
    }
  };

  const canConfigure = (chosen: ProviderInfo, method?: ProviderConnectionMethod) =>
    scope !== 'org' || !authEnabled || orgKeyAdmin || isConfigured(chosen, method);

  const connectGateway = async (gateway: ProviderInfo) => {
    if (!canConfigure(gateway, 'api_key')) return;
    setError(undefined);
    if (!isConfigured(gateway, 'api_key')) {
      try {
        await connectGatewayMutation.mutateAsync({ scope: credentialScope });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to connect the Mastra Gateway');
        return;
      }
    }
    select({ providerId: gateway.provider, method: 'api_key' });
  };

  return {
    isPending:
      providersQuery.isPending ||
      (scope !== undefined && authQuery.isPending) ||
      (scope === 'org' && authEnabled && orgKeyAdminQuery.isPending),
    catalogError: providersQuery.error ?? (scope !== undefined ? authQuery.error : undefined) ?? undefined,
    retrying: providersQuery.isFetching || (scope !== undefined && authQuery.isFetching),
    authEnabled,
    orgKeyAdmin,
    signInProviders: providerChoices.filter(candidate => candidate.oauth?.supported === true),
    keyProviders: providerChoices.filter(
      candidate => !(hidesDeploymentKeys && candidate.source === 'deployment') && offersApiKey(candidate),
    ),
    provider,
    selectedProviderId: selection?.providerId,
    connected: provider ? isConfigured(provider, selection?.method) : false,
    method: selection?.method,
    hasConfiguredProvider: providers.some(candidate => isConfigured(candidate)),
    gatewayProvider,
    pending: startOAuthMutation.isPending || connectGatewayMutation.isPending,
    connectingGateway: connectGatewayMutation.isPending,
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
    clearError: () => setError(undefined),
    chooseSignInProvider: (chosen, onFailedToStart) => {
      if (!canConfigure(chosen, 'oauth')) return;
      if (isConfigured(chosen, 'oauth')) select({ providerId: chosen.provider, method: 'oauth' });
      else void startOAuth(chosen, onFailedToStart);
    },
    chooseKeyProvider: chosen => {
      if (!canConfigure(chosen, 'api_key')) return;
      if (isConfigured(chosen, 'api_key')) {
        select({ providerId: chosen.provider, method: 'api_key' });
        return;
      }
      // An earlier failure belongs to another attempt; the dialog shows its own.
      setError(undefined);
      setKeyDialogProvider(chosen);
    },
    chooseCustomProvider: providerId => select({ providerId, method: 'api_key' }),
    chooseGateway: () => {
      if (gatewayProvider) void connectGateway(gatewayProvider);
    },
    closeKeyDialog: saved => {
      setKeyDialogProvider(undefined);
      if (saved && keyDialogProvider) select({ providerId: keyDialogProvider.provider, method: 'api_key' });
    },
    closeOAuth: () => {
      const flow = activeOAuth;
      setActiveOAuth(undefined);
      if (flow) cancelOAuthMutation.mutate({ provider: flow.provider, sessionId: flow.session.sessionId });
    },
    completeOAuth: () => {
      setActiveOAuth(undefined);
      if (activeOAuth) select({ providerId: activeOAuth.provider, method: 'oauth' });
    },
  };
}
