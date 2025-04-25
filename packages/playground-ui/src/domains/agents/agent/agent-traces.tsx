import { ReactNode, useContext, useState } from 'react';

import { cn } from '@/lib/utils';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { useTraces } from '@/hooks/use-traces';
import { TracesTable } from '../../traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';

export interface AgentTracesProps {
  agentName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}

export function AgentTraces({ agentName, baseUrl, sidebarChild }: AgentTracesProps) {
  return (
    <TraceProvider>
      <AgentTracesInner agentName={agentName} baseUrl={baseUrl} sidebarChild={sidebarChild} />
    </TraceProvider>
  );
}

function AgentTracesInner({ agentName, baseUrl, sidebarChild }: AgentTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(30);
  const { traces, firstCallLoading, error } = useTraces(agentName, baseUrl);
  const { isOpen: open } = useContext(TraceContext);

  return (
    <main className="h-full relative overflow-hidden flex flex-row">
      <div className="flex-1 block mr-[30%]">
        <TracesTable traces={traces} isLoading={firstCallLoading} error={error} />
      </div>

      <TracesSidebar
        className={cn(open ? 'grid grid-cols-2 w-[60%]' : 'min-w-[325px]')}
        width={100 - sidebarWidth}
        onResize={setSidebarWidth}
      >
        {sidebarChild}
      </TracesSidebar>
    </main>
  );
}
