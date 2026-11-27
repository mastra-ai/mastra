import { BoardStageIcon, phaseIconKind } from '../../board/board-icons';
import { CellRow, FLOW_CELL, StaticPill } from '../flow-parts';
import type { RuleTargetBoard } from './types';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from '@/ds/components/Select';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import { IconCircleDashed } from '@/ds/icons/central/IconCircleDashed';
import { cn } from '@/utils/cn';

const BOARD = 'board:';

function PhasePill({ board, phaseKey }: { board: RuleTargetBoard | undefined; phaseKey: string | undefined }) {
  const phase = board?.phases.find(candidate => candidate.id === phaseKey);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {board && phase ? (
        <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />
      ) : (
        <IconCircleDashed className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={cn('truncate', !phase && 'text-muted-foreground')}>
        {board && phase ? phase.name : 'Pick a phase'}
      </span>
    </span>
  );
}

function BoardPill({ board, own }: { board: RuleTargetBoard | undefined; own: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {!own && <IconArrowUpRight className="size-icon-xs shrink-0" aria-hidden />}
      <span className="truncate">{board ? board.name : 'Pick a board'}</span>
    </span>
  );
}

/**
 * Where the rule sends what it takes, as the flow's last cell. A rule that files new items only has this board's open
 * phases; a card-move rule also lists the other boards under the phases, and once it names one, picks that board's
 * phase on a second line.
 */
export function MoveTo({
  board,
  boards,
  boardKey,
  phaseKey,
  targetPhaseKeys,
  placesNew,
  disabled,
  onChange,
}: {
  /** The rule's own board. */
  board: RuleTargetBoard;
  boards: readonly RuleTargetBoard[];
  boardKey: string;
  phaseKey: string | undefined;
  /** The target board's phases the rule may send to. */
  targetPhaseKeys: readonly string[];
  placesNew: boolean;
  disabled: boolean;
  onChange: (target: { boardKey: string; phaseKey: string | undefined }) => void;
}) {
  const targetBoard = boards.find(candidate => candidate.id === boardKey);
  const elsewhere = boardKey !== board.id;
  const others = placesNew ? [] : boards.filter(candidate => candidate.id !== board.id);
  // Another board's phases differ: its first phase until one is picked.
  const pickBoard = (key: string) => key !== boardKey && onChange({ boardKey: key, phaseKey: undefined });

  const phaseSelect = (
    <Select
      value={phaseKey ?? null}
      disabled={!targetBoard}
      // The select repeats its value, or clears it, as its items change under it: only a different pick is a change.
      onValueChange={value => {
        if (!value || value === phaseKey) return;
        if (value.startsWith(BOARD)) pickBoard(value.slice(BOARD.length));
        else onChange({ boardKey, phaseKey: value });
      }}
    >
      <SelectTrigger size="sm" aria-label="Phase" className="max-w-full min-w-0">
        <PhasePill board={targetBoard} phaseKey={phaseKey} />
      </SelectTrigger>
      <SelectContent align="end">
        {targetBoard &&
          targetPhaseKeys.map(key => (
            <SelectItem key={key} value={key}>
              <PhasePill board={targetBoard} phaseKey={key} />
            </SelectItem>
          ))}
        {!elsewhere && others.length > 0 && <SelectSeparator />}
        {!elsewhere &&
          others.map(candidate => (
            <SelectItem key={candidate.id} value={`${BOARD}${candidate.id}`}>
              <BoardPill board={candidate} own={false} />
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  if (disabled) {
    return (
      <div className={FLOW_CELL}>
        {elsewhere && (
          <CellRow label="Move to">
            <StaticPill>
              <BoardPill board={targetBoard} own={false} />
            </StaticPill>
          </CellRow>
        )}
        <CellRow label={elsewhere ? 'Phase' : 'Move to'}>
          <StaticPill>
            <PhasePill board={targetBoard} phaseKey={phaseKey} />
          </StaticPill>
        </CellRow>
      </div>
    );
  }

  return (
    <div className={FLOW_CELL}>
      {elsewhere && (
        <CellRow label="Move to">
          <Select value={boardKey} onValueChange={value => value && pickBoard(value)}>
            <SelectTrigger size="sm" aria-label="Board" className="max-w-full min-w-0">
              <BoardPill board={targetBoard} own={false} />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={board.id}>{board.name} (this board)</SelectItem>
              {others.map(candidate => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  <BoardPill board={candidate} own={false} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CellRow>
      )}
      <CellRow label={elsewhere ? 'Phase' : 'Move to'}>{phaseSelect}</CellRow>
    </div>
  );
}
