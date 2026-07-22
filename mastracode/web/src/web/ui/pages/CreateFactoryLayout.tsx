import { Notice } from '@mastra/playground-ui/components/Notice';
import { matchPath, Outlet, useLocation } from 'react-router';

import { useFactoriesQuery } from '../../../shared/hooks/useFactories';
import { AuthPendingSkeleton } from '../domains/auth/components/RootGuards';
import { ActiveFactoryProvider } from '../domains/workspaces/context/ActiveFactoryProvider';
import { sourceFactoryPath } from '../domains/workspaces/services/factoryPaths';

/**
 * Restores the factory context around the unscoped Create Factory route so it
 * can use the standard application shell without making the new Factory a
 * child of the currently active one.
 */
export function CreateFactoryLayout() {
  const location = useLocation();
  const { data: factories, isPending, isError } = useFactoriesQuery();

  if (isPending) return <AuthPendingSkeleton label="Loading factories" />;

  if (isError) {
    return (
      <div className="grid h-dvh w-full place-items-center bg-surface1 px-4">
        <Notice variant="destructive">Could not load factories. Check the server connection and reload.</Notice>
      </div>
    );
  }

  const sourcePath = sourceFactoryPath(location.state);
  const sourceFactoryId = sourcePath ? matchPath('/factories/:factoryId/*', sourcePath)?.params.factoryId : undefined;
  const activeFactory = factories?.find(factory => factory.id === sourceFactoryId) ?? factories?.[0];

  if (!activeFactory) return null;

  return (
    <ActiveFactoryProvider factoryId={activeFactory.id}>
      <Outlet />
    </ActiveFactoryProvider>
  );
}
