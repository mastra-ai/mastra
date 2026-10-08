import type { ReactNode } from 'react';
import { PageLayoutBody } from './page-layout-body';
import { PageLayoutHeader } from './page-layout-header';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Essential controls that remain directly accessible on compact headers. */
  primaryActions?: ReactNode;
  /** Search, filters and toggles. Catalogs keep them sticky inside the body viewport. */
  actionRow?: ReactNode;
  /** Page-level header (e.g. `PageHeader`) rendered inside the body container, above children. */
  header?: ReactNode;
  /**
   * `container` pads the body (default); `narrow` centers the body in a max-width column;
   * `fit` lets the body fill the page edge to edge; `catalog` owns list scrolling
   * with a sticky action row and padded results. Use DataList's `scroll="page"` in catalogs.
   */
  variant?: 'container' | 'fit' | 'narrow' | 'catalog';
}

export function PageLayout({
  children,
  breadcrumbs,
  headerActions,
  primaryActions,
  actionRow,
  header,
  variant = 'container',
}: PageLayoutProps) {
  const headerSlot = header ? (
    <div data-slot="page-layout-header" className={cn(variant === 'fit' && 'p-4')}>
      {header}
    </div>
  ) : null;

  return (
    <div data-slot="page-layout" className="flex h-full min-h-0 flex-col">
      {(breadcrumbs || headerActions || primaryActions) && (
        <PageLayoutHeader breadcrumbs={breadcrumbs} headerActions={headerActions} primaryActions={primaryActions} />
      )}
      {actionRow && variant !== 'catalog' && (
        <div data-slot="page-layout-action-row" className="flex shrink-0 flex-col gap-2 px-4 pt-4">
          {actionRow}
        </div>
      )}
      <main
        className={cn(
          'min-h-0 min-w-0 flex-1 overflow-hidden',
          variant === 'container' && 'p-4',
          // `fit` hands the remaining body height to its child (panels, graphs, tables that own their scroll).
          variant === 'fit' &&
            (header ? 'grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)]' : 'grid grid-cols-1 grid-rows-1'),
        )}
      >
        <PageLayoutBody variant={variant} header={headerSlot} actionRow={actionRow}>
          {children}
        </PageLayoutBody>
      </main>
    </div>
  );
}
