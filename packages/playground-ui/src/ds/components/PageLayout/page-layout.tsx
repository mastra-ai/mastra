import type { ReactNode } from 'react';
import { Header } from '../Header';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Controls pinned between the header and the scrollable body (search, filters, toggles…). */
  actionRow?: ReactNode;
  /** Page-level header (e.g. `PageHeader`) rendered inside the body container, above children. */
  header?: ReactNode;
  /**
   * `container` pads the body (default); `narrow` centers the body in a max-width column;
   * `wide` aligns the header, controls and body in a centered 80rem column;
   * `fit` lets the body fill the page edge to edge.
   */
  variant?: 'container' | 'fit' | 'narrow' | 'wide';
}

const wideContainerClassName = 'mx-auto w-full max-w-7xl';

export function PageLayout({
  children,
  breadcrumbs,
  headerActions,
  actionRow,
  header,
  variant = 'container',
}: PageLayoutProps) {
  const isWide = variant === 'wide';
  const headerContent = (
    <>
      {breadcrumbs}
      {headerActions && <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{headerActions}</div>}
    </>
  );
  const headerSlot = header ? (
    <div data-slot="page-layout-header" className={cn(variant === 'fit' && 'p-4')}>
      {header}
    </div>
  ) : null;

  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions) && (
        <Header className={cn('h-10 min-h-10 shrink-0 gap-2 overflow-hidden', isWide ? 'px-4' : 'px-2')}>
          {isWide ? (
            <div
              data-slot="page-layout-header-container"
              className={cn(wideContainerClassName, 'flex min-w-0 items-center gap-2')}
            >
              {headerContent}
            </div>
          ) : (
            headerContent
          )}
        </Header>
      )}
      {actionRow && (
        <div data-slot="page-layout-action-row" className="flex shrink-0 flex-col gap-2 px-4 pt-4">
          {isWide ? <div className={wideContainerClassName}>{actionRow}</div> : actionRow}
        </div>
      )}
      <main
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          (variant === 'container' || isWide) && 'p-4',
          // `fit` hands the remaining body height to its child (panels, graphs, tables that own their scroll).
          variant === 'fit' &&
            (header ? 'grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)]' : 'grid grid-cols-1 grid-rows-1'),
        )}
      >
        {variant === 'narrow' || isWide ? (
          // Horizontal gutter is the variant's contract; keep px/py explicit rather than the `p-4` shorthand.
          // eslint-disable-next-line tailwindcss/enforces-shorthand
          <div
            data-slot="page-layout-container"
            className={cn(
              'grid min-h-full grid-cols-1',
              isWide ? wideContainerClassName : 'mx-auto w-full max-w-5xl p-4',
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
      </main>
    </div>
  );
}
