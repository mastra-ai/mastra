import type { MouseEvent, ReactNode } from 'react';
import { setDragPayload } from './board-drag';
import type { DragPayload } from './board-drag';
import { BOARD_LIST_ROW_LAYOUT_CLASS } from './board-layout';
import { ActivityWick } from '@/ds/components/Activity';
import type { ActivityStatus } from '@/ds/components/Activity';
import { Button } from '@/ds/components/Button';
import { ContextMenu } from '@/ds/components/ContextMenu';
import { DataList } from '@/ds/components/DataList';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Txt } from '@/ds/components/Txt';

import { IconDotGrid1x3Vertical } from '@/ds/icons/central/IconDotGrid1x3Vertical';
import { focusRing } from '@/ds/primitives/transitions';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

const stopRowClick = (event: MouseEvent) => event.stopPropagation();

// The row's actions button swaps in for its timestamp on a mouse hover, keyboard focus anywhere in the row, or an
// open menu; touch always shows it.
const REVEAL_ROW_CONTROLS =
  'pointer-fine:pointer-events-none pointer-fine:opacity-0 pointer-fine:group-hover/data-list-row:pointer-events-auto pointer-fine:group-hover/data-list-row:opacity-100 pointer-fine:group-has-[:focus-visible]/data-list-row:pointer-events-auto pointer-fine:group-has-[:focus-visible]/data-list-row:opacity-100 pointer-fine:group-has-[[aria-expanded=true]]/row-end:pointer-events-auto pointer-fine:group-has-[[aria-expanded=true]]/row-end:opacity-100';
const HIDE_WHILE_ROW_CONTROLS_SHOW =
  'pointer-fine:group-hover/data-list-row:opacity-0 pointer-fine:group-has-[:focus-visible]/data-list-row:opacity-0 pointer-fine:group-has-[[aria-expanded=true]]/row-end:opacity-0';

// A list of hundreds of rows reads as a wall of buttons when each shows its action, so a mouse sees it on hover
// in place of the labels; it stays in the tab order (visually hidden, not removed) and always shows on touch.
const REVEAL_ACTION_ON_HOVER =
  'pointer-fine:sr-only pointer-fine:group-hover/data-list-row:not-sr-only pointer-fine:focus-within:not-sr-only pointer-fine:has-[[aria-expanded=true]]:not-sr-only';
const SWAP_FOR_ACTION_ON_HOVER =
  'pointer-fine:group-has-[.row-action:not(:empty)]/data-list-row:group-hover/data-list-row:hidden';

export type BoardListRowCells = {
  icon?: ReactNode;
  title?: ReactNode;
  links?: ReactNode;
  labels?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  activity?: ReactNode;
};

export function BoardListRow({
  title,
  href,
  linkRef,
  dragPayload,
  busy = false,
  locked = false,
  highlighted = false,
  activityStatus,
  menu,
  createdAt,
  cells,
  LinkComponent: Link = 'a',
  onOpen,
}: {
  title: string;
  href: string;
  linkRef?: (element: HTMLElement | null) => void;
  dragPayload?: DragPayload;
  busy?: boolean;
  locked?: boolean;
  highlighted?: boolean;
  activityStatus?: ActivityStatus;
  /** Actions offered from the row's button and context menu; none hides both. */
  menu?: ReactNode;
  /** When the card was created, with the host's own relative wording. */
  createdAt?: { dateTime: string; label: string };
  cells: BoardListRowCells;
  /** Router link for the title; defaults to a plain anchor. */
  LinkComponent?: LinkComponent;
  /** Selecting the row (not its title link) opens the card. */
  onOpen: () => void;
}) {
  const draggedPayload = locked ? undefined : dragPayload;
  const rowCells = (
    <>
      <DataList.Cell className="empty:before:content-none max-sm:col-start-1 max-sm:row-start-1">
        {cells.icon}
      </DataList.Cell>
      <DataList.Cell className="@container flex gap-3 overflow-visible text-foreground empty:before:content-none max-sm:contents">
        <span className="flex min-w-0 shrink items-center gap-3 max-sm:col-start-2 max-sm:row-start-1">
          <Link
            ref={linkRef}
            href={href}
            draggable={false}
            onClick={stopRowClick}
            className={cn('min-w-0 truncate rounded-sm', focusRing)}
          >
            {cells.title}
          </Link>
          <span
            onClick={stopRowClick}
            className="flex max-w-[min(14rem,30cqi)] min-w-0 shrink-0 items-center gap-2 empty:hidden max-sm:hidden [&>*]:min-w-0"
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
      <DataList.Cell className="group/row-end justify-items-start overflow-visible empty:before:content-none max-sm:col-start-3 max-sm:row-start-1">
        {createdAt && (
          <Txt
            as="span"
            variant="meta"
            tone="muted"
            className={cn(
              'pointer-events-none col-start-1 row-start-1 tabular-nums max-sm:hidden pointer-coarse:hidden',
              menu !== undefined && HIDE_WHILE_ROW_CONTROLS_SHOW,
            )}
          >
            <time dateTime={createdAt.dateTime}>{createdAt.label}</time>
          </Txt>
        )}
        <span className="col-start-1 row-start-1 flex items-center max-sm:[&_button]:pointer-events-auto max-sm:[&_button]:opacity-100">
          {menu !== undefined && (
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
                    <IconDotGrid1x3Vertical aria-hidden />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end" className="min-w-44" onClick={stopRowClick}>
                {menu}
              </DropdownMenu.Content>
            </DropdownMenu>
          )}
        </span>
      </DataList.Cell>
    </>
  );

  const row = (
    <DataList.RowWrapper
      role="article"
      aria-label={title}
      data-testid="work-item-card"
      data-highlighted={highlighted || undefined}
      aria-busy={busy || locked || undefined}
      tabIndex={-1}
      draggable={draggedPayload !== undefined}
      onDragStart={event => {
        if (draggedPayload) setDragPayload(event, draggedPayload);
      }}
      onSelectRow={onOpen}
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

  if (menu === undefined) return row;
  return (
    <ContextMenu>
      <ContextMenu.Trigger render={row} />
      {!locked && <ContextMenu.Content className="min-w-44">{menu}</ContextMenu.Content>}
    </ContextMenu>
  );
}
