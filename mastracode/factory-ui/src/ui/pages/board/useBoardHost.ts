import type { InstalledBoardInfo } from '@internal/factory-contract';

import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { useGithubStatusQuery } from '../../../hooks/useGithubStatus';
import type { FactoryProject } from '../../domains/workspaces/services/github';
import { useBoardFilterSources } from '../../domains/factory/hooks/useBoardFilterSources';
import { useBoardIntakeSetup } from '../../domains/factory/hooks/useBoardIntakeSetup';
import { useBoardRepository } from '../../domains/factory/hooks/useBoardRepository';
import type { BoardHost } from '@mastra/playground-ui/domains/factory';

/** Factory's answers to what the board needs from its host. */
export function useBoardHost(factory: FactoryProject, definition: InstalledBoardInfo): BoardHost {
  const auth = useFactoryAuth();
  const githubStatus = useGithubStatusQuery();
  const user = auth.data?.user;
  return {
    viewer: user && { ...user, githubLogin: githubStatus.data?.userGithubUsername },
    repository: useBoardRepository(factory.id),
    filterSources: useBoardFilterSources(),
    intake: useBoardIntakeSetup({ factoryProjectId: factory.id, repositories: factory.repositories, definition }),
  };
}
