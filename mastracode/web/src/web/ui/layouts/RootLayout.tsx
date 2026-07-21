import { Notice } from '@mastra/playground-ui/components/Notice';
import { Navigate, Outlet, useLocation } from 'react-router';

import { useFactoriesQuery } from '../../../shared/hooks/useFactories';
import { useGithubStatusQuery } from '../../../shared/hooks/useGithubStatus';
import { useWorkItemsQuery } from '../../../shared/hooks/useWorkItems';
import { AuthGuard, AuthPending } from '../domains/auth';
import { isServerFactory } from '../domains/workspaces/services/factories';
import { projectEntry, projectPath } from '../lib/projectRoutes';

export function RootLayout() {
  return <AuthGuard />;
}

export function ProjectAccessGuard() {
  const location = useLocation();

  if (location.pathname !== '/') return <Outlet />;
  return <RootProjectResolver />;
}

function RootProjectResolver() {
  const factories = useFactoriesQuery();
  const github = useGithubStatusQuery();
  const available = factories.data;
  const selectedId = localStorage.getItem('mastracode-active-factory');
  const selected = available.find(factory => factory.id === selectedId) ?? available[0];
  const factoryProjectId = selected && isServerFactory(selected) ? selected.binding.factoryProjectId : undefined;
  const workItems = useWorkItemsQuery(factoryProjectId);

  if (factories.isFetching || github.isPending) return <AuthPending label="Loading projects" />;
  if (!github.data?.enabled) {
    const local = available.find(factory => !isServerFactory(factory));
    return <Navigate to={local ? projectEntry(local) : '/onboarding'} replace />;
  }
  if (!selected) return <Navigate to="/onboarding" replace />;
  if (factoryProjectId && workItems.isPending) return <AuthPending label="Loading Factory board" />;
  if (factoryProjectId && workItems.isError) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-surface1 p-4">
        <Notice variant="destructive">
          {workItems.error instanceof Error ? workItems.error.message : 'Failed to load Factory work'}
        </Notice>
      </div>
    );
  }
  return (
    <Navigate
      to={projectPath(selected, factoryProjectId && (workItems.data?.length ?? 0) > 0 ? 'factory/board' : 'new')}
      replace
    />
  );
}
