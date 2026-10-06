import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNavSectionProps = ComponentPropsWithoutRef<'section'>;

export function SidebarNavSection({ className, children, ...props }: SidebarNavSectionProps) {
  return (
    <section className={cn('relative grid grid-cols-[minmax(0,1fr)] content-center items-start', className)} {...props}>
      {children}
    </section>
  );
}
