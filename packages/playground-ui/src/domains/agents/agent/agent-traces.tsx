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
}

export function AgentTraces({ className, traces, isLoading, error, onLoadNew, onLoadMore, hasMore }: AgentTracesProps) {
  return (
    <AgentTracesInner
      className={className}
      traces={traces}
      isLoading={isLoading}
      error={error}
      onLoadNew={onLoadNew}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
    />
  );
}

function AgentTracesInner({ className, traces, isLoading, error, onLoadNew, onLoadMore, hasMore }: AgentTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { isOpen: open } = useContext(TraceContext);

  return (
    <div className={clsx('h-full relative overflow-hidden flex', className)}>
      <div className="h-full overflow-y-scroll w-full">
        <TracesTable
          traces={traces}
          isLoading={isLoading}
          error={error}
          onLoadNew={onLoadNew}
          onLoadMore={onLoadMore}
          hasMore={hasMore}
        />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </div>
  );
}
