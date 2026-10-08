import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ScrollArea, ScrollAreaViewport } from '../ScrollArea';
import { cn } from '@/lib/utils';

/** Catalogs share one vertical viewport, including the search toolbar and results. */
export function PageLayoutCatalogBody({
  children,
  actionRow,
  header,
}: {
  children: ReactNode;
  actionRow?: ReactNode;
  header: ReactNode;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasToolbar = Boolean(actionRow);

  useEffect(() => {
    const toolbar = toolbarRef.current;
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!toolbar) {
      viewport.style.scrollPaddingTop = '0px';
      return;
    }

    // Keyboard row navigation must reveal items below the sticky controls,
    // including when filters wrap after resizing the sidebar or viewport.
    const updateScrollPadding = () => {
      viewport.style.scrollPaddingTop = `${toolbar.getBoundingClientRect().height}px`;
    };
    updateScrollPadding();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateScrollPadding);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [hasToolbar]);

  return (
    <ScrollArea data-slot="page-layout-scroll" className="h-full min-h-0 min-w-0" mask={false}>
      <ScrollAreaViewport ref={viewportRef}>
        {header && <div className="p-4">{header}</div>}
        {actionRow && (
          <div
            ref={toolbarRef}
            data-slot="page-layout-action-row"
            className="sticky top-0 z-30 flex flex-col gap-2 bg-background p-4 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-4 after:bg-linear-to-b after:from-background after:to-transparent after:content-['']"
          >
            {actionRow}
          </div>
        )}
        <div data-slot="page-layout-results" className={cn('min-w-0 px-4 pb-4', !actionRow && 'pt-4')}>
          {children}
        </div>
      </ScrollAreaViewport>
    </ScrollArea>
  );
}
