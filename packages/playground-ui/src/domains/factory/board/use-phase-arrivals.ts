import type { InstalledBoardInfo, IntakeRouteInfo } from '@mastra/client-js';
import { useBoardCatalog, useIntakeRoutesQuery } from '@mastra/react/hooks/factory';
import { boardFlow } from '../rules/board-flow';

/** The board's start phase and, once the rules load, the live rules moving cards into each of its phases. */
export interface PhaseArrivals {
  start: string | undefined;
  into: Map<string, IntakeRouteInfo[]> | undefined;
  loading: boolean;
  boards: InstalledBoardInfo[] | undefined;
}

export function usePhaseArrivals(factoryId: string, boardId: string, firstPhase: string | undefined): PhaseArrivals {
  const catalog = useBoardCatalog(factoryId);
  const routes = useIntakeRoutesQuery(factoryId);
  const start = catalog.data?.find(candidate => candidate.id === boardId)?.initialPhase ?? firstPhase;
  const into =
    routes.data && start ? boardFlow(routes.data.intakeRoutes, { key: boardId, initialPhase: start }).into : undefined;
  return { start, into, loading: routes.isPending, boards: catalog.data };
}
