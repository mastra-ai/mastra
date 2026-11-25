import type { Ref } from 'react';
import type { LogViewLine } from '../types';
import { LogViewRows } from './log-view/log-view-rows';
import { LogViewSkeleton } from './log-view/log-view-skeleton';
import type { FractionDigits } from '@/utils/date-format';

export type LogViewOrder = 'newest-first' | 'oldest-first';

export interface LogViewListHandle {
  scrollToLog: (logId: string) => void;
}

export interface LogViewListProps<T extends LogViewLine> {
  logs: T[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  logIdMap: Map<T, string>;
  featuredLogId?: string;
  onLogClick?: (log: T) => void;
  order?: LogViewOrder;
  wrap?: boolean;
  timeFractionDigits?: FractionDigits;
  onFetchNextPage?: () => void;
  ref?: Ref<LogViewListHandle>;
}

export function LogViewList<T extends LogViewLine>({ isLoading, ...props }: LogViewListProps<T>) {
  if (isLoading) return <LogViewSkeleton />;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <LogViewRows {...props} />
    </div>
  );
}
