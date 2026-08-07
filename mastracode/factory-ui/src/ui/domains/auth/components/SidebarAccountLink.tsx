import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { CircleUserRound } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { settingsSectionPath } from '../../settings/settingsSections';

export function SidebarAccountLink() {
  const auth = useFactoryAuth();
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <li role="status" aria-label="Checking sign-in" className="flex h-9 items-center gap-2 px-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </li>
    );
  }

  const state = auth.data;
  if (!factoryId || !state?.authEnabled || !state.authenticated) return null;

  const identity = state.user?.name ?? state.user?.email ?? 'User';

  return (
    <MainSidebar.NavLink
      asChild
      link={{
        name: 'My account',
        url: settingsSectionPath(factoryId, 'account'),
        icon: <CircleUserRound />,
      }}
    >
      <Link
        to={settingsSectionPath(factoryId, 'account')}
        state={{ from: location }}
        aria-label="My account"
        title={identity}
      >
        <CircleUserRound aria-hidden="true" />
        <MainSidebar.NavLabel>{identity}</MainSidebar.NavLabel>
      </Link>
    </MainSidebar.NavLink>
  );
}
