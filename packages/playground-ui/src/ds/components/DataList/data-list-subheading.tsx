import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataListSubHeadingProps = {
  children: ReactNode;
  className?: string;
};

export function DataListSubHeading({ children, className }: DataListSubHeadingProps) {
  return <span className={cn('text-ui-sm font-normal text-neutral2', className)}>{children}</span>;
}
