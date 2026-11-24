import type { ReactNode } from 'react';
import { Header } from '../Header';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import { cn } from '@/lib/utils';

export interface PageFrameProps {
  children: ReactNode;
  breadcrumbs?: ReactNode;
  headerActions?: ReactNode;
  actionRow?: ReactNode;
  header?: ReactNode;
  body?: 'scroll' | 'fixed';
}

const scrollBodyWithHeader =
  'flex h-full min-h-min flex-col [&>:last-child:is([data-slot=empty-state-fill],[data-slot=spinner-fill],.h-full,:has(>[data-slot=empty-state-fill]),:has(>[data-slot=spinner-fill]))]:grow [&>:last-child:is([data-slot=empty-state-fill],[data-slot=spinner-fill],.h-full,:has(>[data-slot=empty-state-fill]),:has(>[data-slot=spinner-fill]))]:basis-0';

/** The frame every page variant renders into: the header bar, the action row and the scrolling body. */
export function PageFrame({
  children,
  breadcrumbs,
  headerActions,
  actionRow,
  header,
  body = 'scroll',
}: PageFrameProps) {
  const fixed = body === 'fixed';

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
      {actionRow && (
        <div data-slot="page-layout-action-row" className="shrink-0 px-4 pt-4">
          <div className="mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-2">{actionRow}</div>
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <ScrollAreaViewport
            className={fixed ? 'p-0' : 'p-4'}
            contentClassName={
              fixed
                ? // Locked to the viewport height, so the panels inside scroll on their own instead of the page.
                  cn('grid size-full min-h-0 grid-cols-1', header ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-1')
                : cn('mx-auto w-full max-w-(--breakpoint-2xl)', header ? scrollBodyWithHeader : 'h-full min-h-min')
            }
          >
            {header && (
              <div data-slot="page-layout-header" className={fixed ? 'p-4' : 'pb-6'}>
                {header}
              </div>
            )}
            {fixed ? (
              <div data-slot="page-layout-fixed" className="grid min-h-0 min-w-0 grid-cols-1 grid-rows-1">
                {children}
              </div>
            ) : (
              children
            )}
          </ScrollAreaViewport>
        </ScrollArea>
      </main>
    </div>
  );
}
