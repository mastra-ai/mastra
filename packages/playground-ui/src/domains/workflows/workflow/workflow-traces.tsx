import { ReactNode, useContext, useState } from 'react';

import { TraceContext } from '@/domains/traces/context/trace-context';

import { TracesTable } from '@/domains/traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import { RefinedTrace } from '@/domains/traces/types';

export interface WorkflowTracesProps {
  traces: RefinedTrace[];
  isLoading: boolean;
  error: { message: string } | null;
}

export function WorkflowTraces({ traces, isLoading, error }: WorkflowTracesProps) {
  return <WorkflowTracesInner traces={traces} isLoading={isLoading} error={error} />;
}

function WorkflowTracesInner({ traces, isLoading, error }: WorkflowTracesProps) {
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { isOpen: open } = useContext(TraceContext);

  return (
    <main className="h-full relative overflow-hidden flex">
      <div className="h-full overflow-y-scroll w-full">
        <TracesTable traces={traces} isLoading={isLoading} error={error} />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </main>
  );
}
