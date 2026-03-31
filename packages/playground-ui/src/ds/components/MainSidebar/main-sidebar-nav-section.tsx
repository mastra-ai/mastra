import type { NavLink } from './main-sidebar-nav-link';
import { cn } from '@/lib/utils';

export type NavSection = {
  key: string;
  title?: string;
  href?: string;
  links: NavLink[];
  separator?: boolean;
};

export type MainSidebarNavSectionProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarNavSection({ children, className }: MainSidebarNavSectionProps) {
  return <section className={cn('grid items-start content-center relative', className)}>{children}</section>;
}
