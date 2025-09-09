import { useContext, useEffect } from 'react';
import { TraceContext, TraceContextType } from '@mastra/playground-ui';
import { useTrace } from '../hooks/use-trace';
import { refineTraces } from '../utils/refine-traces';

export function TraceLoader() {
  const { traceId, setTrace, setIsLoadingTrace, isLoadingTrace } = useContext<TraceContextType>(TraceContext);

  const {
    data: traceData,
    isLoading,
    isError,
  } = useTrace(traceId, {
    enabled: !!traceId && isLoadingTrace,
  });

  useEffect(() => {
    if (traceData?.trace?.spans && !isLoading) {
      // Process the full trace data
      const refinedTraces = refineTraces(traceData.trace?.spans);
      if (refinedTraces.length > 0) {
        setTrace(refinedTraces[0].trace);
      }
      setIsLoadingTrace(false);
    }
  }, [traceData, isLoading, setTrace, setIsLoadingTrace]);

  useEffect(() => {
    if (isError) {
      setIsLoadingTrace(false);
    }
  }, [isError, setIsLoadingTrace]);

  return null; // This component doesn't render anything
}
