'use client';

import { cn } from '@/lib/utils';

type MainSidebarNavProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarNav({ children, className }: MainSidebarNavProps) {
  return <nav className={cn('', className)}>{children}</nav>;
}
