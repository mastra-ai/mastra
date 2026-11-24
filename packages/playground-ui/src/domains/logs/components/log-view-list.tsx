import type { LogRecord } from '../types';
import { LogViewRows } from './log-view/log-view-rows';
import { LogViewSkeleton } from './log-view/log-view-skeleton';

export type LogViewOrder = 'newest-first' | 'oldest-first';

export interface LogViewListProps {
  logs: LogRecord[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  logIdMap: Map<LogRecord, string>;
  featuredLogId?: string;
  onLogClick?: (log: LogRecord) => void;
  order?: LogViewOrder;
  wrap?: boolean;
  onFetchNextPage?: () => void;
}

export function LogViewList({ isLoading, ...props }: LogViewListProps) {
  if (isLoading) return <LogViewSkeleton />;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-1">
      <LogViewRows {...props} />
    </div>
  );
}
