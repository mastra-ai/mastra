import { Button } from '@mastra/playground-ui/components/Button';
import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical, Maximize2 } from 'lucide-react';
import type { MouseEvent, ReactNode, RefCallback } from 'react';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { setDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import { REVEAL_ON_CARD_HOVER } from './BoardCardParts';

const stopRowClick = (event: MouseEvent) => event.stopPropagation();

type BoardListRowCells = {
  icon?: ReactNode;
  key?: ReactNode;
  title?: ReactNode;
  labels?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  activity?: ReactNode;
};

export function BoardListRow({
  testId,
  title,
  cardRef,
  detailsRef,
  expanded,
  onOpen,
  dragPayload,
  busy = false,
  locked = false,
  highlighted = false,
  menu,
  createdAt,
  cells,
}: {
  testId: 'work-item-card' | 'candidate-card';
  title: string;
  cardRef: RefCallback<HTMLElement>;
  detailsRef?: (element: HTMLElement | null) => void;
  expanded: boolean;
  onOpen: () => void;
  dragPayload?: DragPayload;
  busy?: boolean;
  locked?: boolean;
  highlighted?: boolean;
  menu: ReactNode;
  createdAt?: string;
  cells: BoardListRowCells;
}) {
  const rowCells = (
    <>
      <DataList.Cell className="empty:before:content-none max-sm:col-start-1 max-sm:row-start-1">
        {cells.icon}
      </DataList.Cell>
      <DataList.Cell className="text-placeholder tabular-nums empty:before:content-none max-sm:hidden">
        {cells.key}
      </DataList.Cell>
      <DataList.Cell className="text-foreground empty:before:content-none max-sm:col-start-2 max-sm:row-start-1">
        <span className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1 truncate">{cells.title}</span>
          <span className="max-w-[min(18rem,45%)] min-w-0 shrink-0 empty:hidden max-sm:hidden [&>*]:max-w-full">
            {cells.labels}
          </span>
        </span>
      </DataList.Cell>
      <DataList.Cell className="justify-items-end empty:before:content-none max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-3 max-sm:justify-items-start max-sm:empty:hidden">
        {cells.status}
      </DataList.Cell>
      <DataList.Cell
        onClick={stopRowClick}
        className="justify-items-end overflow-visible empty:before:content-none max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2 max-sm:justify-items-start max-sm:empty:hidden"
      >
        {cells.action}
      </DataList.Cell>
      <DataList.Cell
        onClick={stopRowClick}
        className="justify-items-end overflow-visible empty:before:content-none max-sm:col-start-1 max-sm:row-start-2 max-sm:empty:hidden"
      >
        {cells.activity}
      </DataList.Cell>
      <DataList.Cell
        onClick={stopRowClick}
        className="justify-items-end overflow-visible empty:before:content-none max-sm:col-start-3 max-sm:row-start-1"
      >
        {createdAt && (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            className="pointer-events-none col-start-1 row-start-1 tabular-nums transition-opacity duration-200 motion-reduce:transition-none max-sm:hidden pointer-coarse:hidden pointer-fine:group-focus-within:opacity-0 pointer-fine:group-hover:opacity-0"
          >
            <time dateTime={createdAt}>{relativeTime(createdAt)}</time>
          </Txt>
        )}
        <span className="col-start-1 row-start-1 flex items-center max-sm:[&_button]:opacity-100">
          <Button
            ref={detailsRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            draggable={false}
            aria-label={`Details for ${title}`}
            aria-expanded={expanded}
            onClick={onOpen}
            className={REVEAL_ON_CARD_HOVER}
          >
            <Maximize2 size={13} aria-hidden />
          </Button>
          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  draggable={false}
                  disabled={locked}
                  aria-label={`Actions for ${title}`}
                  className={REVEAL_ON_CARD_HOVER}
                >
                  <EllipsisVertical size={13} aria-hidden />
                </Button>
              }
            />
            <DropdownMenu.Content align="end" className="min-w-44">
              {menu}
            </DropdownMenu.Content>
          </DropdownMenu>
        </span>
      </DataList.Cell>
    </>
  );

  const row = (
    <DataList.RowWrapper
      ref={cardRef}
      data-testid={testId}
      data-featured={expanded || undefined}
      aria-busy={busy || locked || undefined}
      tabIndex={-1}
      draggable={dragPayload !== undefined}
      onDragStart={event => {
        if (dragPayload) setDragPayload(event, dragPayload);
      }}
      onSelectRow={onOpen}
      className={cn(
        'group min-h-10 items-center gap-x-3 px-3 py-1 max-sm:gap-y-1 max-sm:py-2',
        locked && 'cursor-wait opacity-70',
        highlighted && 'before:bg-warning-subtle',
      )}
    >
      {rowCells}
    </DataList.RowWrapper>
  );

  return (
    <ContextMenu>
      <ContextMenu.Trigger render={row} />
      {!locked && <ContextMenu.Content className="min-w-44">{menu}</ContextMenu.Content>}
    </ContextMenu>
  );
}
