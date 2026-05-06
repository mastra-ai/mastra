import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type DataListCellProps = {
  children: ReactNode;
  className?: string;
  height?: 'default' | 'compact';
};

export function DataListCell({ children, className, height = 'default' }: DataListCellProps) {
  return (
    <span
      className={cn(
        'relative grid items-center text-ui-md whitespace-nowrap text-neutral3',
        height === 'compact' ? 'py-2' : 'py-4',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DataListTextCell({ children, className }: DataListCellProps) {
  return <DataListCell className={className}>{children}</DataListCell>;
}

export function DataListNameCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-left text-neutral4', className)}>
      <span className="truncate">{children}</span>
    </DataListCell>
  );
}

export function DataListDescriptionCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-neutral2', className)}>
      <span className="truncate">{children}</span>
    </DataListCell>
  );
}
