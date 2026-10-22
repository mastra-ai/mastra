import type { ProviderInfo } from '../../../../api/types';

export type ProviderCredential = NonNullable<ProviderInfo['userCredential']>;
export type CredentialScope = 'user' | 'org';

export const CREDENTIAL_LABEL: Record<ProviderCredential, string> = { oauth: 'Signed in', api_key: 'Key saved' };

export const SHARED_SOURCE: Partial<Record<ProviderInfo['source'], { label: string; description: string }>> = {
  env: { label: 'From env', description: 'Read from the server environment' },
  deployment: { label: 'From deployment', description: 'Provided by the deployment' },
};

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
