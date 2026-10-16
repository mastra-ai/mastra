import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import { getAuthProviderId, WEB_OAUTH_PROVIDERS } from './provider-credentials.js';

export type OwnerCredential = { type: 'api_key' } | { type: 'oauth'; subscription: string };

/** Whose credential answers a thread per provider: the owner's own, or the organization's when the factory pays. */
export interface SessionOwner {
  /** Keyed by catalog provider (`anthropic`), not the AI SDK's `anthropic.messages` a reply carries. */
  credentials: Record<string, OwnerCredential>;
}

export function ownerCredentialsByModelProvider(
  modelProviders: Iterable<string>,
  records: CredentialRecord[],
): SessionOwner['credentials'] {
  const credentials: SessionOwner['credentials'] = {};
  for (const provider of modelProviders) {
    const record = records.find(candidate => candidate.provider === getAuthProviderId(provider));
    if (record?.credential.type === 'api_key') credentials[provider] = { type: 'api_key' };
    const subscription = WEB_OAUTH_PROVIDERS[provider]?.subscription;
    if (record?.credential.type === 'oauth' && subscription) credentials[provider] = { type: 'oauth', subscription };
  }
  return credentials;
}
