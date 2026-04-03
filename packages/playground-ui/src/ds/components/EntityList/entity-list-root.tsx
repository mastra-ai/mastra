import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityListRootProps = {
  children: ReactNode;
  columns: string;
  className?: string;
};

export function EntityListRoot({ children, columns, className }: EntityListRootProps) {
  return (
    <div
      className={cn(
        'grid bg-surface2 border h-full border-border1 rounded-xl overflow-y-auto content-start',
        className,
      )}
      style={{ gridTemplateColumns: columns }}
    >
      {children}
    </div>
  );
}
