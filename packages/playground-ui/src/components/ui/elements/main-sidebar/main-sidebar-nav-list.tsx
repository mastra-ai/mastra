'use client';

import { cn } from '@/lib/utils';
import { type SidebarState } from './main-sidebar-context';
import { NavLink } from './main-sidebar-nav-link';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';

export type NavSection = {
  key: string;
  title?: string;
  links: NavLink[];
};

type MainSidebarNavListProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarNavList({ children, className }: MainSidebarNavListProps) {
  return <ul className={cn('grid gap-[0.25rem] items-start content-center ', className)}>{children}</ul>;
}
