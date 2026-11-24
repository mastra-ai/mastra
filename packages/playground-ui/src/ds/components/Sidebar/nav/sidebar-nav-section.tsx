import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNavSectionProps = ComponentPropsWithoutRef<'section'>;

export function SidebarNavSection({ className, children, ...props }: SidebarNavSectionProps) {
  return (
    <section
      className={cn(
        'relative grid grid-cols-[minmax(0,1fr)] content-center items-start',
        // The section owns the spacing around its title: groups sit 14px apart, titled or not, and a title is only as
        // tall as its text with 4px down to its rows.
        'not-first:mt-3.5 has-[>div>header]:gap-y-1 *:has-[>header]:mt-0 *:has-[>header]:min-h-0',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
