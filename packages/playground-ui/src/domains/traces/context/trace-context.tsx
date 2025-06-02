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

  const nextTrace = () => {
    if (currentTraceIndex < traces.length - 1) {
      const nextIndex = currentTraceIndex + 1;
      setCurrentTraceIndex(nextIndex);
      const nextTrace = traces[nextIndex].trace;
      setTrace(nextTrace);
      const parentSpan = nextTrace.find(span => span.parentSpanId === null) || nextTrace[0];
      setSpan(parentSpan);
    }
  };

  const prevTrace = () => {
    if (currentTraceIndex > 0) {
      const prevIndex = currentTraceIndex - 1;
      setCurrentTraceIndex(prevIndex);
      const prevTrace = traces[prevIndex].trace;
      setTrace(prevTrace);
      const parentSpan = prevTrace.find(span => span.parentSpanId === null) || prevTrace[0];
      setSpan(parentSpan);
    }
  };

  const clearData = () => {
    setOpen(false);
    setTrace(null);
    setSpan(null);
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
      }}
    >
      {children}
    </TraceContext.Provider>
  );
}
