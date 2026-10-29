import { ActivityWick } from '@mastra/playground-ui/components/Activity';
import type { ActivityStatus } from '@mastra/playground-ui/components/Activity';
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
import { BOARD_LIST_ROW_LAYOUT_CLASS } from '../boardLayout';

const stopRowClick = (event: MouseEvent) => event.stopPropagation();

// The row's details and actions buttons swap in for its timestamp on a mouse hover, keyboard focus anywhere in the
// row, an open menu, or the selected row; touch always shows them.
const REVEAL_ROW_CONTROLS =
  'transition-opacity duration-200 ease-out motion-reduce:transition-none pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover/data-list-row:pointer-events-auto pointer-fine:group-hover/data-list-row:opacity-100 pointer-fine:group-has-[:focus-visible]/data-list-row:pointer-events-auto pointer-fine:group-has-[:focus-visible]/data-list-row:opacity-100 pointer-fine:group-has-[[aria-expanded=true]]/row-end:pointer-events-auto pointer-fine:group-has-[[aria-expanded=true]]/row-end:opacity-100';
const HIDE_WHILE_ROW_CONTROLS_SHOW =
  'pointer-fine:group-hover/data-list-row:opacity-0 pointer-fine:group-has-[:focus-visible]/data-list-row:opacity-0 pointer-fine:group-has-[[aria-expanded=true]]/row-end:opacity-0';

// A list of hundreds of rows reads as a wall of buttons when each shows its action, so a mouse sees it on hover
// in place of the labels; it stays in the tab order (visually hidden, not removed) and always shows on touch.
const REVEAL_ACTION_ON_HOVER =
  'pointer-fine:sr-only pointer-fine:group-hover/data-list-row:not-sr-only pointer-fine:focus-within:not-sr-only pointer-fine:has-[[aria-expanded=true]]:not-sr-only';
const SWAP_FOR_ACTION_ON_HOVER =
  'pointer-fine:group-has-[.row-action:not(:empty)]/data-list-row:group-hover/data-list-row:hidden';

type BoardListRowCells = {
  icon?: ReactNode;
  key?: ReactNode;
  title?: ReactNode;
  links?: ReactNode;
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
  onToggleDetails,
  dragPayload,
  busy = false,
  locked = false,
  highlighted = false,
  activityStatus,
  menu,
  createdAt,
  cells,
}: {
  testId: 'work-item-card' | 'candidate-card';
  title: string;
  cardRef: RefCallback<HTMLElement>;
  detailsRef?: (element: HTMLElement | null) => void;
  expanded: boolean;
  onToggleDetails: () => void;
  dragPayload?: DragPayload;
  busy?: boolean;
  locked?: boolean;
  highlighted?: boolean;
  activityStatus?: ActivityStatus;
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
      <DataList.Cell className="text-foreground @container flex gap-3 overflow-visible empty:before:content-none max-sm:contents">
        <span className="flex min-w-0 shrink items-center gap-3 max-sm:col-start-2 max-sm:row-start-1">
          <span className="min-w-0 truncate">{cells.title}</span>
          <span
            onClick={stopRowClick}
            className="flex max-w-[min(14rem,30%)] min-w-0 shrink-[100] items-center gap-2 empty:hidden max-sm:hidden @max-[28rem]:hidden [&>*]:min-w-0"
          >
            {cells.links}
          </span>
        </span>
        <span aria-hidden className="flex-1 max-sm:hidden" />
        {/* Metadata sits flush right. Its group dissolves on wider screens so each part sets its own priority:
            labels give way first, then the title, and the status last, so a review verdict stays readable. */}
        <span className="flex min-w-0 items-center gap-3 empty:hidden max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-3 sm:contents">
          <span
            className={cn(
              'max-w-72 min-w-0 shrink-[100] overflow-hidden empty:hidden max-sm:hidden @max-[32rem]:hidden [&>*]:max-w-full',
              SWAP_FOR_ACTION_ON_HOVER,
            )}
          >
            {cells.labels}
          </span>
          {/* Only shrinks once the title has nothing left to give, then truncates instead of spilling over the next column. */}
          <span className="flex max-w-80 min-w-0 shrink-[0.01] items-center empty:hidden">{cells.status}</span>
        </span>
        <span
          onClick={stopRowClick}
          className={cn(
            'row-action flex shrink-0 items-center empty:hidden max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2',
            REVEAL_ACTION_ON_HOVER,
          )}
        >
          {cells.action}
        </span>
      </DataList.Cell>
      <DataList.Cell
        onClick={stopRowClick}
        className="justify-items-end overflow-visible empty:before:content-none max-sm:col-start-1 max-sm:row-start-2 max-sm:empty:hidden"
      >
        {cells.activity}
      </DataList.Cell>
      <DataList.Cell className="group/row-end justify-items-end overflow-visible empty:before:content-none max-sm:col-start-3 max-sm:row-start-1">
        {createdAt && (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            className={cn(
              'pointer-events-none col-start-1 row-start-1 tabular-nums transition-opacity duration-200 motion-reduce:transition-none max-sm:hidden pointer-coarse:hidden',
              HIDE_WHILE_ROW_CONTROLS_SHOW,
            )}
          >
            <time dateTime={createdAt}>{relativeTime(createdAt)}</time>
          </Txt>
        )}
        <span className="col-start-1 row-start-1 flex items-center max-sm:[&_button]:pointer-events-auto max-sm:[&_button]:opacity-100">
          <Button
            ref={detailsRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            draggable={false}
            aria-label={`Details for ${title}`}
            aria-expanded={expanded}
            onClick={event => {
              stopRowClick(event);
              onToggleDetails();
            }}
            className={REVEAL_ROW_CONTROLS}
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
                  onClick={stopRowClick}
                  className={REVEAL_ROW_CONTROLS}
                >
                  <EllipsisVertical size={13} aria-hidden />
                </Button>
              }
            />
            <DropdownMenu.Content align="end" className="min-w-44" onClick={stopRowClick}>
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
      role="article"
      aria-label={title}
      data-testid={testId}
      data-highlighted={highlighted || undefined}
      data-featured={expanded || undefined}
      aria-busy={busy || locked || undefined}
      tabIndex={-1}
      draggable={dragPayload !== undefined}
      onDragStart={event => {
        if (dragPayload) setDragPayload(event, dragPayload);
      }}
      onSelectRow={onToggleDetails}
      className={cn(
        'group',
        BOARD_LIST_ROW_LAYOUT_CLASS,
        locked && 'cursor-wait opacity-70',
        highlighted && 'ring-2 ring-warning-indicator/60 ring-offset-2 ring-offset-background',
      )}
    >
      {activityStatus && <ActivityWick status={activityStatus} />}
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
