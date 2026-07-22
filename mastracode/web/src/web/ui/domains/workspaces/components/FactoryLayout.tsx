import { Notice } from '@mastra/playground-ui/components/Notice';
import { Navigate, Outlet, useParams } from 'react-router';

import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { AuthPendingSkeleton } from '../../auth/components/RootGuards';
import { ActiveFactoryProvider } from '../context/ActiveFactoryProvider';

/**
 * Route element for `factories/:factoryId`. Validates the route param against
 * the factories list, then mounts `ActiveFactoryProvider` with the resolved
 * ID — the URL is the single source of truth for the active factory.
 */
export function FactoryLayout() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { data: factories, isPending, isError } = useFactoriesQuery();

  if (isPending) return <AuthPendingSkeleton label="Loading factories" />;

  if (isError) {
    return (
      <div className="grid h-dvh w-full place-items-center bg-surface1 px-4">
        <Notice variant="destructive">Could not load factories. Check the server connection and reload.</Notice>
      </div>
    );
  }

  // Unknown/deleted factory: bounce to the landing route, which redirects to
  // the first available factory (or onboarding when none exist).
  if (!factoryId || !factories?.some(factory => factory.id === factoryId)) {
    return <Navigate to="/" replace state={{ routeErrorNotice: 'Factory not found' }} />;
  }

  return (
    <ActiveFactoryProvider factoryId={factoryId}>
      <Outlet />
    </ActiveFactoryProvider>
  );
}
