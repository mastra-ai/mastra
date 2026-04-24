import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageLayoutTopArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4 pt-6 pb-4', className)}>{children}</div>;
}
