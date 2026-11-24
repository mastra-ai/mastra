import { Txt } from '@mastra/playground-ui/components/Txt';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../../api/types';
import { laneText } from '../../boardRules/ruleLanes';
import { boardName, phaseName, phaseOptions } from '../../boardRules/ruleTargets';
import { describeRule } from '../../settings/components/conditionFields';

/**
 * One rule, read from a board: what fires it, the board it lives on or sends cards to when that is another, and the
 * cards it takes.
 */
export function RuleRow({
  rule,
  boardId,
  boards,
}: {
  rule: IntakeRouteInfo;
  boardId: string;
  boards: readonly InstalledBoardInfo[] | undefined;
}) {
  const home = boards?.find(board => board.id === rule.target.boardKey);
  const elsewhere = rule.target.boardKey !== boardId;
  const destination = rule.target.moveToBoardKey ?? rule.target.boardKey;
  const away = destination !== boardId ? boards?.find(board => board.id === destination) : undefined;
  return (
    <li className="bg-fill-subtle flex min-w-0 flex-col gap-0.5 rounded-md px-2.5 py-2">
      <Txt as="span" variant="caption" tone="muted" className="truncate">
        {elsewhere && `${home ? boardName(home) : rule.target.boardKey}: `}
        {rule.on.map(event => laneText(event).label).join(' or ')}
      </Txt>
      <Txt as="span" variant="body-sm" className="truncate">
        {describeRule(rule.when, phaseOptions(home))}
      </Txt>
      {destination !== boardId && (
        <Txt as="span" variant="caption" tone="muted" className="truncate">
          To{' '}
          {[away ? boardName(away) : destination, phaseName(away, rule.target.phaseKey) ?? rule.target.phaseKey]
            .filter(Boolean)
            .join(', ')}
        </Txt>
      )}
    </li>
  );
}
