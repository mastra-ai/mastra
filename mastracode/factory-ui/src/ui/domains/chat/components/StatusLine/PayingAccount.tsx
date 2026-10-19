import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Building2, User } from 'lucide-react';

import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { credentialHolder } from '../../services/reply-credential';
import type { ThreadOwner } from '../../services/reply-credential';

function PayerMark({ payer }: { payer: Partial<ThreadOwner> | undefined }) {
  if (!payer) return <Building2 />;
  if (!payer.name) return <User />;
  return <Avatar name={payer.name} src={payer.avatarUrl} size="xs" />;
}

export function PayingAccount() {
  const authQuery = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const { modelScope } = useChatModelScope();

  if (!authQuery.data?.authEnabled || !modelScope) return null;

  const viewer = authQuery.data.user;
  const payer =
    modelScope === 'factory'
      ? undefined
      : (owner ?? { id: viewer?.userId, name: viewer?.name, avatarUrl: viewer?.avatarUrl });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      tooltip={`${credentialHolder(payer?.id, owner, viewer?.userId)} account pays for replies`}
      className="cursor-help"
    >
      <PayerMark payer={payer} />
    </Button>
  );
}
