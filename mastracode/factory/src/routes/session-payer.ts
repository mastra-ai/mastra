import type { IUserProvider } from '@mastra/core/server';

import type { CredentialRecord } from '../storage/domains/credentials/base.js';
import { getAuthProviderId } from './provider-credentials.js';

type CredentialKind = CredentialRecord['credential']['type'];

/** Whose credentials answer a thread: a person's own, or the organization's when `user` is absent. */
export interface SessionPayer {
  user?: { id: string; name?: string };
  /** Keyed by catalog provider (`anthropic`), not the AI SDK's `anthropic.messages` a reply carries. */
  credentials: Record<string, CredentialKind>;
}

export async function resolvePayerUser({
  payerUserId,
  viewerUserId,
  users,
}: {
  payerUserId: string;
  viewerUserId: string;
  users?: Pick<IUserProvider, 'getUser'>;
}): Promise<NonNullable<SessionPayer['user']>> {
  if (payerUserId === viewerUserId || !users) return { id: payerUserId };
  try {
    const profile = await users.getUser(payerUserId);
    const name = profile?.name?.trim() || profile?.email?.trim();
    return name ? { id: payerUserId, name } : { id: payerUserId };
  } catch (error) {
    console.warn('[Factory Config] Payer profile lookup failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { id: payerUserId };
  }
}

export function credentialKindsByModelProvider(
  modelProviders: Iterable<string>,
  records: CredentialRecord[],
): SessionPayer['credentials'] {
  const kinds: SessionPayer['credentials'] = {};
  for (const provider of modelProviders) {
    const record = records.find(candidate => candidate.provider === getAuthProviderId(provider));
    if (record) kinds[provider] = record.credential.type;
  }
  return kinds;
}
