import { providerDisplayName } from '@mastra/factory/provider-display-name';
import type { ModelCredentialHolder } from '@mastra/factory/routes/config';

import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { FactoryAuthState } from '../../auth/services/auth';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatSessionContext } from '../context/useChatSessionContext';
import type { ThreadOwner } from '../services/reply-credential';

export type CredentialHolder =
  | { kind: 'organization' }
  | { kind: 'deployment' }
  | { kind: 'teammate-owner'; name?: string; avatarUrl?: string }
  | { kind: 'you'; name?: string; avatarUrl?: string; ownsSession: boolean };

export interface ModelCredential {
  provider: string;
  credential: string;
  holder: CredentialHolder;
  holderDescription: string;
  warning?: string;
}

function personalHolder(
  owner: ThreadOwner | undefined,
  viewer: FactoryAuthState['user'],
  isDraft: boolean,
): CredentialHolder {
  if (owner && owner.id !== viewer?.userId) {
    return { kind: 'teammate-owner', name: owner.name, avatarUrl: owner.avatarUrl };
  }
  const you = owner ?? { name: viewer?.name, avatarUrl: viewer?.avatarUrl };
  return { kind: 'you', name: you.name, avatarUrl: you.avatarUrl, ownsSession: Boolean(owner) || isDraft };
}

function resolveHolder(
  credentialHolder: ModelCredentialHolder,
  owner: ThreadOwner | undefined,
  viewer: FactoryAuthState['user'],
  isDraft: boolean,
): CredentialHolder {
  switch (credentialHolder) {
    case 'organization':
      return { kind: 'organization' };
    case 'deployment':
      return { kind: 'deployment' };
    case 'personal':
      return personalHolder(owner, viewer, isDraft);
    default:
      return credentialHolder satisfies never;
  }
}

function describeHolder(holder: CredentialHolder): string {
  if (holder.kind === 'organization') return 'Shared by the organization';
  if (holder.kind === 'deployment') return 'Configured on the server';
  if (holder.kind === 'teammate-owner') return holder.name ? `${holder.name} · session owner` : 'Session owner';
  if (!holder.ownsSession) return holder.name ? `${holder.name} (you)` : 'You';
  return holder.name ? `${holder.name} · session owner (you)` : 'You · session owner';
}

function teammateWarning(holder: CredentialHolder, credential: string): string | undefined {
  if (holder.kind !== 'teammate-owner') return undefined;
  return `Your messages use ${holder.name ? `${holder.name}’s` : 'the session owner’s'} ${credential}`;
}

/** The credential this session's requests to `modelId` run on right now, and who holds it. */
export function useModelCredential(modelId: string | undefined): ModelCredential | undefined {
  const authQuery = useFactoryAuth();
  const { owner, draftSessionId } = useChatSessionContext();
  const { catalogTarget } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);
  const model = modelId ? modelsQuery.data?.find(entry => entry.id === modelId) : undefined;

  if (!authQuery.data?.authEnabled || !model?.credentialHolder) return undefined;

  const holder = resolveHolder(model.credentialHolder, owner, authQuery.data.user, Boolean(draftSessionId));
  const credential = model.credentialLabel ?? `${providerDisplayName(model.provider)} connection`;
  return {
    provider: model.provider,
    credential,
    holder,
    holderDescription: describeHolder(holder),
    warning: teammateWarning(holder, credential),
  };
}
