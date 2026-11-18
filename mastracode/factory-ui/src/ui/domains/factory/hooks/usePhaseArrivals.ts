import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { boardFlow } from '../../boardRules/boardFlow';

/** The board's start phase and, once the rules load, the live rules moving cards into each of its phases. */
export function usePhaseArrivals(factoryId: string, boardId: string, firstPhase: string | undefined) {
  const catalog = useBoardCatalog(factoryId);
  const routes = useIntakeRoutesQuery(factoryId);
  const start = catalog.data?.find(candidate => candidate.id === boardId)?.initialPhase ?? firstPhase;
  const into =
    routes.data && start ? boardFlow(routes.data.intakeRoutes, { key: boardId, initialPhase: start }).into : undefined;
  return { start, into, loading: routes.isPending, boards: catalog.data };
}
