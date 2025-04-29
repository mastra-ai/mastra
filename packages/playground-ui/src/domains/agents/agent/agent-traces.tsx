import { useContext, useState } from 'react';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { useTraces } from '@/hooks/use-traces';
import { TracesTable } from '../../traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import clsx from 'clsx';

export interface AgentTracesProps {
  agentName: string;
  baseUrl: string;
  className?: string;
}

export function AgentTraces({ agentName, baseUrl, className }: AgentTracesProps) {
  return (
    <TraceProvider>
      <AgentTracesInner agentName={agentName} baseUrl={baseUrl} className={className} />
    </TraceProvider>
  );
}

function AgentTracesInner({ agentName, baseUrl, className }: AgentTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { traces, firstCallLoading, error } = useTraces(agentName, baseUrl);
  const { isOpen: open } = useContext(TraceContext);

  return (
    <div className={clsx('h-full relative overflow-hidden flex', className)}>
      <div className={clsx('h-full overflow-y-scroll', open ? 'w-auto' : 'w-full')}>
        <TracesTable traces={traces} isLoading={firstCallLoading} error={error} />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </div>
  );
}
