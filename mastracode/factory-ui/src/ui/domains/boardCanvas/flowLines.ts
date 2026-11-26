import type { FlowEmphasis, FlowRuleLine } from '@mastra/playground-ui/domains/factory';

import { isOpenedLane, laneText } from '../boardRules/ruleLanes';
import type { RuleEvent } from '../boardRules/ruleLanes';
import { ruleNotes } from './canvasModel';
import type { RuleLine } from './canvasModel';

/** How a numbered chip shows its order: a note naming the rules around it, and its trigger lit while it's pointed at. */
export interface LaneOrder {
  note: (line: RuleLine) => string | undefined;
  /** The trigger of the numbered chip under the pointer or focus; undefined once it leaves. */
  onPeek: (event: RuleEvent | undefined) => void;
}

/** A rule on one trigger as its chip shows it, opening the rule at `href`. */
export function flowRuleLine(line: RuleLine, href: string, emphasis: FlowEmphasis, lanes: LaneOrder): FlowRuleLine {
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
