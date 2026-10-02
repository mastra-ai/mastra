import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { DragPayload } from '../boardDrag';
import type { BoardStageId } from '../stages';
import { BoardDropLine, useBoardDropZone } from './BoardDropZone';
import { BoardStageIcon } from './BoardIcons';

/** Header cells and card lanes share this so the two rows stay column-aligned. */
function columnWidthClass(collapsed: boolean): string {
  return cn('w-80 min-w-0 shrink-0 transition-[width] motion-reduce:transition-none', collapsed && 'lg:w-14');
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

const BOARD_CARD_GAP_PX = 10;

const COLUMN_ACTION_REVEAL_CLASS =
  'pointer-events-none opacity-0 transition-opacity group-hover/column:pointer-events-auto group-hover/column:opacity-100 group-focus-within/column:pointer-events-auto group-focus-within/column:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 any-pointer-coarse:pointer-events-auto any-pointer-coarse:opacity-100 motion-reduce:transition-none';

export function BoardColumnHeader({
  phaseKind,
  stage,
  label,
  taskCount,
  totalTaskCount,
  loading,
  collapsed,
  headerAction,
  headerExtras,
}: {
  stage: BoardStageId;
  label: string;
  taskCount: number;
  totalTaskCount: number;
  phaseKind?: 'resting' | 'working' | 'terminal';
  /** While loading, the task badge is hidden so a false "0/0" never flashes. */
  loading: boolean;
  collapsed: boolean;
  headerAction?: React.ReactNode;
  headerExtras?: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <div
        className={cn(
          columnWidthClass(true),
          'group/column relative flex min-h-8 items-center justify-end lg:justify-center',
        )}
      >
        <Txt
          as="span"
          variant="meta"
          tone="muted"
          aria-hidden
          className={cn(
            'flex h-8 items-center tabular-nums',
            headerAction &&
              'transition-opacity group-hover/column:opacity-0 group-focus-within/column:opacity-0 pointer-coarse:opacity-0 any-pointer-coarse:opacity-0 motion-reduce:transition-none',
          )}
        >
          {taskCount}
        </Txt>
        {headerAction ? (
          <div
            className={cn(
              'absolute inset-y-0 right-0 flex items-center justify-center lg:inset-x-0',
              COLUMN_ACTION_REVEAL_CLASS,
            )}
          >
            {headerAction}
          </div>
        ) : null}
        <Txt
          as="h2"
          variant="label"
          className="text-muted-foreground pointer-events-none absolute top-full right-0 m-0 py-1 font-semibold [writing-mode:horizontal-tb] lg:right-auto lg:left-1/2 lg:-translate-x-1/2 lg:[writing-mode:vertical-rl]"
        >
          {label}
        </Txt>
      </div>
    );
  }

  return (
    <div className={cn(columnWidthClass(false), 'group/column flex min-h-8 items-start justify-between gap-2')}>
      <div className="flex h-8 min-w-0 items-center gap-2">
        <BoardStageIcon stage={stage} kind={phaseKind} />
        <Txt as="h2" variant="label" className="text-muted-foreground m-0 truncate font-semibold">
          {label}
        </Txt>
        {loading ? (
          <Skeleton className="h-6 w-12 shrink-0 rounded-full" />
        ) : totalTaskCount > 0 ? (
          <ColumnTaskBadge count={taskCount} total={totalTaskCount} label={label} />
        ) : null}
      </div>
      {headerExtras || headerAction ? (
        <div className="flex h-8 shrink-0 items-center gap-1">
          {headerExtras}
          {headerAction ? (
            <div className={cn('flex items-center', COLUMN_ACTION_REVEAL_CLASS)}>{headerAction}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function BoardColumn({
  stage,
  label,
  collapsed,
  onDrop,
  children,
}: {
  stage: BoardStageId;
  label: string;
  collapsed: boolean;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: React.ReactNode;
}) {
  const dropZone = useBoardDropZone<HTMLDivElement>({ stage, gapPx: BOARD_CARD_GAP_PX, onDrop });

  return (
    <section
      aria-label={collapsed ? `${label}, empty` : label}
      data-testid={`board-column-${stage}`}
      className={cn(
        columnWidthClass(collapsed),
        'flex flex-col transition-[width,background-color] motion-reduce:transition-none',
        collapsed && 'rounded-lg',
        collapsed && dropZone.dragOver && 'bg-background ring-1 ring-border',
      )}
      {...dropZone.dropZoneProps}
    >
      <div ref={dropZone.cardListRef} className="relative flex min-h-16 flex-1 flex-col gap-2.5 pb-2">
        {collapsed ? null : children}
        <BoardDropLine top={dropZone.dropLineTop} visible={dropZone.dragOver} />
      </div>
    </section>
  );
}
