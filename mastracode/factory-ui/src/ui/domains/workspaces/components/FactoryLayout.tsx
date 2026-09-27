import { Notice } from '@mastra/playground-ui/components/Notice';
import { createContext, useContext } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { AuthPendingSkeleton } from '../../auth/components/RootGuards';
import { FeedEventsProvider } from '../../factory/context/FeedEventsProvider';
import { GitHubAppCallbackHandler } from './GitHubAppCallbackHandler';
import type { FactoryProject } from '../services/github';
import { SessionRunObserver } from './SessionRunObserver';

const ActiveFactoryContext = createContext<FactoryProject | null>(null);

/** The routed factory; only valid below `FactoryLayout`, which guarantees it exists. */
export function useActiveFactory(): FactoryProject {
  const factory = useContext(ActiveFactoryContext);
  if (!factory) throw new Error('useActiveFactory must be used below FactoryLayout');
  return factory;
}

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
      <div className="bg-sidebar grid h-dvh w-full place-items-center px-4">
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
    <ActiveFactoryContext.Provider value={factory}>
      <GitHubAppCallbackHandler />
      <FeedEventsProvider factoryProjectId={factory.id}>
        {factory.repositories.map(repository => (
          <SessionRunObserver
            key={repository.projectRepositoryId}
            projectRepositoryId={repository.projectRepositoryId}
          />
        ))}
        <Outlet />
      </FeedEventsProvider>
    </ActiveFactoryContext.Provider>
  );
}
