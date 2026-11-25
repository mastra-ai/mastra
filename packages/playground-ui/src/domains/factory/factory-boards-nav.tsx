import type { ReactNode } from 'react';

import { Button } from '@/ds/components/Button';
import { Sidebar } from '@/ds/components/Sidebar';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconKanbanView } from '@/ds/icons/central/IconKanbanView';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import type { LinkComponent } from '@/ds/types/link-component';

export type FactoryBoardsNavBoard = {
  id: string;
  title: string;
  href: string;
};

export type FactoryBoardsNavProps = {
  /** Undefined while loading. */
  boards: FactoryBoardsNavBoard[] | undefined;
  error?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
  isActive?: (href: string) => boolean;
  /** Shown only to people who may add a board. */
  newBoardHref?: string;
  /** Beside the Boards header, e.g. board settings. */
  headerAction?: ReactNode;
  /** Revealed beside a board on hover or focus. */
  boardAction?: (board: FactoryBoardsNavBoard) => ReactNode;
  /** Called after any link is followed, e.g. to close a mobile sidebar. */
  onNavigate?: () => void;
  /** Router link; defaults to the Sidebar's. */
  LinkComponent?: LinkComponent;
};

/**
 * The Boards section of a Factory sidebar. Links go through the Sidebar's
 * `LinkComponent`, so each host keeps its own router.
 */
export function FactoryBoardsNav({
  boards,
  error,
  onRetry,
  retrying,
  isActive,
  newBoardHref,
  headerAction,
  boardAction,
  onNavigate,
  LinkComponent,
}: FactoryBoardsNavProps) {
  return (
    <section className="flex flex-col gap-1" aria-label="Boards">
      <Sidebar.NavHeader className="mt-0" action={headerAction}>
        Boards
      </Sidebar.NavHeader>
      <Sidebar.NavList>
        {error ? (
          <li role="alert" className="flex min-w-0 items-center justify-between gap-2 py-0.5 pl-3">
            <Txt as="p" variant="label" className="m-0 truncate text-destructive-foreground">
              Couldn’t load boards
            </Txt>
            {onRetry && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Retry"
                tooltip="Retry"
                disabled={retrying}
                onClick={onRetry}
              >
                <IconArrowRotateCounterClockwise aria-hidden />
              </Button>
            )}
          </li>
        ) : !boards ? (
          <li aria-label="Loading boards" aria-busy className="flex flex-col gap-1 px-3 py-1">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ) : boards.length === 0 ? (
          <li>
            <Txt as="p" variant="label" tone="muted" role="status" className="m-0 px-3 py-1.5">
              No boards installed.
            </Txt>
          </li>
        ) : (
          boards.map(board => (
            <Sidebar.NavLink
              key={board.id}
              link={{ name: board.title, url: board.href, icon: <IconKanbanView /> }}
              isActive={isActive?.(board.href)}
              action={boardAction?.(board)}
              onClick={onNavigate}
              LinkComponent={LinkComponent}
            />
          ))
        )}
        {newBoardHref && (
          <Sidebar.NavLink
            link={{ name: 'New board', url: newBoardHref, icon: <IconPlusMedium /> }}
            isActive={isActive?.(newBoardHref)}
            onClick={onNavigate}
            LinkComponent={LinkComponent}
          />
        )}
      </Sidebar.NavList>
    </section>
  );
}
