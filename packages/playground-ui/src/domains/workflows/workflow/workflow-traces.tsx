import { ReactNode, useContext, useState } from 'react';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { useTraces } from '@/hooks/use-traces';

import { TracesTable } from '@/domains/traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import clsx from 'clsx';

export interface WorkflowTracesProps {
  workflowName: string;
  baseUrl: string;
}

export function WorkflowTraces({ workflowName, baseUrl }: WorkflowTracesProps) {
  return (
    <TraceProvider>
      <WorkflowTracesInner workflowName={workflowName} baseUrl={baseUrl} />
    </TraceProvider>
  );
}

function WorkflowTracesInner({ workflowName, baseUrl }: WorkflowTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { traces, error, firstCallLoading } = useTraces(workflowName, baseUrl, true);
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
