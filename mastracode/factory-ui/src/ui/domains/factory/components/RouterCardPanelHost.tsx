import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { sessionUnavailableError, userSessionQueryOptions } from '../../../../hooks/useWorkspaces';
import { HrefLink } from '../../../ui/HrefLink';
import { WorkspaceSectionSkeleton } from '../../workspace-viewer/components/WorkspaceSection';
import { threadPath } from '../../workspaces/services/factoryPaths';
import { cardProjectRepositoryId } from '../boardRepository';
import { CardPanelHostContext } from '../cardPanelHost';
import type { CardPanelHost } from '../cardPanelHost';
import { relationshipPath } from '../services/relationshipPath';
import { useSourceDescription } from './BoardCardDetails';

/** Factory's card panel host: router links, provider descriptions and session liveness. */
export function RouterCardPanelHost({ factoryId, children }: { factoryId: string; children: ReactNode }) {
  const host = useMemo<CardPanelHost>(
    () => ({
      LinkComponent: HrefLink,
      relatedCardHref: (item, session) =>
        session ? threadPath(factoryId, session) : relationshipPath(item, factoryId),
      useLiveSessions(sessionIds) {
        const { baseUrl } = useApiConfig();
        return useQueries({
          queries: sessionIds.map(sessionId => userSessionQueryOptions(baseUrl, sessionId)),
          combine: results =>
            sessionIds.filter((_, index) => {
              const result = results[index];
              return result?.data !== undefined && !sessionUnavailableError(result);
            }),
        });
      },
      useSourceDescription(item, repository) {
        const repositories = useFactoryQuery(factoryId).data?.repositories ?? [];
        const projectRepositoryId = cardProjectRepositoryId(repositories, item, repository?.projectRepositoryId);
        return useSourceDescription(item, projectRepositoryId, factoryId);
      },
      workspaceSkeleton: <WorkspaceSectionSkeleton />,
    }),
    [factoryId],
  );
  return <CardPanelHostContext.Provider value={host}>{children}</CardPanelHostContext.Provider>;
}
