import { createContext, useState } from 'react';

import type { Span, RefinedTrace } from '../types';

type TraceContextType = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  trace: Span[] | null;
  setTrace: React.Dispatch<React.SetStateAction<Span[] | null>>;
  traces: RefinedTrace[];
  setTraces: React.Dispatch<React.SetStateAction<RefinedTrace[]>>;
  currentTraceIndex: number;
  setCurrentTraceIndex: React.Dispatch<React.SetStateAction<number>>;
  nextTrace: () => void;
  prevTrace: () => void;
  span: Span | null;
  setSpan: React.Dispatch<React.SetStateAction<Span | null>>;
  openDetail: boolean;
  setOpenDetail: React.Dispatch<React.SetStateAction<boolean>>;
  clearData: () => void;
};

export const TraceContext = createContext<TraceContextType>({} as TraceContextType);

export function TraceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [trace, setTrace] = useState<Span[] | null>(null);
  const [traces, setTraces] = useState<RefinedTrace[]>([]);
  const [currentTraceIndex, setCurrentTraceIndex] = useState(0);
  const [span, setSpan] = useState<Span | null>(null);
  const [openDetail, setOpenDetail] = useState(false);

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
    setOpenDetail(false);
  };

  return (
    <TraceContext.Provider
      value={{
        isOpen: open,
        setIsOpen: setOpen,
        trace,
        setTrace,
        traces,
        setTraces,
        currentTraceIndex,
        setCurrentTraceIndex,
        nextTrace,
        prevTrace,
        span,
        setSpan,
        openDetail,
        setOpenDetail,
        clearData,
      }}
    >
      {children}
    </TraceContext.Provider>
  );
}
