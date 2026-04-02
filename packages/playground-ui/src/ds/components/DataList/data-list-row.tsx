import type { ReactNode } from 'react';
import { dataListRowStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowProps = {
  children: ReactNode;
  className?: string;
};

export function DataListRow({ children, className }: DataListRowProps) {
  return <div className={cn(...dataListRowStyles, className)}>{children}</div>;
}
