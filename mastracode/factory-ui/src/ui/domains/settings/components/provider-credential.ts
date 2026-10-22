import type { ProviderInfo } from '../../../../api/types';

export type ProviderCredential = NonNullable<ProviderInfo['userCredential']>;

/** The credential saved at exactly this scope. Deployment env keys belong to neither scope. */
export function credentialAt(provider: ProviderInfo, scope: 'org' | 'user'): ProviderCredential | undefined {
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
