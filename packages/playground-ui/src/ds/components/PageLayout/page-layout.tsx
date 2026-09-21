import type { ReactNode } from 'react';
import { Header } from '../Header';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  actions?: ReactNode;
  /** Applied to the scrollable `<main>` body. */
  className?: string;
}

export function PageLayoutBase({ children, breadcrumbs, actions, className }: PageLayoutProps) {
  return (
    <div data-slot="page-layout" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {(breadcrumbs || actions) && (
        <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
          {breadcrumbs}
          {actions && <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{actions}</div>}
        </Header>
      )}
      <main className={cn('min-h-0 overflow-y-auto', className)}>{children}</main>
    </div>
  );
}
