import type { StatusPresentation } from '@mastra/playground-ui/components/StatusIndicators';

import type { ProviderInfo } from '../../../../api/types';
import { useOrgKeyAdminQuery } from '../../../../hooks/use-providers';
import type { StartProviderOAuthArgs } from '../../../../hooks/use-providers';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';

export type ProviderCredential = NonNullable<ProviderInfo['userCredential']>;
export type CredentialScope = 'user' | 'org';

export const CREDENTIAL_LABEL: Record<ProviderCredential, string> = { oauth: 'Signed in', api_key: 'Key saved' };
export const SIGN_IN_EXPIRED_LABEL = 'Sign-in expired';
const ORG_SCOPE_MEMBER_REASON = 'Only organization admins can manage org-wide credentials.';

export const SHARED_SOURCE: Partial<Record<ProviderInfo['source'], { label: string; description: string }>> = {
  env: { label: 'From env', description: 'Read from the server environment' },
  deployment: { label: 'From deployment', description: 'Provided by the deployment' },
};

export const CREDENTIAL_STATUS: Record<ProviderCredential, StatusPresentation> = {
  oauth: { label: CREDENTIAL_LABEL.oauth, tone: 'success', description: 'Signed in with a provider account' },
  api_key: { label: CREDENTIAL_LABEL.api_key, tone: 'success', description: 'An API key is saved' },
};

export function sharedSourceStatus(source: ProviderInfo['source']): StatusPresentation | undefined {
  const shared = SHARED_SOURCE[source];
  return shared && { label: shared.label, tone: 'neutral', description: shared.description };
}

/** Without auth there is one local key store, so org-scoped keys live in it too. */
function storedCredentialScope(requested: CredentialScope, authEnabled: boolean): CredentialScope {
  return requested === 'org' && authEnabled ? 'org' : 'user';
}

/** Where keys at the requested scope are stored, and whether the caller may change them. */
export function useCredentialAccess(requested: CredentialScope) {
  const authQuery = useFactoryAuth();
  const orgKeyAdminQuery = useOrgKeyAdminQuery();
  const authEnabled = authQuery.data?.authEnabled === true;
  const scope = storedCredentialScope(requested, authEnabled);
  const readOnly = scope === 'org' && orgKeyAdminQuery.data === false;
  return {
    authEnabled,
    scope,
    requestScope: authEnabled ? scope : undefined,
    readOnly,
    actionsDisabled: authQuery.isPending || readOnly,
    memberReason: readOnly ? ORG_SCOPE_MEMBER_REASON : undefined,
  };
}

/** The credential saved at exactly this scope. Deployment env keys belong to neither scope. */
export function credentialAt(provider: ProviderInfo, scope: CredentialScope): ProviderCredential | undefined {
  if (scope === 'org') {
    if (provider.orgCredential) return provider.orgCredential;
    if (provider.source === 'oauth-org') return 'oauth';
    if (provider.source === 'stored-org') return 'api_key';
    return undefined;
  }
  if (provider.userCredential) return provider.userCredential;
  if (provider.source === 'oauth' || provider.source === 'oauth-user') return 'oauth';
  if (provider.source === 'stored' || provider.source === 'stored-user') return 'api_key';
  return undefined;
}

/** The sign-in at this scope expired and could not be renewed, so requests fail until the user signs in again. */
export function signInExpiredAt(provider: ProviderInfo, scope: CredentialScope): boolean {
  return (scope === 'org' ? provider.orgCredentialExpired : provider.userCredentialExpired) === true;
}

export function isConnectedAt(provider: ProviderInfo, scope: CredentialScope): boolean {
  return credentialAt(provider, scope) !== undefined || SHARED_SOURCE[provider.source] !== undefined;
}

export function signInRequest(provider: ProviderInfo, scope: CredentialScope | undefined): StartProviderOAuthArgs {
  const modes = provider.oauth?.modes ?? [];
  return { provider: provider.provider, mode: modes.length === 1 ? modes[0] : undefined, scope };
}
