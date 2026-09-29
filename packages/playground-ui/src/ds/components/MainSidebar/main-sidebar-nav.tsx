import type { ComponentPropsWithoutRef } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';

export type MainSidebarNavProps = ComponentPropsWithoutRef<'nav'>;

export function MainSidebarNav({
  'aria-label': ariaLabel = 'Main',
  children,
  className,
  ...props
}: MainSidebarNavProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('flex min-h-0 flex-1 flex-col', className)} {...props}>
      <ScrollArea
        className="min-h-0 flex-1"
        viewPortClassName="px-0.5 data-[overflow-y-end]:mask-b-from-[calc(100%-5rem)] data-[overflow-y-start]:mask-t-from-[calc(100%-3rem)]"
      >
        {children}
      </ScrollArea>
    </nav>
  );
}
