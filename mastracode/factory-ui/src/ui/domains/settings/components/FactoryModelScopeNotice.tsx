import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../../hooks/useFactoryDefaultModel';
import { settingsSectionPath } from '../settingsSections';

/**
 * Personal credentials are invisible to an organization-scoped Factory (the
 * scopes are exclusive), so a "Signed in" provider here can still fail every
 * run. Say so on the page where users go to fix credentials.
 */
export function FactoryModelScopeNotice() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const authQuery = useFactoryAuth();
  const projectQuery = useFactoryProjectQuery(factoryId);

  if (!factoryId || authQuery.data?.authEnabled !== true) return null;
  if ((projectQuery.data?.modelScope ?? 'user') !== 'factory') return null;

  return (
    <Txt as="p" variant="caption" tone="muted" className="m-0" role="note">
      This Factory uses organization models and credentials only, so sessions here don&apos;t use your personal
      provider sign-ins or default model. Organization credentials and the model scope are managed in{' '}
      <Link to={settingsSectionPath(factoryId, 'models')} className="underline">
        Factory models settings
      </Link>
      .
    </Txt>
  );
}
