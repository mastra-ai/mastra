import { useContext, useEffect, useRef, useState } from 'react';

import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';

import { TracesTable } from '@/domains/traces/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import { RefinedTrace } from '@/domains/traces/types';

export interface WorkflowTracesProps {
  traces: RefinedTrace[];
  error: { message: string } | null;
  runId?: string;
  stepName?: string;
}

export function WorkflowTraces({ traces, error, runId, stepName }: WorkflowTracesProps) {
  return (
    <TraceProvider initialTraces={traces || []}>
      <WorkflowTracesInner traces={traces} error={error} runId={runId} stepName={stepName} />
    </TraceProvider>
  );
}

function WorkflowTracesInner({ traces, error, runId, stepName }: WorkflowTracesProps) {
  // This is a hack. To fix, The provider should not resolve the data like this.
  // We should resolve the data first and pass them to the provider instead of having the proving setState on the result.
  const hasRunRef = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(100);
  const { isOpen: open, setTrace, setIsOpen, setSpan } = useContext(TraceContext);

  useEffect(() => {
    if (hasRunRef.current) return;
    if (!runId || !stepName) return;

    const matchingTrace = traces.find(trace => trace.runId === runId);
    if (!matchingTrace) return;

    const matchingSpan = matchingTrace.trace.find(span => span.name.includes(stepName));
    if (!matchingSpan) return;

    setTrace(matchingTrace.trace);
    setSpan(matchingSpan);
    setIsOpen(true);
    hasRunRef.current = true;
  }, [runId, traces, setTrace]);

  return (
    <main className="h-full relative overflow-hidden flex">
      <div className="h-full overflow-y-scroll w-full">
        <TracesTable traces={traces} error={error} />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </main>
  );
}
