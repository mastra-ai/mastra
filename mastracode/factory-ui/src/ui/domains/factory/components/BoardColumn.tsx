import type { BoardPhaseKind } from '@mastra/factory/boards';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { DragPayload } from '../boardDrag';
import { useBoardDropZone } from '../hooks/useBoardDropZone';
import type { BoardStageId } from '../stages';
import { BoardStageIcon } from './BoardIcons';

/** Header cells and card lanes share this so the two rows stay column-aligned. */
function columnWidthClass(collapsed: boolean): string {
  return cn('min-w-0 shrink-0 transition-[width] motion-reduce:transition-none', collapsed ? 'w-14' : 'w-80');
}

function ColumnTaskBadge({ count, total, label }: { count: number; total: number; label: string }) {
  const circumference = 2 * Math.PI * 5;
  const ratio = total === 0 ? 0 : Math.min(count / total, 1);
  const dashOffset = circumference * (1 - ratio);

  return (
    <Txt
      as="span"
      variant="meta"
      tone="muted"
      aria-label={`${count} of ${total} visible board tasks in ${label}`}
      title={`${count} of ${total} visible board tasks`}
      className="bg-fill flex h-6 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-2 tabular-nums"
    >
      <svg viewBox="0 0 14 14" className="size-3.5 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" strokeWidth="2" className="stroke-border" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-foreground transition-[stroke-dashoffset] motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden>{count}</span>
    </Txt>
  );
}

export function BoardColumnHeader({
  phaseKind,
  stage,
  label,
  taskCount,
  totalTaskCount,
  loading,
  collapsed,
  hovered,
  headerAction,
  headerExtras,
}: {
  stage: BoardStageId;
  label: string;
  taskCount: number;
  totalTaskCount: number;
  phaseKind?: BoardPhaseKind;
  /** While loading, the task badge is hidden so a false "0/0" never flashes. */
  loading: boolean;
  collapsed: boolean;
  /** The pointer is over this column, header or cards; reveals `headerAction`. */
  hovered: boolean;
  /** Opens the composer down a collapsed column, under its label. */
  headerAction?: React.ReactNode;
  headerExtras?: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <div
        data-board-stage={stage}
        data-hovered={hovered || undefined}
        data-collapsed
        className={cn(columnWidthClass(true), 'group/column relative flex min-h-8 items-center justify-center')}
      >
        <Txt as="span" variant="meta" tone="muted" aria-hidden className="flex h-8 items-center tabular-nums">
          {taskCount}
        </Txt>
        <div className="absolute top-full left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 py-1">
          <Txt
            tone="muted"
            as="h2"
            variant="label"
            className="pointer-events-none m-0 whitespace-nowrap [writing-mode:vertical-rl]"
          >
            {label}
          </Txt>
          {headerExtras}
          {headerAction}
        </div>
      </div>
    );
  }

  return (
    <div
      data-board-stage={stage}
      className={cn(columnWidthClass(false), 'flex min-h-8 items-start justify-between gap-2')}
    >
      <div className="flex h-8 min-w-0 items-center gap-2">
        <BoardStageIcon stage={stage} kind={phaseKind} />
        <Txt tone="muted" as="h2" variant="label" className="m-0 truncate">
          {label}
        </Txt>
        {loading && <Skeleton className="h-6 w-12 shrink-0 rounded-full" />}
        {!loading && totalTaskCount > 0 && <ColumnTaskBadge count={taskCount} total={totalTaskCount} label={label} />}
      </div>
      {headerExtras && <div className="flex h-8 shrink-0 items-center gap-1">{headerExtras}</div>}
    </div>
  );
}

export function BoardColumn({
  stage,
  label,
  collapsed,
  hovered,
  action,
  onDrop,
  children,
}: {
  stage: BoardStageId;
  label: string;
  collapsed: boolean;
  hovered: boolean;
  /** Opens the composer, above the cards so it scrolls with them; shown while `hovered`. */
  action?: React.ReactNode;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: React.ReactNode;
}) {
  const dropZone = useBoardDropZone({ stage, onDrop });

  return (
    <section
      aria-label={collapsed ? `${label}, empty` : label}
      data-testid={`board-column-${stage}`}
      data-board-stage={stage}
      data-hovered={hovered || undefined}
      className={cn(
        columnWidthClass(collapsed),
        'group/column',
        'flex flex-col rounded-lg transition-[width,background-color] motion-reduce:transition-none',
        dropZone.isDragOver && 'bg-background ring-1 ring-border',
      )}
      {...dropZone.dropZoneProps}
    >
      {!collapsed && <div className="mb-1 h-4 shrink-0">{action}</div>}
      <div className="flex min-h-16 flex-1 flex-col gap-2.5 pb-2">{collapsed ? null : children}</div>
    </section>
  );
}
