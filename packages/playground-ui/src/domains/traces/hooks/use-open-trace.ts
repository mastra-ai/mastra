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
    setCurrentTraceIndex,
    setTraceId,
    setIsLoadingTrace,
  } = useContext(TraceContext);

  const openTrace = (traceId: string, traceIndex: number, rootSpan?: Span) => {
    // Set loading state
    setIsLoadingTrace(true);
    setCurrentTraceIndex(traceIndex);
    setTraceId(traceId);

    // If we have a root span, show it immediately while loading
    if (rootSpan) {
      setTrace([rootSpan]);
      setSpan(rootSpan);
    }

    // Toggle sidebar
    if (open && currentTrace?.[0]?.traceId !== traceId) return;
    setOpen(prev => !prev);
  };

  return { openTrace };
};
