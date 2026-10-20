import { Notice } from '@mastra/playground-ui/components/Notice';
import { ArrowRight } from 'lucide-react';
import { useContext } from 'react';
import { Link, useLocation } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { settingsSectionPath } from '../../settings/settingsSections';
import { ChatModelsContext } from '../context/ChatModelsContext';
import { useChatModelScope } from '../context/useChatModelScope';
import { useChatSessionContext } from '../context/useChatSessionContext';

/**
 * Sends the user to the settings page that owns the credential the session
 * runs on: organization credentials for factory-scoped sessions, the user's
 * own sign-ins otherwise. A credential the viewer cannot repair names who can.
 */
export function ProviderLoginAction({ label = 'Login' }: { label?: string }) {
  const location = useLocation();
  const auth = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const models = useContext(ChatModelsContext);
  const { factoryId, modelScope, scopeLoading, sessionModelsQuery } = useChatModelScope();
  // Wait for the scope so the link never points at the wrong credentials page.
  if (!factoryId || scopeLoading || !modelScope) return null;

  const activeModel = sessionModelsQuery.data?.models.find(model => model.id === models?.activeModelId);
  if (activeModel?.credentialHolder === 'deployment') {
    return (
      <Notice.Message>This model uses server credentials. Ask the server administrator to review them.</Notice.Message>
    );
  }

  const organizationCredential = activeModel?.credentialHolder
    ? activeModel.credentialHolder === 'organization'
    : modelScope === 'factory';
  const teammateOwner = auth.data?.authEnabled && owner && owner.id !== auth.data.user?.userId ? owner : undefined;
  if (!organizationCredential && teammateOwner) {
    return (
      <Notice.Message>
        Ask {teammateOwner.name ?? 'the session owner'} to review the credentials used by this session.
      </Notice.Message>
    );
  }

  const section = organizationCredential ? 'models' : 'personal-models';
  return (
    <Notice.Button render={<Link to={settingsSectionPath(factoryId, section)} state={{ from: location }} />}>
      {label} <ArrowRight aria-hidden="true" />
    </Notice.Button>
  );
}
