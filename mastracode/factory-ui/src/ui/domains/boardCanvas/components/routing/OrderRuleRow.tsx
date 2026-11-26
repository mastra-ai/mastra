import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { InstalledBoardInfo } from '../../../../../api/types';
import { phaseName } from '../../../boardRules/ruleTargets';
import { boardPhaseIconKind, BoardStageIcon } from '../../../factory/components/BoardIcons';
import { ruleNotes } from '../../canvasModel';
import type { RuleLine } from '../../canvasModel';
import { RuleRank } from '../RuleChip';
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
  const skipped = !rule.enabled || line.hiddenBy !== undefined || line.movesCardsOnly;
  const phaseKey = rule.target.phaseKey ?? board?.initialPhase;
  const notes = ruleNotes(line);

  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(rule.id)}
        className={cn(
          'hover:bg-fill-hover -mx-1 flex h-5.5 items-center gap-1.5 rounded-md px-1 text-left',
          focusRing,
          skipped && 'opacity-50',
        )}
      >
        <LaneIcon event={line.event} />
        {line.of > 1 && <RuleRank line={line} />}
        <Txt as="span" variant="caption" tone="ink" className="min-w-0 flex-1 truncate">
          {line.label}
        </Txt>
        <span className="flex min-w-0 shrink-0 items-center gap-1.25">
          {board && phaseKey && (
            <BoardStageIcon stage={phaseKey} kind={boardPhaseIconKind(board, phaseKey)} decorative />
          )}
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {board ? (phaseName(board, rule.target.phaseKey) ?? phaseKey) : rule.target.phaseKey}
          </Txt>
        </span>
        <Txt as="span" variant="caption" tone="muted" className="w-7.5 shrink-0 text-right tabular-nums">
          {line.filed}
        </Txt>
      </button>
      {notes.map(note => (
        <Txt key={note.text} as="span" variant="caption" tone="muted" className="flex items-center gap-1.5 pl-4.5">
          {note.tone === 'warning' && (
            <IconExclamationTriangle className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />
          )}
          {note.text}
        </Txt>
      ))}
    </li>
  );
}
