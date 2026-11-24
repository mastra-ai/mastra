import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { dataListWellSurfaceStyle } from '@/ds/components/DataList/shared';
import { EmptyState } from '@/ds/components/EmptyState';
import { cn } from '@/lib/utils';

export function LogViewFill({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <div className={cn('min-h-0 flex-1 rounded-lg', dataListWellSurfaceStyle)}>{children}</div>
    </div>
  );
}

export interface LogViewEmptyProps {
  onClearFilters?: () => void;
}

export function LogViewEmpty({ onClearFilters }: LogViewEmptyProps) {
  return (
    <LogViewFill>
      <EmptyState
        variant="fill"
        titleSlot={onClearFilters ? 'No logs match these filters' : 'No logs in this period'}
        actionSlot={onClearFilters && <Button onClick={onClearFilters}>Clear filters</Button>}
      />
    </LogViewFill>
  );
}
