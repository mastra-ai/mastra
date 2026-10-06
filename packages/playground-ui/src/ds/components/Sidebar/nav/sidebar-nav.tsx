import type { ComponentPropsWithoutRef } from 'react';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

export type SidebarNavProps = ComponentPropsWithoutRef<'nav'>;

export function SidebarNav({ 'aria-label': ariaLabel = 'Main', children, className, ...props }: SidebarNavProps) {
  const isMobile = useMaybeSidebarState()?.isMobile ?? false;

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        '-mr-1.5 flex min-h-0 flex-1 flex-col',
        '[&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:w-1 [&_[data-slot=scroll-area-scrollbar][data-orientation=vertical]]:p-0',
        'focus-within:[&_[data-slot=scroll-area-scrollbar][data-orientation=vertical][data-has-overflow-y]]:opacity-100',
        isMobile && '[&_a]:min-h-11 [&_a]:touch-manipulation [&_button]:min-h-11 [&_button]:touch-manipulation',
        className,
      )}
      {...props}
    >
      <ScrollArea className="min-h-0 flex-1" mask={{ top: '3rem', bottom: '5rem' }}>
        <ScrollAreaViewport className="px-0.5">
          <div className="pr-1.5">{children}</div>
        </ScrollAreaViewport>
      </ScrollArea>
    </nav>
  );
}
