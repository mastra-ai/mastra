import type { ReactNode } from 'react';
import type { DragPayload } from './board-drag';
import { BoardStageIcon, stageHeaderTintClass } from './board-icons';
import type { BoardPhaseKind, BoardStageId } from './board-icons';
import { BOARD_LIST_GROUP_HEADER_LAYOUT_CLASS } from './board-layout';
import { useBoardDropZone } from './use-board-drop-zone';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { DataList } from '@/ds/components/DataList';

import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/utils/cn';

export const SPANS_LIST_GRID = 'col-span-full grid grid-cols-subgrid';

/** Each row lays out its own columns, so one wide action or badge never narrows every other title. */
export function BoardList({ children }: { children: ReactNode }) {
  return (
    <DataList
      columns="minmax(0,1fr)"
      variant="light"
      fit="container"
      scrollable={false}
      aria-label="Board stages"
      className="p-0"
    >
      {children}
    </DataList>
  );
}

export function BoardListGroup({
  stage,
  label,
  phaseKind,
  count,
  loading,
  action,
  extras,
  open,
  onOpenChange,
  onDrop,
  children,
}: {
  stage: BoardStageId;
  label: string;
  phaseKind?: BoardPhaseKind;
  count: number;
  loading: boolean;
  action?: ReactNode;
  extras?: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: ReactNode;
}) {
  const dropZone = useBoardDropZone({ stage, onDrop });

  return (
    <Collapsible
      render={<DataList.Group />}
      open={open}
      onOpenChange={onOpenChange}
      aria-label={label}
      data-testid={`board-column-${stage}`}
      className="content-start pb-4"
      {...dropZone.dropZoneProps}
    >
      <div
        className={cn(
          'col-span-full transition-colors motion-reduce:transition-none',
          BOARD_LIST_GROUP_HEADER_LAYOUT_CLASS,
          dropZone.isDragOver ? 'bg-fill-hover' : stageHeaderTintClass(stage, phaseKind),
        )}
      >
        <h2 className="m-0 min-w-0 flex-1">
          <CollapsibleTrigger
            aria-label={loading ? label : `${label}, ${count}`}
            className="flex w-full items-center gap-2 text-left"
          >
            <DisclosureChevron direction="right" className="size-3.5" />
            <BoardStageIcon stage={stage} kind={phaseKind} decorative />
            <Txt as="span" variant="label" tone="ink" className="truncate font-semibold">
              {label}
            </Txt>
            {loading ? (
              <Skeleton className="h-4 w-5 rounded-sm" />
            ) : (
              <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
                {count}
              </Txt>
            )}
          </CollapsibleTrigger>
        </h2>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {extras}
          {action}
        </div>
      </div>
      <CollapsibleContent
        keepMounted
        // Clip during the collapse animation, then let the first/last row's activity halo extend beyond the panel.
        render={<div className={cn(SPANS_LIST_GRID, 'data-open:not-data-starting-style:overflow-visible')} />}
        className={cn(SPANS_LIST_GRID, 'gap-y-px [&>:not(.data-list-row)]:col-span-full')}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
