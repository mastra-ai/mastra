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
  /**
   * Controls between the header and the body (search, filters, toggles…). With the default `container`
   * variant they scroll away with the body; `fit` and `narrow` keep them above it.
   */
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

  // In `container` the row scrolls away with the body; `fit` and `narrow` keep it above the body.
  const scrollingActionRow = Boolean(actionRow) && variant === 'container';
  const actionRowSlot = actionRow ? (
    <div
      data-slot="page-layout-action-row"
      className={cn('flex shrink-0 flex-col gap-2', scrollingActionRow ? 'pb-4' : 'px-4 pt-4')}
    >
      {actionRow}
    </div>
  ) : null;

  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions) && (
        <Header className="min-h-header-default shrink-0 gap-2 overflow-hidden px-2">
          {breadcrumbs}
          {headerActions && (
            <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{headerActions}</div>
          )}
        </Header>
      )}
      {!scrollingActionRow && actionRowSlot}
      <main className="flex min-h-0 flex-1 flex-col">
        <ScrollArea mask={mask} className="min-h-0 flex-1">
          <ScrollAreaViewport
            className={cn(variant === 'container' && 'p-4')}
            contentClassName={cn(
              variant === 'container' && 'h-full min-h-min',
              scrollingActionRow && 'flex flex-col',
              variant === 'narrow' && 'grid min-h-full grid-cols-1',
              // `fit` hands the remaining body height to its child (panels, graphs, tables that own their scroll).
              variant === 'fit' &&
                (header
                  ? 'grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)]'
                  : 'grid h-full grid-cols-1 grid-rows-1'),
            )}
          >
            {scrollingActionRow && actionRowSlot}
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
            ) : scrollingActionRow ? (
              // The body gets the height left under the row, so `h-full` children (lists that own their
              // scroll) still fit the page. Taller bodies overflow it, and scroll overflow skips the
              // viewport's bottom padding, so a zero-height spacer puts that padding back.
              <div data-slot="page-layout-body" className="min-h-0 flex-1 after:-mb-4 after:block after:h-4">
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
