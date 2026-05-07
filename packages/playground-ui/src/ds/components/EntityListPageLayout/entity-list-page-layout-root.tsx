import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EntityListPageLayoutRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'w-full h-full overflow-hidden grid grid-rows-[auto_auto] max-w-[110rem] px-10 mx-auto gap-4 py-6 content-start',
        className,
      )}
    >
      {children}
    </div>
  );
}
