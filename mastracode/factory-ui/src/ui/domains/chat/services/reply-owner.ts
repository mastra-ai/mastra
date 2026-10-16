import { normalizeLegacyProviderId } from '@mastra/code-sdk/providers/model-ids';
import type { OwnerCredential, SessionOwner } from '@mastra/factory/routes/session-owner';

import type { SessionModelCatalog } from '../../../../hooks/useSessionModelCatalog';
import type { ChatSessionContextApi } from '../context/ChatSessionContext';
import { providerDisplayName } from '../../settings/components/provider-display-name';

/** Whose credentials answer a thread: the session owner's own, or the organization's when `id` is absent. */
export interface ReplyOwner {
  id?: string;
  name?: string;
  credentials: SessionOwner['credentials'];
}

export function replyOwner(
  catalog: SessionModelCatalog | undefined,
  sessionOwner: ChatSessionContextApi['owner'],
): ReplyOwner | undefined {
  if (!catalog?.owner) return undefined;
  if (catalog.modelScope === 'factory') return { credentials: catalog.owner.credentials };
  return sessionOwner && { ...sessionOwner, credentials: catalog.owner.credentials };
}

function credentialName(provider: string, credential: OwnerCredential): string {
  return credential.type === 'oauth' ? credential.subscription : `${providerDisplayName(provider)} API key`;
}

function ownerPossessive(owner: ReplyOwner, viewerId: string | undefined): string {
  if (!owner.id) return 'Organization';
  if (owner.id === viewerId) return 'Your';
  return owner.name ? `${owner.name}’s` : 'Personal';
}

export function replyOwnerLabel(owner: ReplyOwner, sdkProvider: string, viewerId: string | undefined) {
  const [sdkProviderRoot = sdkProvider] = sdkProvider.split('.');
  const catalogProvider = normalizeLegacyProviderId(sdkProviderRoot);
  const credential = owner.credentials[catalogProvider];
  return credential ? `${ownerPossessive(owner, viewerId)} ${credentialName(catalogProvider, credential)}` : undefined;
}
