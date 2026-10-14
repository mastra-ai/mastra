import type { BoardPhaseKind } from '@mastra/factory/boards';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { DragPayload } from '../boardDrag';
import { useBoardDropZone } from '../hooks/useBoardDropZone';
import type { BoardStageId } from '../stages';
import { BoardStageIcon, stageTintClass } from './BoardIcons';

/** Every stage shares one grid, so a column lines up from the first stage to the last. */
export function BoardList({ children }: { children: ReactNode }) {
  return (
    <DataList
      columns="var(--board-list-columns)"
      variant="light"
      fit="container"
      aria-label="Board stages"
      className="p-0 [--board-list-columns:auto_auto_minmax(12rem,1fr)_auto_auto_auto_auto] max-sm:[--board-list-columns:auto_minmax(0,1fr)_auto]"
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
  revealKey = '',
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
  /** A newly opened composer or linked item reveals its group without discarding other groups' state. */
  revealKey?: string;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: ReactNode;
}) {
  const dropZone = useBoardDropZone({ stage, onDrop });
  const [collapsedKey, setCollapsedKey] = useState<string>();
  const open = collapsedKey !== revealKey;

  return (
    <Collapsible
      render={<DataList.Group />}
      open={open}
      onOpenChange={nextOpen => setCollapsedKey(nextOpen ? undefined : revealKey)}
      aria-label={label}
      data-testid={`board-column-${stage}`}
      className="content-start pb-4"
      {...dropZone.dropZoneProps}
    >
      <div
        className={cn(
          'col-span-full mb-1 flex min-h-9 items-center gap-2 rounded-lg py-1 pr-1 pl-3 transition-colors motion-reduce:transition-none',
          dropZone.isDragOver ? 'bg-fill-hover' : stageTintClass(stage, phaseKind),
        )}
      >
        <h2 className="m-0 min-w-0 flex-1">
          <CollapsibleTrigger
            aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
            className="flex w-full items-center gap-2 text-left"
          >
            <DisclosureChevron direction="right" className="size-3.5" />
            <BoardStageIcon stage={stage} kind={phaseKind} decorative />
            <Txt as="span" variant="label" tone="ink" className="truncate">
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
        render={<div className="col-span-full grid grid-cols-subgrid" />}
        className="col-span-full grid grid-cols-subgrid gap-y-px [&>:not(.data-list-row)]:col-span-full"
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
