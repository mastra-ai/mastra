import type { SessionPayer } from '@mastra/factory/routes/session-payer';

import { providerDisplayName } from '../../settings/components/provider-display-name';

type CredentialKind = SessionPayer['credentials'][string];

const SUBSCRIPTION_NAMES: Record<string, string> = {
  anthropic: 'Claude Pro/Max',
  openai: 'ChatGPT Plus/Pro',
};

function credentialName(provider: string, kind: CredentialKind): string {
  if (kind === 'api_key') return `${providerDisplayName(provider)} API key`;
  return SUBSCRIPTION_NAMES[provider] ?? `${providerDisplayName(provider)} subscription`;
}

function payerPossessive(user: SessionPayer['user'], viewerId: string | undefined): string {
  if (!user) return 'Organization';
  if (user.id === viewerId) return 'Your';
  return user.name ? `${user.name}’s` : 'Personal';
}

export function replyPayerLabel(payer: SessionPayer, sdkProvider: string, viewerId: string | undefined) {
  const [catalogProvider = sdkProvider] = sdkProvider.split('.');
  const kind = payer.credentials[catalogProvider];
  return kind ? `${payerPossessive(payer.user, viewerId)} ${credentialName(catalogProvider, kind)}` : undefined;
}
