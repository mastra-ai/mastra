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
 * own sign-ins otherwise.
 */
export function ProviderLoginAction({ label = 'Login' }: { label?: string }) {
  const location = useLocation();
  const auth = useFactoryAuth();
  const { owner } = useChatSessionContext();
  const models = useContext(ChatModelsContext);
  const { factoryId, modelScope, scopeLoading, sessionModelsQuery } = useChatModelScope();
  const model = sessionModelsQuery.data?.models.find(candidate => candidate.id === models?.activeModelId);
  // Wait for the scope so the link never points at the wrong credentials page.
  if (!factoryId || scopeLoading || !modelScope || !auth.isSuccess) return null;

  if (model?.credentialHolder === 'deployment') {
    return (
      <Notice.Message>This model uses server credentials. Ask the server administrator to review them.</Notice.Message>
    );
  }

  const organizationCredential = model?.credentialHolder
    ? model.credentialHolder === 'organization'
    : modelScope === 'factory';
  if (!organizationCredential && auth.data.authEnabled && owner && owner.id !== auth.data.user?.userId) {
    return (
      <Notice.Message>
        Ask {owner.name ?? 'the session owner'} to review the credentials used by this session.
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
