import type { ReactNode } from 'react';
import { BoardStageIcon } from '../../board/board-icons';
import type { BoardPhaseKind } from '../../board/board-icons';
import { Txt } from '@/ds/components/Txt';
import { IconExclamationTriangle } from '@/ds/icons/central/IconExclamationTriangle';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/utils/cn';

/** One rule in an order card: its trigger, name, the phase it files into and what it filed; opens the rule. */
export function OrderRuleRow({
  label,
  icon,
  rank,
  skipped,
  stage,
  phase,
  filed,
  notes,
  onOpen,
}: {
  label: string;
  /** The icon of the trigger it listens on. */
  icon: ReactNode;
  /** Its place among the rules on its trigger, when it shares the trigger. */
  rank?: ReactNode;
  /** Off, never reached, or filing no new items: the row dims. */
  skipped: boolean;
  /** The phase it files into, for its icon; unset when the board isn't known. */
  stage?: { key: string; kind: BoardPhaseKind | undefined };
  /** The name of the phase it files into. */
  phase: string | null | undefined;
  /** Items it filed in the last 30 days. */
  filed: number | undefined;
  /** What is worth knowing about it; warnings get a mark. */
  notes: readonly { tone: 'warning' | 'muted'; text: string }[];
  onOpen: () => void;
}) {
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          '-mx-1 flex h-5.5 items-center gap-1.5 rounded-md px-1 text-left hover:bg-fill-hover',
          focusRing,
          skipped && 'opacity-50',
        )}
      >
        {icon}
        {rank}
        <Txt as="span" variant="caption" tone="ink" className="min-w-0 flex-1 truncate">
          {label}
        </Txt>
        <span className="flex min-w-0 shrink-0 items-center gap-1.25">
          {stage && <BoardStageIcon stage={stage.key} kind={stage.kind} decorative />}
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {phase}
          </Txt>
        </span>
        <Txt as="span" variant="caption" tone="muted" className="w-7.5 shrink-0 text-right tabular-nums">
          {filed}
        </Txt>
      </button>
      {notes.map(note => (
        <Txt key={note.text} as="span" variant="caption" tone="muted" className="flex items-center gap-1.5 pl-4.5">
          {note.tone === 'warning' && (
            <IconExclamationTriangle className="size-icon-xs shrink-0 text-warning-indicator" aria-hidden />
          )}
          {note.text}
        </Txt>
      ))}
    </li>
  );
}
