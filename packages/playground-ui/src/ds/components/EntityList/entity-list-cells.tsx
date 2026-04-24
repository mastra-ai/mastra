import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type EntityListCellProps = {
  children: ReactNode;
  className?: string;
};

export function EntityListCell({ children, className }: EntityListCellProps) {
  return (
    <span className={cn('relative py-4 grid items-center text-ui-md whitespace-nowrap text-neutral3', className)}>
      {children}
    </span>
  );
}

export function EntityListTextCell({ children, className }: EntityListCellProps) {
  return <EntityListCell className={className}>{children}</EntityListCell>;
}

export function EntityListNameCell({ children, className }: EntityListCellProps) {
  return (
    <EntityListCell className={cn('text-left text-neutral4', className)}>
      <span className="truncate">{children}</span>
    </EntityListCell>
  );
}

export function EntityListDescriptionCell({ children, className }: EntityListCellProps) {
  return (
    <EntityListCell className={cn('text-neutral2', className)}>
      <span className="truncate">{children}</span>
    </EntityListCell>
  );
}
