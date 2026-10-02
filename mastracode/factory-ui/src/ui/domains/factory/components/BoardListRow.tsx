import { Button } from '@mastra/playground-ui/components/Button';
import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical, Maximize2 } from 'lucide-react';
import type { MouseEvent, ReactNode, RefObject } from 'react';

import { relativeTime } from '../../../../lib/date/relativeTime';
import { setDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import { REVEAL_ON_CARD_HOVER } from './BoardCardParts';

export const BOARD_LIST_COLUMNS = 'auto auto minmax(12rem, 1fr) auto auto auto auto';

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
  moving = false,
  highlighted = false,
  menu,
  createdAt,
  cells,
}: {
  testId: 'work-item-card' | 'candidate-card';
  title: string;
  cardRef: RefObject<HTMLElement | null>;
  /** Receives the details button: the board scrolls to it and focuses it when the card is deeplinked. */
  detailsRef?: (element: HTMLElement | null) => void;
  expanded: boolean;
  onOpen: () => void;
  /** Absent while the card is mid-move: it cannot be picked up again. */
  dragPayload?: DragPayload;
  busy?: boolean;
  moving?: boolean;
  highlighted?: boolean;
  menu: ReactNode;
  createdAt?: string;
  cells: BoardListRowCells;
}) {
  return (
    <ContextMenu>
      <ContextMenu.Trigger
        render={
          <DataList.RowWrapper
            ref={element => {
              cardRef.current = element;
            }}
            data-testid={testId}
            data-featured={expanded || undefined}
            data-deep-linked={highlighted || undefined}
            tabIndex={-1}
            draggable={dragPayload !== undefined}
            onDragStart={event => {
              if (dragPayload) setDragPayload(event, dragPayload);
            }}
            onSelectRow={onOpen}
            className={cn(
              'group min-h-10 items-center gap-x-3 px-3 py-1',
              moving && 'cursor-wait',
              busy && 'opacity-70',
              highlighted && 'before:bg-warning-subtle',
            )}
          />
        }
      >
        <DataList.Cell className="empty:before:content-none">{cells.icon}</DataList.Cell>
        <DataList.Cell className="text-placeholder tabular-nums empty:before:content-none">{cells.key}</DataList.Cell>
        <DataList.Cell className="text-foreground empty:before:content-none">
          <span className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 flex-1 truncate">{cells.title}</span>
            {cells.labels && (
              <span className="max-w-[min(18rem,45%)] min-w-0 shrink-0 [&>*]:max-w-full">{cells.labels}</span>
            )}
          </span>
        </DataList.Cell>
        {/* Right-packed, so one wide status or action leaves slack after the title, not mid-row. */}
        <DataList.Cell className="justify-items-end empty:before:content-none">{cells.status}</DataList.Cell>
        <DataList.Cell onClick={stopRowClick} className="justify-items-end overflow-visible empty:before:content-none">
          {cells.action}
        </DataList.Cell>
        <DataList.Cell onClick={stopRowClick} className="justify-items-end overflow-visible empty:before:content-none">
          {cells.activity}
        </DataList.Cell>
        <DataList.Cell onClick={stopRowClick} className="justify-items-end overflow-visible empty:before:content-none">
          {createdAt && (
            <Txt
              as="span"
              variant="meta"
              tone="muted"
              className="pointer-events-none col-start-1 row-start-1 tabular-nums transition-opacity duration-200 motion-reduce:transition-none pointer-coarse:hidden pointer-fine:group-focus-within:opacity-0 pointer-fine:group-hover:opacity-0"
            >
              <time dateTime={createdAt}>{relativeTime(createdAt)}</time>
            </Txt>
          )}
          <span className="col-start-1 row-start-1 flex items-center">
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
                    disabled={moving}
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
      </ContextMenu.Trigger>
      {!moving && <ContextMenu.Content className="min-w-44">{menu}</ContextMenu.Content>}
    </ContextMenu>
  );
}
