import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useRef, useState } from 'react';

import { CARD_MIME, readDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import type { BoardStageId } from '../stages';
import { BoardStageIcon } from './BoardIcons';

function ColumnTaskBadge({ count, total, label }: { count: number; total: number; label: string }) {
  const circumference = 2 * Math.PI * 5;
  const ratio = total === 0 ? 0 : Math.min(count / total, 1);
  const dashOffset = circumference * (1 - ratio);

  return (
    <span
      aria-label={`${count} of ${total} visible board tasks in ${label}`}
      title={`${count} of ${total} visible board tasks`}
      className="border-border1 bg-surface2 text-ui-xs text-icon4 flex h-6 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 font-medium tabular-nums"
    >
      <svg viewBox="0 0 14 14" className="size-3.5 -rotate-90" aria-hidden>
        <circle cx="7" cy="7" r="5" fill="none" strokeWidth="2" className="stroke-border1" />
        <circle
          cx="7"
          cy="7"
          r="5"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="stroke-icon5 transition-[stroke-dashoffset] motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden>{count}</span>
    </span>
  );
}

const BOARD_CARD_SELECTOR = '[data-testid="work-item-card"], [data-testid="candidate-card"]';
const BOARD_CARD_GAP_PX = 10;

function dropLinePosition(cardList: HTMLDivElement, pointerY: number): number {
  const cards = cardList.querySelectorAll<HTMLElement>(BOARD_CARD_SELECTOR);
  if (cards.length === 0) return 0;

  for (let index = 0; index < cards.length; index += 1) {
    const card = cards.item(index);
    if (!card) continue;
    const bounds = card.getBoundingClientRect();
    if (pointerY < bounds.top + bounds.height / 2) {
      return Math.max(0, card.offsetTop - (index === 0 ? 0 : BOARD_CARD_GAP_PX / 2));
    }
  }

  const lastCard = cards.item(cards.length - 1);
  return lastCard ? lastCard.offsetTop + lastCard.offsetHeight + BOARD_CARD_GAP_PX / 2 : 0;
}

const COLUMN_ACTION_REVEAL_CLASS =
  'pointer-events-none opacity-0 transition-opacity group-hover/column:pointer-events-auto group-hover/column:opacity-100 group-focus-within/column:pointer-events-auto group-focus-within/column:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 any-pointer-coarse:pointer-events-auto any-pointer-coarse:opacity-100 motion-reduce:transition-none';

export function BoardColumn({
  stage,
  label,
  taskCount,
  totalTaskCount,
  loading = false,
  composerOpen = false,
  laneRef,
  onDrop,
  headerAction,
  headerExtras,
  children,
}: {
  stage: BoardStageId;
  label: string;
  taskCount: number;
  totalTaskCount: number;
  /** While loading, the task badge is hidden so a false "0/0" never flashes. */
  loading?: boolean;
  composerOpen?: boolean;
  laneRef: (element: HTMLElement | null) => void;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  headerAction?: React.ReactNode;
  /** Pinned below the column title, outside the scrolling card list. */
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dropLineTop, setDropLineTop] = useState(0);
  const cardListRef = useRef<HTMLDivElement>(null);
  const collapsed = stage !== 'intake' && !loading && !composerOpen && taskCount === 0;

  return (
    <section
      ref={laneRef}
      aria-label={collapsed ? `${label}, empty` : label}
      data-testid={`board-column-${stage}`}
      className={cn(
        'group/column flex min-h-0 min-w-0 w-[80cqw] shrink-0 flex-col gap-4 transition-[width,background-color] motion-reduce:transition-none',
        collapsed ? 'rounded-lg lg:w-14 lg:gap-0' : 'lg:w-80',
        collapsed && dragOver && 'bg-surface2 ring-1 ring-border1',
      )}
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(CARD_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
        const cardList = cardListRef.current;
        if (cardList) setDropLineTop(dropLinePosition(cardList, event.clientY));
      }}
      onDragLeave={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setDragOver(false);
      }}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        const payload = readDragPayload(event);
        if (payload) onDrop(payload, stage);
      }}
    >
      {collapsed ? (
        <CollapsedColumnBody label={label} taskCount={taskCount} headerAction={headerAction} />
      ) : (
        <ColumnBody
          stage={stage}
          label={label}
          taskCount={taskCount}
          totalTaskCount={totalTaskCount}
          loading={loading}
          dragOver={dragOver}
          dropLineTop={dropLineTop}
          cardListRef={cardListRef}
          headerAction={headerAction}
          headerExtras={headerExtras}
        >
          {children}
        </ColumnBody>
      )}
    </section>
  );
}

function CollapsedColumnBody({
  label,
  taskCount,
  headerAction,
}: {
  label: string;
  taskCount: number;
  headerAction?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 py-1 lg:items-center">
      <div className="relative flex h-8 w-full items-center justify-end lg:justify-center">
        <span
          aria-hidden
          className={cn(
            'text-ui-xs text-icon3 flex h-8 items-center font-medium tabular-nums',
            headerAction &&
              'transition-opacity group-hover/column:opacity-0 group-focus-within/column:opacity-0 pointer-coarse:opacity-0 any-pointer-coarse:opacity-0 motion-reduce:transition-none',
          )}
        >
          {taskCount}
        </span>
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
      </div>
      <Txt
        as="h2"
        variant="ui-smd"
        className="text-icon3 m-0 font-semibold [writing-mode:horizontal-tb] lg:[writing-mode:vertical-rl]"
      >
        {label}
      </Txt>
    </div>
  );
}

function ColumnBody({
  stage,
  label,
  taskCount,
  totalTaskCount,
  loading,
  dragOver,
  dropLineTop,
  cardListRef,
  headerAction,
  headerExtras,
  children,
}: {
  stage: BoardStageId;
  label: string;
  taskCount: number;
  totalTaskCount: number;
  loading: boolean;
  dragOver: boolean;
  dropLineTop: number;
  cardListRef: React.RefObject<HTMLDivElement | null>;
  headerAction?: React.ReactNode;
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex min-h-8 items-start justify-between gap-2">
        <div className="flex h-8 min-w-0 items-center gap-2">
          <BoardStageIcon stage={stage} />
          <Txt as="h2" variant="ui-smd" className="text-icon3 m-0 truncate font-semibold">
            {label}
          </Txt>
          {loading ? (
            <Skeleton className="h-6 w-12 shrink-0 rounded-full" />
          ) : totalTaskCount > 0 ? (
            <ColumnTaskBadge count={taskCount} total={totalTaskCount} label={label} />
          ) : null}
        </div>
        {headerAction ? (
          <div className={cn('flex h-8 shrink-0 items-center', COLUMN_ACTION_REVEAL_CLASS)}>{headerAction}</div>
        ) : null}
      </div>
      {headerExtras}
      <div className="min-h-16 flex-1">
        <ScrollArea className="h-full">
          <div ref={cardListRef} className="relative flex flex-col gap-2.5 pb-2">
            {children}
            <div
              aria-hidden
              style={{ top: dropLineTop }}
              className={cn(
                'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-neutral1 transition-opacity motion-reduce:transition-none',
                dragOver ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
