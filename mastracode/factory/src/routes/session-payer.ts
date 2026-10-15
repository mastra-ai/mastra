import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import { getAuthProviderId, WEB_OAUTH_PROVIDERS } from './provider-credentials.js';

export type PayerCredential = { type: 'api_key' } | { type: 'oauth'; subscription: string };

/** Whose credentials answer a thread: a person's own, or the organization's when `user` is absent. */
export interface SessionPayer {
  user?: { id: string; name?: string };
  /** Keyed by catalog provider (`anthropic`), not the AI SDK's `anthropic.messages` a reply carries. */
  credentials: Record<string, PayerCredential>;
}

export function payerCredentialsByModelProvider(
  modelProviders: Iterable<string>,
  records: CredentialRecord[],
): SessionPayer['credentials'] {
  const credentials: SessionPayer['credentials'] = {};
  for (const provider of modelProviders) {
    const record = records.find(candidate => candidate.provider === getAuthProviderId(provider));
    if (record?.credential.type === 'api_key') credentials[provider] = { type: 'api_key' };
    const subscription = WEB_OAUTH_PROVIDERS[provider]?.subscription;
    if (record?.credential.type === 'oauth' && subscription) credentials[provider] = { type: 'oauth', subscription };
  }
  return credentials;
}
