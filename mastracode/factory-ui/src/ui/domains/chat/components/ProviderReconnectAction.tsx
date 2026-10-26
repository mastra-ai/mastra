import { Notice } from '@mastra/playground-ui/components/Notice';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import type { FactoryAuthState } from '../../auth/services/auth';
import { sessionDefaultsAnchor, settingsSectionPath } from '../../settings/settingsSections';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatSessionContext } from '../context/useChatSessionContext';
import type { ThreadOwner } from '../services/reply-credential';

function teammatePayingForSession(
  modelScope: 'factory' | 'user' | undefined,
  owner: ThreadOwner | undefined,
  auth: FactoryAuthState | undefined,
): ThreadOwner | undefined {
  if (modelScope !== 'user' || !owner || !auth?.authEnabled) return undefined;
  if (owner.id === auth.user?.userId) return undefined;
  return owner;
}

export function ProviderReconnectAction() {
  const location = useLocation();
  const { factoryId, modelScope, scopeLoading } = useChatModelScope();
  const { owner } = useChatSessionContext();
  const authQuery = useFactoryAuth();
  const payerUnknown = !factoryId || scopeLoading || authQuery.isPending;
  if (payerUnknown) return null;

  const teammate = teammatePayingForSession(modelScope, owner, authQuery.data);
  if (teammate) return <span>{teammate.name ?? 'The session owner'} needs to reconnect</span>;

  return (
    <Notice.Button
      render={
        <Link
          to={settingsSectionPath(factoryId, 'models', sessionDefaultsAnchor(modelScope))}
          state={{ from: location }}
        />
      }
    >
      Review credentials <ArrowRight aria-hidden="true" />
    </Notice.Button>
  );
}
