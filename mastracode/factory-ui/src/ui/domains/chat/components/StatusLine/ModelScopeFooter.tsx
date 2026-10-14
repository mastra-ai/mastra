import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link } from 'react-router';

import { useFactoryAuth } from '../../../../../hooks/useFactoryAuth';
import { useFactoryProjectQuery } from '../../../../../hooks/useFactoryDefaultModel';
import { settingsSectionPath } from '../../../settings/settingsSections';

/** Whether the picker's list is narrowed to organization credentials, so it should say so. */
export function useOrganizationScopedFactory(factoryId: string | undefined): boolean {
  const authQuery = useFactoryAuth();
  const projectQuery = useFactoryProjectQuery(factoryId);
  return authQuery.data?.authEnabled === true && projectQuery.data?.modelScope === 'factory';
}

/**
 * The picker only lists models the Factory's organization credentials can run,
 * so a personally connected provider is missing from it. Say why.
 */
export function ModelScopeFooter({ factoryId }: { factoryId: string }) {
  return (
    <Txt as="p" variant="caption" tone="muted" role="note" className="border-t border-border px-3 py-2">
      Showing models this Factory&apos;s organization credentials can run.{' '}
      <Link to={settingsSectionPath(factoryId, 'models')} className="underline underline-offset-2">
        Manage
      </Link>
    </Txt>
  );
}
