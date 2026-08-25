import { Notice } from '@mastra/playground-ui/components/Notice';
import { Navigate, Outlet, useParams } from 'react-router';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { AuthPendingSkeleton } from '../../auth/components/RootGuards';
import { GitHubAppCallbackHandler } from './GitHubAppCallbackHandler';
import { WorkspaceAttentionObserver } from './WorkspaceAttentionObserver';

/**
 * Route element for `factories/:factoryId`. Validates the route param against
 * the factories list; the URL is the single source of truth for the active factory.
 */
export function FactoryLayout() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { data: factories, isPending, isError } = useFactoriesQuery();

  if (isPending) return <AuthPendingSkeleton label="Loading factories" />;

  if (isError) {
    return (
      <div className="bg-surface1 grid h-dvh w-full place-items-center px-4">
        <Notice variant="destructive" className="w-full max-w-md">
          Could not load factories. Check the server connection and reload.
        </Notice>
      </div>
    );
  }

  const factory = factories?.find(candidate => candidate.id === factoryId);
  // Unknown/deleted factory: bounce to the landing route, which redirects to
  // the first available factory (or onboarding when none exist).
  if (!factoryId || !factory) {
    return <Navigate to="/" replace state={{ routeErrorNotice: 'Factory not found' }} />;
  }

  return (
    <>
      {factory.repositories.map(repository => (
        <WorkspaceAttentionObserver
          key={repository.projectRepositoryId}
          projectRepositoryId={repository.projectRepositoryId}
        />
      ))}
      <GitHubAppCallbackHandler />
      <Outlet />
    </>
  );
}
