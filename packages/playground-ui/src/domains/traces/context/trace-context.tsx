import { createContext, useState } from 'react';

import type { Span, RefinedTrace } from '../types';

export type TraceContextType = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trace: Span[] | null;
  setTrace: React.Dispatch<React.SetStateAction<Span[] | null>>;
  traces: RefinedTrace[];
  currentTraceIndex: number;
  setCurrentTraceIndex: React.Dispatch<React.SetStateAction<number>>;
  nextTrace: () => void;
  prevTrace: () => void;
  span: Span | null;
  setSpan: React.Dispatch<React.SetStateAction<Span | null>>;
  clearData: () => void;
  // New properties for async loading
  traceId: string | null;
  setTraceId: React.Dispatch<React.SetStateAction<string | null>>;
  isLoadingTrace: boolean;
  setIsLoadingTrace: React.Dispatch<React.SetStateAction<boolean>>;
};

export const TraceContext = createContext<TraceContextType>({} as TraceContextType);

export function TraceProvider({
  children,
  initialTraces: traces = [],
}: {
  children: React.ReactNode;
  initialTraces?: RefinedTrace[];
}) {
  const [open, setOpen] = useState(false);
  const [trace, setTrace] = useState<Span[] | null>(null);
  const [currentTraceIndex, setCurrentTraceIndex] = useState(0);
  const [span, setSpan] = useState<Span | null>(null);
  // New state for async loading
  const [traceId, setTraceId] = useState<string | null>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  const nextTrace = () => {
    if (currentTraceIndex < traces.length - 1) {
      const nextIndex = currentTraceIndex + 1;
      const nextTraceData = traces[nextIndex];

      setCurrentTraceIndex(nextIndex);
      setTraceId(nextTraceData.traceId);
      setIsLoadingTrace(true);

      // Set the root span immediately while loading detailed spans
      setTrace(nextTraceData.trace);
      const parentSpan = nextTraceData.trace.find(span => span.parentSpanId === null) || nextTraceData.trace[0];
      setSpan(parentSpan);
    }
  };

  const prevTrace = () => {
    if (currentTraceIndex > 0) {
      const prevIndex = currentTraceIndex - 1;
      const prevTraceData = traces[prevIndex];

      setCurrentTraceIndex(prevIndex);
      setTraceId(prevTraceData.traceId);
      setIsLoadingTrace(true);

      // Set the root span immediately while loading detailed spans
      setTrace(prevTraceData.trace);
      const parentSpan = prevTraceData.trace.find(span => span.parentSpanId === null) || prevTraceData.trace[0];
      setSpan(parentSpan);
    }
  };

  const clearData = () => {
    setOpen(false);
    setTrace(null);
    setSpan(null);
    setTraceId(null);
    setIsLoadingTrace(false);
  };

  return (
    <TraceContext.Provider
      value={{
        isOpen: open,
        setIsOpen: setOpen,
        trace,
        setTrace,
        traces,
        currentTraceIndex,
        setCurrentTraceIndex,
        nextTrace,
        prevTrace,
        span,
        setSpan,
        clearData,
        traceId,
        setTraceId,
        isLoadingTrace,
        setIsLoadingTrace,
      }}
    >
      {children}
    </TraceContext.Provider>
  );
}
