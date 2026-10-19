import { Wallet } from 'lucide-react';

import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useChatModelScope } from '../../context/useChatModelScope';
import { useChatSessionContext } from '../../context/useChatSessionContext';
import { credentialHolder } from '../../services/reply-credential';
import { statusItem } from './statusItem';

export function PayingAccount() {
  const authQuery = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const { modelScope } = useChatModelScope();

  if (!authQuery.data?.authEnabled || !modelScope) return null;

  const viewerId = authQuery.data.user?.userId;
  const payerId = modelScope === 'factory' ? undefined : (owner?.id ?? viewerId);

  return (
    <span className={statusItem}>
      <Wallet aria-hidden size={13} />
      <span className="sr-only">Runs on </span>
      {`${credentialHolder(payerId, owner, viewerId)} account`}
    </span>
  );
}
