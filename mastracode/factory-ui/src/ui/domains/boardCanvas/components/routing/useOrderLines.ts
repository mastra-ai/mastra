import { useIntakeDryRunQuery } from '../../../../../hooks/useIntakeDryRun';
import { useSkippedRulesQuery } from '../../../../../hooks/useIntakeOrder';
import { useIntakeRoutesQuery } from '../../../../../hooks/useIntakeRoutes';
import { isOpenedLane } from '../../../boardRules/ruleLanes';
import type { RuleEvent } from '../../../boardRules/ruleLanes';
import { boardRulesOf, ruleLines } from '../../canvasModel';
import type { RuleLine } from '../../canvasModel';

/**
 * Each board's rules on the arrival triggers, with what they filed in the last 30 days, and those counts summed per
 * trigger. `lines` is undefined while the rules load, `filedByEvent` while the counts do.
 */
export function useOrderLines(factoryId: string, boardKeys: readonly string[]) {
  const rules = useIntakeRoutesQuery(factoryId).data?.intakeRoutes;
  const dryRun = useIntakeDryRunQuery(factoryId).data;
  const skipped = useSkippedRulesQuery(factoryId).data?.skipped;

  const filed = dryRun && new Map(dryRun.boards.flatMap(board => board.rules.map(rule => [rule.routeId, rule.filed])));
  const skips = new Map((skipped ?? []).map(entry => [entry.routeId, entry]));
  const lines =
    rules &&
    new Map(
      boardKeys.map(boardKey => [
        boardKey,
        ruleLines(boardRulesOf(rules, boardKey), { filed, skips }).filter(line => isOpenedLane(line.event)),
      ]),
    );

  return { lines, filedByEvent: filed && filedPerEvent(lines?.values() ?? []) };
}

function filedPerEvent(boards: Iterable<readonly RuleLine[]>): Map<RuleEvent, number> {
  const counts = new Map<RuleEvent, number>();
  for (const lines of boards) {
    for (const line of lines) counts.set(line.event, (counts.get(line.event) ?? 0) + (line.filed ?? 0));
  }
  return counts;
}
