import { cn } from '@/lib/utils';

import { NavLink } from './main-sidebar-nav-link';

export type NavSection = {
  key: string;
  title?: string;
  links: NavLink[];
};

export type MainSidebarNavListProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarNavList({ children, className }: MainSidebarNavListProps) {
  return <ul className={cn('grid gap-1 items-start content-center', className)}>{children}</ul>;
}
