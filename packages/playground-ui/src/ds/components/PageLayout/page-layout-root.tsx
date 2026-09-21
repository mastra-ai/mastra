import type { ReactNode } from 'react';
import { PageHeaderRow } from './page-header-row';
import { cn } from '@/lib/utils';

export interface PageLayoutRootProps {
  children: ReactNode;
  className?: string;
  width?: 'default' | 'narrow' | 'wide';
  height?: 'default' | 'full';
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  actions?: ReactNode;
  /** Visually hidden page `<h1>` for screen readers. */
  heading?: string;
}

export function PageLayoutRoot({
  children,
  className,
  width = 'default',
  height = 'default',
  breadcrumbs,
  actions,
  heading,
}: PageLayoutRootProps) {
  return (
    <div data-slot="page-layout" className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {(breadcrumbs || actions) && <PageHeaderRow breadcrumbs={breadcrumbs} actions={actions} />}
      <main
        className={cn(
          'grid min-h-0 w-full grid-rows-[auto_auto] content-start overflow-y-auto p-4',
          {
            'max-w-screen-lg mx-auto pt-6': width === 'narrow',
            'h-full grid-rows-[auto_minmax(0,1fr)]': height === 'full',
          },
          className,
        )}
      >
        {heading && <h1 className="sr-only">{heading}</h1>}
        {children}
      </main>
    </div>
  );
}
