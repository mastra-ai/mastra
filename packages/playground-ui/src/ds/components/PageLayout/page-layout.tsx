import type { ReactNode } from 'react';
import { Header } from '../Header';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import type { ScrollAreaMask } from '../ScrollArea';
import { cn } from '@/lib/utils';

export interface PageLayoutProps {
  /**
   * The page body. Everything in it scrolls together, toolbars included. In `container` and `narrow`
   * children stack with a gap; wrap a list that scrolls on its own in `PageLayout.Fill`.
   */
  children: ReactNode;
  /** Left side of the page header row. */
  breadcrumbs?: ReactNode;
  /** Right side of the page header row. */
  headerActions?: ReactNode;
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

export function PageLayoutRoot({
  children,
  breadcrumbs,
  headerActions,
  variant = 'container',
  mask = false,
}: PageLayoutProps) {
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
              // At least the page's height so `h-full` children and `PageLayout.Fill` have room to fill;
              // taller content grows it and the page scrolls.
              variant === 'container' && 'flex h-full min-h-min flex-col gap-4',
              variant === 'narrow' && 'flex h-full min-h-min flex-col',
              // `fit` hands the whole body to its child (panels, graphs, tables that own their scroll).
              variant === 'fit' && 'grid h-full grid-cols-1 grid-rows-1',
            )}
          >
            {variant === 'narrow' ? (
              <div
                data-slot="page-layout-container"
                className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4"
              >
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

export interface PageLayoutFillProps {
  children: ReactNode;
  className?: string;
}

/**
 * Takes the body height left under the content above it, for a list or panel that scrolls on its own
 * (e.g. `DataList`): the toolbar above it stays in view while its rows scroll.
 */
export function PageLayoutFill({ children, className }: PageLayoutFillProps) {
  return (
    <div data-slot="page-layout-fill" className={cn('flex min-h-0 grow basis-0 flex-col', className)}>
      {children}
    </div>
  );
}
