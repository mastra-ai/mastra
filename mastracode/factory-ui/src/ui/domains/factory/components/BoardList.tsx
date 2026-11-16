import type { BoardPhaseKind } from '@mastra/factory/boards';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { DragPayload } from '../boardDrag';
import { useBoardDropZone } from '../hooks/useBoardDropZone';
import type { BoardStageId } from '../stages';
import { BoardStageIcon, stageHeaderTintClass } from './BoardIcons';

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
          'col-span-full mb-1 flex min-h-9 items-center gap-2 rounded-lg py-1 pr-1 pl-3 transition-colors motion-reduce:transition-none',
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
