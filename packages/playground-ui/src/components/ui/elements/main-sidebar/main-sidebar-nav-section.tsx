'use client';

import { cn } from '@/lib/utils';
import { NavLink } from './main-sidebar-nav-link';

export type NavSection = {
  key: string;
  title?: string;
  links: NavLink[];
  separator?: boolean;
};

type MainSidebarNavSectionProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarNavSection({ children, className }: MainSidebarNavSectionProps) {
  return <section className={cn('grid items-start content-center relative', className)}>{children}</section>;
}
