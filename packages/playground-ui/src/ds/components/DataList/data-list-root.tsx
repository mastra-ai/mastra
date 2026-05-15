import type { ReactNode, RefObject } from 'react';
import { cn } from '@/lib/utils';

export type DataListRootProps = {
  children: ReactNode;
  columns: string;
  className?: string;
  /**
   * Ref to the scroll container — pass this to TanStack Virtual's
   * `getScrollElement` when virtualizing. Without it, the list behaves as a
   * normal scrollable grid.
   */
  scrollRef?: RefObject<HTMLDivElement | null>;
};

export function DataListRoot({ children, columns, className, scrollRef }: DataListRootProps) {
  return (
    <div
      ref={scrollRef}
      className={cn(
        'grid bg-surface2 border max-h-full border-border1 rounded-xl overflow-y-auto content-start',
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}
