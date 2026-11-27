import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { EmptyState } from '@/ds/components/EmptyState';
import { LogStream } from '@/ds/components/LogStream';

export function LogViewFill({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <LogStream.Frame className="flex-1">{children}</LogStream.Frame>
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
        actionSlot={
          onClearFilters && (
            <Button type="button" onClick={onClearFilters}>
              Clear filters
            </Button>
          )
        }
      />
    </LogViewFill>
  );
}
