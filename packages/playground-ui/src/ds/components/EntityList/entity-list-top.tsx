import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityListTopProps = {
  children: ReactNode;
  className?: string;
};

export function EntityListTop({ children, className }: EntityListTopProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-subgrid gap-6 lg:gap-8 xl:gap-10 2xl:gap-12 3xl:gap-14 col-span-full border-b border-border1 px-4 bg-surface2 sticky top-0 z-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
