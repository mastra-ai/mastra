import { Span } from '../types';
import { useContext } from 'react';
import { TraceContext } from '../context/trace-context';

export const useOpenTrace = () => {
  const {
    setTrace,
    isOpen: open,
    setIsOpen: setOpen,
    trace: currentTrace,
    setSpan,
    setOpenDetail,
    setCurrentTraceIndex,
  } = useContext(TraceContext);

  const openTrace = (trace: Span[], traceIndex: number) => {
    setTrace(trace);
    const parentSpan = trace.find(span => span.parentSpanId === null) || trace[0];
    setSpan(parentSpan);
    setCurrentTraceIndex(traceIndex);
    if (open && currentTrace?.[0]?.id !== trace[0].id) return;
    setOpen(prev => !prev);
    setOpenDetail(prev => !prev);
  };

  return { openTrace };
};
