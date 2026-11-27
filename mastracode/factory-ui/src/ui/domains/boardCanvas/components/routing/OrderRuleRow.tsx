import { RuleRank, OrderRuleRow as SharedOrderRuleRow } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo } from '../../../../../api/types';
import { phaseName } from '../../../boardRules/ruleTargets';
import { boardPhaseIconKind } from '../../../factory/components/BoardIcons';
import { ruleNotes } from '../../canvasModel';
import type { RuleLine } from '../../canvasModel';
import { LaneIcon } from './laneIcon';

/** One rule in an order card: its trigger, name, the phase it files into and what it filed; opens the rule. */
export function OrderRuleRow({
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
