import { ReactNode, useContext, useState } from 'react';

import { cn } from '@/lib/utils';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { useTraces } from '@/hooks/use-traces';

import { TracesTable } from '@/domains/traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';

export interface WorkflowTracesProps {
  workflowName: string;
  baseUrl: string;
  sidebarChild: ReactNode;
}

export function WorkflowTraces({ workflowName, baseUrl, sidebarChild }: WorkflowTracesProps) {
  return (
    <TraceProvider>
      <WorkflowTracesInner workflowName={workflowName} baseUrl={baseUrl} sidebarChild={sidebarChild} />
    </TraceProvider>
  );
}

function WorkflowTracesInner({ workflowName, baseUrl, sidebarChild }: WorkflowTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(30);
  const { traces, error, firstCallLoading } = useTraces(workflowName, baseUrl, true);
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
