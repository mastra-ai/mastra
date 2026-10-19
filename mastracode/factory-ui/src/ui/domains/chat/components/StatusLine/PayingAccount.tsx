import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Building2, User } from 'lucide-react';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useChatModels } from '../../context/useChatModels';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { credentialName } from '../../services/reply-credential';
import type { ThreadOwner } from '../../services/reply-credential';

function PayerMark({ payer }: { payer: Partial<ThreadOwner> | undefined }) {
  if (!payer) return <Building2 />;
  if (!payer.name) return <User />;
  return <Avatar name={payer.name} src={payer.avatarUrl} size="xs" />;
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

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      tooltip={credentialName(credentialLabel ?? 'account', payer?.id, owner, viewer?.userId)}
      className="cursor-help"
    >
      <PayerMark payer={payer} />
    </Button>
  );
}
