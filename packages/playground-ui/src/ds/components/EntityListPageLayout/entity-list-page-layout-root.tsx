import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EntityListPageLayoutRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'w-full h-full overflow-hidden grid grid-rows-[auto_minmax(0,1fr)] max-w-[110rem] px-10 mx-auto gap-4 py-6',
        '[&>*:nth-child(2)]:min-h-0 [&>*:nth-child(2)]:overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
