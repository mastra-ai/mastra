import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';
import type { OwnerCredential, SessionOwner } from '@mastra/factory/routes/session-owner';

import { providerDisplayName } from '../../settings/components/provider-display-name';

function credentialName(provider: string, credential: OwnerCredential): string {
  return credential.type === 'oauth' ? credential.subscription : `${providerDisplayName(provider)} API key`;
}

function ownerPossessive(user: SessionOwner['user'], viewerId: string | undefined): string {
  if (!user) return 'Organization';
  if (user.id === viewerId) return 'Your';
  return user.name ? `${user.name}’s` : 'Personal';
}

export function replyOwnerLabel(owner: SessionOwner, sdkProvider: string, viewerId: string | undefined) {
  const [sdkProviderRoot = sdkProvider] = sdkProvider.split('.');
  const catalogProvider = normalizeLegacyProviderId(sdkProviderRoot);
  const credential = owner.credentials[catalogProvider];
  return credential
    ? `${ownerPossessive(owner.user, viewerId)} ${credentialName(catalogProvider, credential)}`
    : undefined;
}
