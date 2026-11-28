import type { InstalledBoardInfo } from '@mastra/client-js';

import { RuleRank, OrderRuleRow as SharedOrderRuleRow, phaseName, boardPhaseIconKind, ruleNotes } from '..';
import type { RuleLine } from '..';
import { LaneIcon } from './lane-icon';

/** One rule in an order card: its trigger, name, the phase it files into and what it filed; opens the rule. */
export function RoutingOrderRuleRow({
  line,
  board,
  onOpen,
}: {
  line: RuleLine;
  board: InstalledBoardInfo | undefined;
  onOpen: (routeId: string) => void;
}) {
  const { rule } = line;
  const phaseKey = rule.target.phaseKey ?? board?.initialPhase;

  return (
    <SharedOrderRuleRow
      label={line.label}
      icon={<LaneIcon event={line.event} />}
      rank={line.of > 1 && <RuleRank line={line} />}
      skipped={!rule.enabled || line.hiddenBy !== undefined || line.movesCardsOnly}
      stage={board && phaseKey ? { key: phaseKey, kind: boardPhaseIconKind(board, phaseKey) } : undefined}
      phase={board ? (phaseName(board, rule.target.phaseKey) ?? phaseKey) : rule.target.phaseKey}
      filed={line.filed}
      notes={ruleNotes(line)}
      onOpen={() => onOpen(rule.id)}
    />
  );
}
