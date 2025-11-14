'use client';

import { cn } from '@/lib/utils';

type MainSidebarBottomProps = {
  children: React.ReactNode;
  className?: string;
};
export function MainSidebarBottom({ children, className }: MainSidebarBottomProps) {
  return <div className={cn('mt-auto', className)}>{children}</div>;
}
