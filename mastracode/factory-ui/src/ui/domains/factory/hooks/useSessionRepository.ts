import { useParams } from 'react-router';

import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import type { ChangeRequestProvider } from '../services/githubSubscriptions';

interface SessionRepository {
  repository: LinkedRepositoryPayload | undefined;
  provider: ChangeRequestProvider;
  loading: boolean;
  failed: boolean;
}

export function useSessionRepository(): SessionRepository {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const session = useUserSessionQuery(sessionId ?? threadId);
  const factory = useFactoryQuery(factoryId);
  const repository = factory.data?.repositories.find(
    candidate => candidate.projectRepositoryId === session.data?.projectRepositoryId,
  );
  return {
    repository,
    provider: repository?.provider === 'gitlab' ? 'gitlab' : 'github',
    loading: session.isLoading || factory.isLoading,
    failed: session.isLoadingError || factory.isLoadingError,
  };
}
