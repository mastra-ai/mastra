import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityListRowsProps = {
  children: ReactNode;
  className?: string;
};

export function EntityListRows({ children, className }: EntityListRowsProps) {
  return <div className={cn('grid grid-cols-subgrid col-span-full p-1', className)}>{children}</div>;
}
