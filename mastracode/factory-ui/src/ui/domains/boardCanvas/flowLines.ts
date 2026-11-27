import type { FilterBarOption } from '@mastra/playground-ui/components/FilterBar';
import type { FlowEmphasis, FlowIncomingRule, FlowRuleLine } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo, IntakeRouteInfo } from '../../../api/types';
import { everythingOn, isOpenedLane, laneText } from '../boardRules/ruleLanes';
import type { RuleEvent } from '../boardRules/ruleLanes';
import { boardName, phaseOptions } from '../boardRules/ruleTargets';
import { describeConditions } from '../settings/components/conditionFields';
import { ruleNotes } from './canvasModel';
import type { RuleLine } from './canvasModel';

/** How a numbered chip shows its order: a note naming the rules around it, and its trigger lit while it's pointed at. */
export interface LaneOrder {
  note: (line: RuleLine) => string | undefined;
  /** The trigger of the numbered chip under the pointer or focus; undefined once it leaves. */
  onPeek: (event: RuleEvent | undefined) => void;
}

/**
 * What a rule takes, one line per condition, each after the first led by its group's "and" or "or"; `everything` when
 * it has none. `options` names values, such as a board's phases.
 */
export function conditionLines(
  when: IntakeRouteInfo['when'],
  everything: string,
  options: Record<string, FilterBarOption[]>,
): string[] {
  const described = describeConditions(when, options);
  if (!described) return [everything];
  return described.parts.map((part, index) =>
    index === 0 ? part : `${described.join} ${part.charAt(0).toLowerCase()}${part.slice(1)}`,
  );
}

/**
 * A rule on one trigger as its chip shows it, opening the rule at `href`. `board` is the board the rule is on, naming
 * the phases its conditions mention.
 */
export function flowRuleLine(
  line: RuleLine,
  href: string,
  emphasis: FlowEmphasis,
  lanes: LaneOrder,
  board: InstalledBoardInfo | undefined,
): FlowRuleLine {
  return {
    ruleId: line.rule.id,
    name: line.rule.name,
    enabled: line.rule.enabled,
    event: line.event,
    trigger: laneText(line.event),
    opened: isOpenedLane(line.event),
    rank: line.rank,
    of: line.of,
    label: line.label,
    conditions: conditionLines(line.rule.when, everythingOn(line.event), phaseOptions(board)),
    filed: line.filed,
    skipsOutsiders: line.skipsOutsiders,
    movesCardsOnly: line.movesCardsOnly,
    notes: ruleNotes(line),
    place: lanes.note(line),
    href,
    emphasis,
    onPeek: peeking => lanes.onPeek(peeking ? line.event : undefined),
  };
}

/** Another board's rule that moves its cards onto this board, as its chip shows it, opening the rule at `href`. */
export function flowIncomingRule(
  rule: IntakeRouteInfo,
  boards: readonly InstalledBoardInfo[],
  href: string,
  emphasis: FlowEmphasis,
): FlowIncomingRule {
  const from = boards.find(board => board.id === rule.target.boardKey);
  return {
    ruleId: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    conditions: conditionLines(rule.when, 'Every card', phaseOptions(from)),
    boardName: from ? boardName(from) : rule.target.boardKey,
    href,
    emphasis,
  };
}
