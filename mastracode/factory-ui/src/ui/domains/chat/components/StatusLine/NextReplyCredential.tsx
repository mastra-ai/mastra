import { providerDisplayName } from '@mastra/factory/provider-display-name';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Building2, KeyRound, User } from 'lucide-react';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { ProviderBrandIcon } from '../../../workspaces/components/ProviderBrandIcon';
import { useChatModels } from '../../context/useChatModels';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';

type CredentialHolder =
  { kind: 'organization' } | { kind: 'session-owner'; name?: string; avatarUrl?: string; isViewer: boolean };

function holderLine(holder: CredentialHolder): string {
  if (holder.kind === 'organization') return 'Shared by the organization';
  if (holder.isViewer) return holder.name ? `${holder.name} · session owner (you)` : 'You · session owner';
  return holder.name ? `${holder.name} · session owner` : 'Session owner';
}

function teammateWarning(holder: CredentialHolder, credential: string): string | undefined {
  if (holder.kind === 'organization' || holder.isViewer) return undefined;
  return `Your messages use ${holder.name ? `${holder.name}’s` : 'the session owner’s'} ${credential}`;
}

const badgeShell = 'flex size-icon-sm items-center justify-center rounded-full border border-border bg-card';

function HolderBadge({ holder }: { holder: CredentialHolder }) {
  if (holder.kind === 'organization') {
    return (
      <span className={badgeShell}>
        <Building2 className="size-2.5" />
      </span>
    );
  }
  if (!holder.name) {
    return (
      <span className={badgeShell}>
        <User className="size-2.5" />
      </span>
    );
  }
  return (
    <span className="flex [&>[data-slot=avatar]]:size-icon-sm">
      <Avatar name={holder.name} src={holder.avatarUrl} size="xs" />
    </span>
  );
}

export function NextReplyCredential() {
  const authQuery = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const { activeModelId } = useChatModels();
  const { modelScope, catalogTarget } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);

  if (!authQuery.data?.authEnabled || !modelScope) return null;

  const viewer = authQuery.data.user;
  const person = owner ?? { id: viewer?.userId, name: viewer?.name, avatarUrl: viewer?.avatarUrl };
  const holder: CredentialHolder =
    modelScope === 'factory'
      ? { kind: 'organization' }
      : {
          kind: 'session-owner',
          name: person.name,
          avatarUrl: person.avatarUrl,
          isViewer: person.id === viewer?.userId,
        };
  const model = modelsQuery.data?.find(candidate => candidate.id === activeModelId);
  const credential =
    model?.credentialLabel ?? (model ? `${providerDisplayName(model.provider)} connection` : 'Model connection');
  const lines = [credential, holderLine(holder), teammateWarning(holder, credential)];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={lines.filter(Boolean).join('. ')}
            className={cn(
              'relative flex size-avatar-sm shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground',
              focusRing,
            )}
          />
        }
      >
        <ProviderBrandIcon provider={model?.provider ?? ''} fallback={<KeyRound className="size-3.5" />} />
        <span className="absolute -right-1 -bottom-1">
          <HolderBadge holder={holder} />
        </span>
      </TooltipTrigger>
      <TooltipContent className="grid gap-1">
        <span className="font-medium">{lines[0]}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <HolderBadge holder={holder} />
          {lines[1]}
        </span>
        {lines[2] ? <span className="text-warning-foreground">{lines[2]}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
