import type { ReactNode } from 'react';
import { Header } from '../Header';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import type { ScrollAreaMask } from '../ScrollArea';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Draw the header row's bottom border. On by default; the row keeps its height either way. */
  headerBorder?: boolean;
  /** Controls pinned between the header and the scrollable body (search, filters, toggles…). */
  actionRow?: ReactNode;
  /** Page-level header (e.g. `PageHeader`) rendered inside the body container, above children. */
  header?: ReactNode;
  /**
   * `container` pads the body (default); `narrow` centers the body in a max-width column;
   * `fit` lets the body fill the page edge to edge.
   */
  variant?: 'container' | 'fit' | 'narrow';
  /**
   * Fade the body's scrolled edges, using the same values as `ScrollArea`'s `mask`. Off by default.
   * `{ y: true }` fades the top and bottom; `{ bottom: '3rem' }` sets one side's depth.
   * A fade covers whatever sits at that edge, so leave it off for `fit` bodies that hold tables with sticky headers.
   */
  mask?: ScrollAreaMask;
}

export function PageLayout({
  children,
  breadcrumbs,
  headerActions,
  headerBorder = true,
  actionRow,
  header,
  variant = 'container',
  mask = false,
}: PageLayoutProps) {
  const headerSlot = header ? (
    <div data-slot="page-layout-header" className={cn(variant === 'fit' && 'p-4')}>
      {header}
    </div>
  ) : null;

  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions) && (
        <Header border={headerBorder} className="min-h-header-default shrink-0 gap-2 overflow-hidden px-2">
          {breadcrumbs}
          {headerActions && (
            <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{headerActions}</div>
          )}
        </Header>
      )}
      {actionRow && (
        <div data-slot="page-layout-action-row" className="flex shrink-0 flex-col gap-2 px-4 pt-4">
          {actionRow}
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <ScrollArea mask={mask} className="min-h-0 flex-1">
          <ScrollAreaViewport
            className={cn(variant === 'container' && 'p-4')}
            contentClassName={cn(
              variant === 'container' && 'h-full min-h-min',
              variant === 'narrow' && 'grid min-h-full grid-cols-1',
              // `fit` hands the remaining body height to its child (panels, graphs, tables that own their scroll).
              variant === 'fit' &&
                (header
                  ? 'grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)]'
                  : 'grid h-full grid-cols-1 grid-rows-1'),
            )}
          >
            {variant === 'narrow' ? (
              // Horizontal gutter is the variant's contract; keep px/py explicit rather than the `p-4` shorthand.
              // eslint-disable-next-line tailwindcss/enforces-shorthand
              <div
                data-slot="page-layout-container"
                className={cn(
                  'mx-auto grid min-h-full w-full max-w-5xl grid-cols-1 p-4',
                  header ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
                )}
              >
                {headerSlot}
                {children}
              </div>
            ) : (
              <>
                {headerSlot}
                {children}
              </>
            )}
          </ScrollAreaViewport>
        </ScrollArea>
      </main>
    </div>
  );
}
