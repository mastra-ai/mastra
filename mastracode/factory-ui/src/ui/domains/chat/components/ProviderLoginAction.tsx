import { Notice } from '@mastra/playground-ui/components/Notice';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { settingsSectionPath } from '../../settings/settingsSections';
import { useChatModelScope } from '../context/useChatModelScope';

/**
 * Sends the user to the settings page that owns the credential the session
 * runs on: organization credentials for factory-scoped sessions, the user's
 * own sign-ins otherwise.
 */
export function ProviderLoginAction() {
  const location = useLocation();
  const { factoryId, modelScope, scopeLoading } = useChatModelScope();
  // Wait for the scope so the link never points at the wrong credentials page.
  if (!factoryId || scopeLoading) return null;

  const section = modelScope === 'factory' ? 'models' : 'personal-models';
  return (
    <Notice.Button render={<Link to={settingsSectionPath(factoryId, section)} state={{ from: location }} />}>
      Login <ArrowRight aria-hidden="true" />
    </Notice.Button>
  );
}
