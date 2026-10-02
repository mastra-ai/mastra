import { DataList } from '@mastra/playground-ui/components/DataList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import type { DragPayload } from '../boardDrag';
import type { BoardStageId } from '../stages';
import { BoardDropLine, useBoardDropZone } from './BoardDropZone';
import { BoardStageIcon, stageTintClass } from './BoardIcons';
import { BOARD_LIST_COLUMNS } from './BoardListRow';

const LIST_ROW_GAP_PX = 1;

/** Every stage shares one grid, so a column lines up from the first stage to the last. */
export function BoardList({ children }: { children: ReactNode }) {
  return (
    <DataList columns={BOARD_LIST_COLUMNS} variant="light" fit="container" aria-label="Board stages" className="p-0">
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
  phaseKind?: 'resting' | 'working' | 'terminal';
  count: number;
  loading: boolean;
  action?: ReactNode;
  extras?: ReactNode;
  onDrop: (payload: DragPayload, toStage: BoardStageId) => void;
  children: ReactNode;
}) {
  const dropZone = useBoardDropZone<HTMLElement>({ stage, gapPx: LIST_ROW_GAP_PX, onDrop });

  return (
    <section
      ref={dropZone.cardListRef}
      aria-label={label}
      data-testid={`board-column-${stage}`}
      className="relative col-span-full grid grid-cols-subgrid content-start gap-y-px pb-4 [&>:not(.data-list-row)]:col-span-full"
      {...dropZone.dropZoneProps}
    >
      <DataList.Subheader
        className={cn(
          'mb-1 flex min-h-9 items-center gap-2 rounded-lg py-1 pr-1 pl-3 transition-colors motion-reduce:transition-none',
          dropZone.dragOver ? 'bg-fill-hover' : stageTintClass(stage, phaseKind),
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
      </DataList.Subheader>
      {children}
      {count > 0 && <BoardDropLine top={dropZone.dropLineTop} visible={dropZone.dragOver} />}
    </section>
  );
}
