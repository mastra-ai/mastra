import type { ComponentPropsWithoutRef } from 'react';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

export type SidebarNavProps = ComponentPropsWithoutRef<'nav'>;

export function SidebarNav({ 'aria-label': ariaLabel = 'Main', children, className, ...props }: SidebarNavProps) {
  const isMobile = useMaybeSidebarState()?.isMobile ?? false;

  return (
    <nav
      data-slot="sidebar-nav"
      aria-label={ariaLabel}
      className={cn(
        '-my-0.5 -mr-1.5 flex min-h-0 flex-1 flex-col',
        '[&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-1 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-0',
        isMobile && '[&_a]:min-h-11 [&_a]:touch-manipulation [&_button]:min-h-11 [&_button]:touch-manipulation',
        className,
      )}
      {...props}
    >
      <ScrollArea className="min-h-0 flex-1" mask={{ top: '3rem', bottom: '5rem' }}>
        {/* 2px around the rows for their focus rings, plus 8px under the header and after the last row (the end
            space only shows once you scroll to it). */}
        <ScrollAreaViewport className="px-0.5 py-2.5">
          <div data-slot="sidebar-nav-rows" className="pr-1.5">
            {children}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </nav>
  );
}
