import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function LogStreamHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 col-span-full grid h-9 grid-cols-subgrid items-center gap-x-4 bg-row px-3 @max-md:hidden',
        "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:content-['']",
      )}
    >
      {children}
    </div>
  );
}

export function LogStreamHeaderCell({ children }: { children: ReactNode }) {
  return <span className="text-column text-muted-foreground">{children}</span>;
}
