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
    <nav aria-label={ariaLabel} className={cn('flex flex-col flex-1 min-h-0', className)} {...props}>
      <ScrollArea showMask className="flex-1 min-h-0">
        {children}
      </ScrollArea>
    </nav>
  );
}
