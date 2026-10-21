import { Notice } from '@mastra/playground-ui/components/Notice';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { settingsSectionPath } from '../../settings/settingsSections';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatSessionContext } from '../context/useChatSessionContext';

export function ProviderReconnectAction() {
  const location = useLocation();
  const { factoryId, modelScope, scopeLoading } = useChatModelScope();
  const { owner } = useChatSessionContext();
  const authQuery = useFactoryAuth();
  const payerUnknown = !factoryId || scopeLoading || authQuery.isPending;
  if (payerUnknown) return null;

  const paidByTeammate =
    modelScope === 'user' &&
    authQuery.data?.authEnabled === true &&
    owner !== undefined &&
    owner.id !== authQuery.data.user?.userId;
  if (paidByTeammate) return <span>{owner.name ?? 'The session owner'} needs to reconnect</span>;

  const section = modelScope === 'factory' ? 'models' : 'personal-models';
  return (
    <Notice.Button render={<Link to={settingsSectionPath(factoryId, section)} state={{ from: location }} />}>
      Login <ArrowRight aria-hidden="true" />
    </Notice.Button>
  );
}
