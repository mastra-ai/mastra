import type { BoardPhaseKind } from '@mastra/factory/boards';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
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
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: ReactNode;
}) {
  const dropZone = useBoardDropZone({ stage, onDrop });

  return (
    <section
      aria-label={label}
      data-testid={`board-column-${stage}`}
      className="col-span-full grid grid-cols-subgrid content-start gap-y-px pb-4 [&>:not(.data-list-row)]:col-span-full"
      {...dropZone.dropZoneProps}
    >
      <div
        className={cn(
          'col-span-full mb-1 flex min-h-9 items-center gap-2 rounded-lg py-1 pr-1 pl-3 transition-colors motion-reduce:transition-none',
          dropZone.isDragOver ? 'bg-fill-hover' : stageTintClass(stage, phaseKind),
        )}
      >
        <BoardStageIcon stage={stage} kind={phaseKind} decorative />
        <Txt as="h2" variant="label" tone="ink" className="m-0 truncate font-semibold">
          {label}
        </Txt>
        {loading ? (
          <Skeleton className="h-4 w-5 rounded-sm" />
        ) : (
          <Txt as="span" variant="meta" tone="muted" className="tabular-nums">
            {count}
          </Txt>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {extras}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}
