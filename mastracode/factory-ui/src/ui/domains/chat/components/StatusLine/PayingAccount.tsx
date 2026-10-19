import { Wallet } from 'lucide-react';

import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import type { ThreadOwner } from '../../services/reply-credential';
import { statusItem } from './statusItem';

function personalAccountName(owner: ThreadOwner | undefined, viewerId: string | undefined): string {
  if (!owner || owner.id === viewerId) return 'Your account';
  return owner.name ? `${owner.name}’s account` : 'Session owner’s account';
}

export function PayingAccount() {
  const authQuery = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const { modelScope } = useChatModelScope();

  if (!authQuery.data?.authEnabled || !modelScope) return null;

  const account =
    modelScope === 'factory' ? 'Organization account' : personalAccountName(owner, authQuery.data.user?.userId);

  return (
    <span className={statusItem}>
      <Wallet aria-hidden size={13} />
      <span className="sr-only">Runs on </span>
      {account}
    </span>
  );
}
