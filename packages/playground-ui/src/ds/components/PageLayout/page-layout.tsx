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
  /** Controls at the top of the page body (search, filters, toggles…). They scroll with the body. */
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
  const hasTop = Boolean(actionRow || header);

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
      <main className="flex min-h-0 flex-1 flex-col">
        <ScrollArea mask={mask} className="min-h-0 flex-1">
          <ScrollAreaViewport
            className={cn(variant === 'container' && 'p-4')}
            contentClassName={cn(
              variant === 'container' && 'flex h-full min-h-min flex-col',
              variant === 'narrow' && 'grid min-h-full grid-cols-1',
              // `fit` hands the remaining body height to its child (panels, graphs, tables that own their scroll).
              variant === 'fit' &&
                (hasTop
                  ? 'grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)]'
                  : 'grid h-full grid-cols-1 grid-rows-1'),
            )}
          >
            <PageLayoutBody variant={variant} actionRow={actionRow} header={header}>
              {children}
            </PageLayoutBody>
          </ScrollAreaViewport>
        </ScrollArea>
      </main>
    </div>
  );
}

type PageLayoutBodyProps = Pick<PageLayoutProps, 'actionRow' | 'header' | 'children'> & {
  variant: NonNullable<PageLayoutProps['variant']>;
};

/** What goes inside the scroll area: the action row and page header, then the page content. */
function PageLayoutBody({ variant, actionRow, header, children }: PageLayoutBodyProps) {
  const actionRowSlot = actionRow ? (
    <div data-slot="page-layout-action-row" className="flex shrink-0 flex-col gap-2 pb-4">
      {actionRow}
    </div>
  ) : null;

  if (variant === 'container') {
    return (
      <>
        {actionRowSlot}
        {/* The body gets the height left under the row, so lists that scroll on their own still fit the page.
            Taller content overflows it, and scroll overflow skips the viewport's bottom padding, so a zero-height
            spacer puts that padding back. */}
        <div data-slot="page-layout-body" className="min-h-0 flex-1 after:-mb-4 after:block after:h-4">
          {header && <div data-slot="page-layout-header">{header}</div>}
          {children}
        </div>
      </>
    );
  }

  // `fit` and `narrow` put the action row and the page header in one cell above the content.
  const top =
    actionRowSlot || header ? (
      <div data-slot="page-layout-header" className={cn(variant === 'fit' && 'p-4')}>
        {actionRowSlot}
        {header}
      </div>
    ) : null;

  if (variant === 'narrow') {
    return (
      // Horizontal gutter is the variant's contract; keep px/py explicit rather than the `p-4` shorthand.
      // eslint-disable-next-line tailwindcss/enforces-shorthand
      <div
        data-slot="page-layout-container"
        className={cn(
          'mx-auto grid min-h-full w-full max-w-5xl grid-cols-1 p-4',
          top ? 'grid-rows-[auto_1fr]' : 'grid-rows-[1fr]',
        )}
      >
        {top}
        {children}
      </div>
    );
  }

  return (
    <>
      {top}
      {children}
    </>
  );
}
