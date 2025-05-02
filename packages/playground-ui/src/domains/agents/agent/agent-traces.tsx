import { useContext, useState } from 'react';

import { TraceContext } from '@/domains/traces/context/trace-context';

import { TracesTable } from '../../traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import clsx from 'clsx';
import { RefinedTrace } from '@/domains/traces/types';

export interface AgentTracesProps {
  className?: string;
  traces: RefinedTrace[];
  isLoading: boolean;
  error: { message: string } | null;
  onLoadNew?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onReachEnd?: () => void;
  onPullDown?: () => void;
  endThreshold?: number;
}

export function AgentTraces({
  className,
  traces,
  isLoading,
  error,
  onLoadNew,
  onLoadMore,
  onReachEnd,
  onPullDown,
  endThreshold,
  hasMore,
}: AgentTracesProps) {
  return (
    <AgentTracesInner
      className={className}
      traces={traces}
      isLoading={isLoading}
      error={error}
      onLoadNew={onLoadNew}
      onLoadMore={onLoadMore}
      onReachEnd={onReachEnd}
      onPullDown={onPullDown}
      endThreshold={endThreshold}
      hasMore={hasMore}
    />
  );
}

function AgentTracesInner({
  className,
  traces,
  isLoading,
  error,
  onLoadNew,
  onLoadMore,
  onReachEnd,
  onPullDown,
  endThreshold,
  hasMore,
}: AgentTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { isOpen: open } = useContext(TraceContext);

  // WAIT FOR USER TO PULL DOWN AND RELEASE BEFORE LOADING NEW TRACES
  const [isPulling, setIsPulling] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);

  // Track scroll position for pull-to-refresh
  const handleStartPull = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop === 0) {
      setIsPulling(true);
      setPullStartY(e.currentTarget.scrollTop);
    }
  };

  // Only trigger refresh when user has pulled down and released
  const handleEndPull = (e: React.UIEvent<HTMLDivElement>) => {
    if (isPulling && !isLoading && e.currentTarget.scrollTop === 0) {
      setIsPulling(false);
      setPullStartY(0);
      onPullDown?.();
    }
  };

  const handleEndReached = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    const endReached = scrollTop + clientHeight >= scrollHeight - (endThreshold || 0);

    if (!isLoading && endReached) {
      onReachEnd?.();
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    handleStartPull(event);
    handleEndPull(event);
    handleEndReached(event);
  };

  return (
    <div className={clsx('h-full relative overflow-hidden flex', className)}>
      <div className="h-full overflow-y-scroll w-full" onScroll={handleScroll}>
        <TracesTable
          traces={traces}
          isLoading={isLoading}
          error={error}
          onLoadNew={onLoadNew}
          onLoadMore={onLoadMore}
          onReachEnd={onReachEnd}
          onPullDown={onPullDown}
          hasMore={hasMore}
        />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </div>
  );
}
