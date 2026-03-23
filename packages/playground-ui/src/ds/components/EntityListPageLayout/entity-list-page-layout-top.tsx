import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EntityListPageLayoutTop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>;
}
