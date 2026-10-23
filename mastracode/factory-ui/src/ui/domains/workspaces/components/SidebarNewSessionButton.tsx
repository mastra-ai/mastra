import { Button } from '@mastra/playground-ui/components/Button';
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
    <Button icon={<Plus />} className="w-full justify-start" onClick={() => openNewUserSession(factoryId)}>
      New session
    </Button>
  );
}
