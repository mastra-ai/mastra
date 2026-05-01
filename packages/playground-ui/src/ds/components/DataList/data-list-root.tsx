import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataListRootProps = {
  children: ReactNode;
  columns: string;
  className?: string;
};

export function DataListRoot({ children, columns, className }: DataListRootProps) {
  return (
    <div
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
