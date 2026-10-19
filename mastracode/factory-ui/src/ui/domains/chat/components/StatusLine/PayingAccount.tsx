import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Building2, User } from 'lucide-react';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useChatModels } from '../../context/useChatModels';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { credentialName } from '../../services/reply-credential';
import type { ThreadOwner } from '../../services/reply-credential';

function PayerMark({ payer }: { payer: Partial<ThreadOwner> | undefined }) {
  if (!payer) return <Building2 className="size-icon-sm" />;
  if (!payer.name) return <User className="size-icon-sm" />;
  return <Avatar name={payer.name} src={payer.avatarUrl} size="sm" />;
}

export function PayingAccount() {
  const authQuery = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const { activeModelId } = useChatModels();
  const { modelScope, catalogTarget } = useChatModelScope();
  const modelsQuery = useAvailableModelsQuery(catalogTarget);

  if (!authQuery.data?.authEnabled || !modelScope) return null;

  const viewer = authQuery.data.user;
  const payer =
    modelScope === 'factory'
      ? undefined
      : (owner ?? { id: viewer?.userId, name: viewer?.name, avatarUrl: viewer?.avatarUrl });
  const credentialLabel = modelsQuery.data?.find(model => model.id === activeModelId)?.credentialLabel;
  const name = credentialName(credentialLabel ?? 'account', payer?.id, owner, viewer?.userId);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={name}
            className={cn(
              'flex size-avatar-sm shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground',
              focusRing,
            )}
          />
        }
      >
        <PayerMark payer={payer} />
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
