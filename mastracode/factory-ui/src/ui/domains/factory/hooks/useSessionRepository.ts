import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { FactoryProject, LinkedRepositoryPayload } from '../../workspaces/services/github';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import type { ChangeRequestProvider } from '../services/githubSubscriptions';

interface SessionRepository {
  repository: LinkedRepositoryPayload | undefined;
  provider: ChangeRequestProvider;
  loading: boolean;
  failed: boolean;
}

export function repositoryProvider(repository: LinkedRepositoryPayload | undefined): ChangeRequestProvider {
  return repository?.provider === 'gitlab' ? 'gitlab' : 'github';
}

export function linkedSessionRepository(
  factory: FactoryProject | undefined,
  session: Pick<FactoryUserSession, 'projectRepositoryId'> | undefined,
): Pick<SessionRepository, 'repository' | 'provider'> {
  const repository = factory?.repositories.find(
    candidate => candidate.projectRepositoryId === session?.projectRepositoryId,
  );
  return { repository, provider: repositoryProvider(repository) };
}

export function useSessionRepository(): SessionRepository {
  const { factoryId } = useParams<{ factoryId: string }>();
  const session = useUserSessionQuery(useRouteSessionId());
  const factory = useFactoryQuery(factoryId);
  return {
    ...linkedSessionRepository(factory.data, session.data),
    loading: session.isLoading || factory.isLoading,
    failed: session.isLoadingError || factory.isLoadingError,
  };
}
