import { useParams } from 'react-router';

import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { Chat } from '../../chat/Chat';
import { isServerFactory } from '../../workspaces/services/factories';

export function DashboardRoute() {
  const { projectId } = useParams();
  const factories = useFactoriesQuery();
  const factory = factories.data.find(item => item.id === projectId);

  if (!factory || !isServerFactory(factory)) return <ProjectNotFound />;
  return <Chat namespace="dashboard" />;
}

function ProjectNotFound() {
  return (
    <main className="flex h-dvh items-center justify-center bg-surface1 text-icon6">
      <h1>Page not found</h1>
    </main>
  );
}
