import type { ComponentPropsWithoutRef } from 'react';
import type { NavLink } from './main-sidebar-nav-link';
import { cn } from '@/lib/utils';

export type NavSection = {
  key: string;
  title?: string;
  href?: string;
  links: NavLink[];
  separator?: boolean;
  isHeaderActive?: boolean;
};

export type MainSidebarNavSectionProps = ComponentPropsWithoutRef<'section'>;

export function MainSidebarNavSection({ className, children, ...props }: MainSidebarNavSectionProps) {
  return (
    <section className={cn('grid grid-cols-[minmax(0,1fr)] items-start content-center relative', className)} {...props}>
      {children}
    </section>
  );
}
