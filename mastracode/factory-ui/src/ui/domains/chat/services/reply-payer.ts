import type { PayerCredential, SessionPayer } from '@mastra/factory/routes/session-payer';

import { providerDisplayName } from '../../settings/components/provider-display-name';

function credentialName(provider: string, credential: PayerCredential): string {
  return credential.type === 'oauth' ? credential.subscription : `${providerDisplayName(provider)} API key`;
}

function payerPossessive(user: SessionPayer['user'], viewerId: string | undefined): string {
  if (!user) return 'Organization';
  if (user.id === viewerId) return 'Your';
  return user.name ? `${user.name}’s` : 'Personal';
}

export function replyPayerLabel(payer: SessionPayer, sdkProvider: string, viewerId: string | undefined) {
  const [catalogProvider = sdkProvider] = sdkProvider.split('.');
  const credential = payer.credentials[catalogProvider];
  return credential
    ? `${payerPossessive(payer.user, viewerId)} ${credentialName(catalogProvider, credential)}`
    : undefined;
}
