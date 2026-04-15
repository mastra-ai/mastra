import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataListSubheaderProps = {
  children: ReactNode;
  className?: string;
};

export function DataListSubheader({ children, className }: DataListSubheaderProps) {
  return (
    <div
      className={cn(
        'data-list-subheader relative isolate col-span-full px-4 py-3 border-none text-ui-md text-neutral4 font-medium mx-1',
        'before:absolute before:inset-x-0 before:inset-y-1 before:bg-surface4 before:rounded-md before:-z-1',
        className,
      )}
    >
      {children}
    </div>
  );
}
