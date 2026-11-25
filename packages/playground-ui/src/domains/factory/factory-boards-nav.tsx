import type { ReactNode } from 'react';

import { SidebarEmptyNote, SidebarLoadError, SidebarNavigationSkeleton } from './sidebar-list-states';
import { Sidebar, useMaybeSidebarState } from '@/ds/components/Sidebar';
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
  /** Called when a board or New board link is followed, e.g. to close a mobile sidebar. */
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
  const sidebarLink = useMaybeSidebarState()?.LinkComponent;
  const Link: LinkComponent = LinkComponent ?? sidebarLink ?? 'a';
  return (
    <section className="flex flex-col gap-1" aria-label="Boards">
      <Sidebar.NavHeader className="mt-0" action={headerAction}>
        Boards
      </Sidebar.NavHeader>
      <Sidebar.NavList>
        {error ? (
          <li>
            <SidebarLoadError onRetry={onRetry} retrying={retrying}>
              Couldn’t load boards
            </SidebarLoadError>
          </li>
        ) : !boards ? (
          <li>
            <SidebarNavigationSkeleton label="Loading boards" rows={2} />
          </li>
        ) : boards.length === 0 ? (
          <li>
            <SidebarEmptyNote>No boards installed.</SidebarEmptyNote>
          </li>
        ) : (
          boards.map(board => (
            <Sidebar.NavLink
              key={board.id}
              link={{ name: board.title, url: board.href }}
              isActive={isActive?.(board.href)}
              action={boardAction?.(board)}
              render={
                <Link href={board.href} onClick={onNavigate}>
                  <IconKanbanView />
                  <Sidebar.NavLabel>{board.title}</Sidebar.NavLabel>
                </Link>
              }
            />
          ))
        )}
        {newBoardHref && (
          <Sidebar.NavLink
            link={{ name: 'New board', url: newBoardHref }}
            isActive={isActive?.(newBoardHref)}
            render={
              <Link href={newBoardHref} onClick={onNavigate}>
                <IconPlusMedium />
                <Sidebar.NavLabel>New board</Sidebar.NavLabel>
              </Link>
            }
          />
        )}
      </Sidebar.NavList>
    </section>
  );
}
