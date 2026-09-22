import type { ReactNode } from 'react';
import { Header } from '../Header';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
  /** Controls pinned between the header and the scrollable body (search, filters, toggles…). */
  actionRow?: ReactNode;
}

export function PageLayout({ children, breadcrumbs, headerActions, actionRow }: PageLayoutProps) {
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
        <div data-slot="page-layout-action-row" className="shrink-0 px-4 pt-4">
          {actionRow}
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}
