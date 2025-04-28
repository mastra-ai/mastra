import { useContext, useState } from 'react';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { useTraces } from '@/hooks/use-traces';
import { TracesTable } from '../../traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import clsx from 'clsx';

export interface AgentTracesProps {
  agentName: string;
  baseUrl: string;
}

export function AgentTraces({ agentName, baseUrl }: AgentTracesProps) {
  return (
    <TraceProvider>
      <AgentTracesInner agentName={agentName} baseUrl={baseUrl} />
    </TraceProvider>
  );
}

function AgentTracesInner({ agentName, baseUrl }: AgentTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { traces, firstCallLoading, error } = useTraces(agentName, baseUrl);
  const { isOpen: open } = useContext(TraceContext);

  return (
    <main className="h-full relative overflow-hidden flex">
      <div className={clsx('h-full', open ? 'w-auto' : 'w-full')}>
        <TracesTable traces={traces} isLoading={firstCallLoading} error={error} />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </main>
  );
}
