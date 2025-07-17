import { useContext, useEffect, useRef, useState } from 'react';
import { TraceContext, TraceProvider } from '@/domains/traces/context/trace-context';
import { TracesTable } from '@/domains/traces/components/traces-table';
import { TracesSidebar } from '@/domains/traces/traces-sidebar';
import { RefinedTrace } from '@/domains/traces/types';
import clsx from 'clsx';
import { useTraces } from '../hooks/use-traces';
import { Skeleton } from '@/components/ui/skeleton';

export interface TracesViewProps {
  componentType: 'workflow' | 'agent';
  componentName: string;
  runId?: string;
  stepName?: string;
  className?: string;
}

export function TracesView({ componentType, componentName, runId, stepName, className }: TracesViewProps) {
  const {
    setEndOfListElement,
    data: traces = [],
    error,
    isLoading,
  } = useTraces(componentName, componentType === 'workflow');

  if (isLoading) {
    return <TracesViewSkeleton />;
  }

  return (
    <TraceProvider initialTraces={traces || []}>
      <TracesViewInner
        traces={traces}
        error={error}
        runId={runId}
        stepName={stepName}
        className={className}
        setEndOfListElement={setEndOfListElement}
      />
    </TraceProvider>
  );
}

interface TracesViewInnerProps {
  traces: RefinedTrace[];
  error: Error | null;
  runId?: string;
  stepName?: string;
  className?: string;
  setEndOfListElement: (element: HTMLDivElement | null) => void;
}

function TracesViewInner({ traces, error, runId, stepName, className, setEndOfListElement }: TracesViewInnerProps) {
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
    <div className={clsx('h-full relative overflow-hidden flex', className)}>
      <div className="h-full overflow-y-scroll w-full">
        <TracesTable traces={traces} error={error} />

        <div aria-hidden ref={setEndOfListElement} />
      </div>

      {open && <TracesSidebar width={sidebarWidth} onResize={setSidebarWidth} />}
    </div>
  );
}

export const TracesViewSkeleton = () => {
  return (
    <div className="h-full relative overflow-hidden flex">
      <div className="h-full overflow-y-scroll w-full">
        <Skeleton className="h-10" />
      </div>
    </div>
  );
};
