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
  /** `container` pads the body (default); `fit` lets the body fill the page edge to edge. */
  variant?: 'container' | 'fit';
}

export function PageLayout({
  children,
  breadcrumbs,
  headerActions,
  actionRow,
  variant = 'container',
}: PageLayoutProps) {
  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions) && (
        <Header className="h-10 min-h-10 shrink-0 gap-2 overflow-hidden px-2">
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
      <main
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          // `fit` hands the whole body height to its child (panels, graphs, tables that own their scroll).
          variant === 'container' ? 'p-4' : 'grid grid-rows-[minmax(0,1fr)]',
        )}
      >
        {children}
      </main>
    </div>
  );
}
