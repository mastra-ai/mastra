import { useBoardCatalog } from '../../../hooks/useBoardCatalog';
import { useIntakeDryRunQuery } from '../../../hooks/useIntakeDryRun';
import { useIntakeOrderQuery, useSkippedRulesQuery } from '../../../hooks/useIntakeOrder';
import { useIntakeRoutesQuery } from '../../../hooks/useIntakeRoutes';
import { useBoardPhasesQuery } from '../../../hooks/useWorkItems';
import { boardFiltersFromParams } from '../factory/boardFilters';
import { boardPhasesRequest } from '../factory/boardPhasesRequest';
import { DEFAULT_BOARD_SORT } from '../factory/boardSort';
import type { RuleSkips } from './canvasModel';

/** No filter picked, as the board page first opens. */
const NO_FILTERS = boardFiltersFromParams(new URLSearchParams(), true);

/**
 * Everything the canvas shows around the board itself: the project's rules, the intake order, the last 30 days of
 * what rules filed and skipped, and the cards in each phase now. Each part loads on its own; the canvas shows what
 * has answered.
 */
export function useCanvasData(factoryId: string, boardId: string) {
  const catalog = useBoardCatalog(factoryId);
  const routes = useIntakeRoutesQuery(factoryId);
  const order = useIntakeOrderQuery(factoryId);
  const skipped = useSkippedRulesQuery(factoryId);
  const dryRun = useIntakeDryRunQuery(factoryId);
  // The board page's default view, so opening settings from the board reads its cache.
  const cards = useBoardPhasesQuery(
    factoryId,
    boardPhasesRequest({
      board: boardId,
      sort: DEFAULT_BOARD_SORT,
      search: '',
      filters: NO_FILTERS,
      windows: {},
      item: undefined,
    }),
  );

  const filed = new Map(
    (dryRun.data?.boards ?? []).flatMap(board => board.rules.map(rule => [rule.routeId, rule.filed] as const)),
  );
  const skips = new Map<string, RuleSkips>((skipped.data?.skipped ?? []).map(skip => [skip.routeId, skip]));
  const totals = new Map((cards.data?.phases ?? []).map(phase => [phase.phase, phase.total] as const));

  return {
    boards: catalog.data ?? [],
    installed: catalog.data?.find(board => board.id === boardId),
    /** Undefined until the rules load, so nothing claims a phase is unreached on a failed load. */
    rules: routes.data?.intakeRoutes,
    rulesFailed: routes.isError,
    rulesEditable: routes.data?.canEdit ?? false,
    order: order.data,
    filed,
    skips,
    totals,
  };
}
