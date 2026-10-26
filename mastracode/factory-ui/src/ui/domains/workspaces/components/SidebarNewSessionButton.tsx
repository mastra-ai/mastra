import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Plus } from 'lucide-react';
import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useOpenNewUserSession } from '../hooks/useOpenNewUserSession';

export function SidebarNewSessionButton() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factory = useFactoryQuery(factoryId);
  const openNewUserSession = useOpenNewUserSession();

  const hasRepositories = (factory.data?.repositories.length ?? 0) > 0;
  if (!factoryId || !hasRepositories) return null;

  return (
    <Sidebar.NavList>
      <Sidebar.NavLink
        render={
          <button type="button" onClick={() => openNewUserSession(factoryId)}>
            <Plus />
            <Sidebar.NavLabel>New session</Sidebar.NavLabel>
          </button>
        }
      />
    </Sidebar.NavList>
  );
}
