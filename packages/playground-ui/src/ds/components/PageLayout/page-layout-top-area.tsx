import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageLayoutTopArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-3 pb-3', className)}>{children}</div>;
}
