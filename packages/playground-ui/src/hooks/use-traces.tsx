import { useCallback, useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';

import usePolling from '@/lib/polls';

import type { RefinedTrace } from '@/domains/traces/types';
import { refineTraces } from '@/domains/traces/utils';
import { TraceContext } from '@/domains/traces/context/trace-context';
import { createMastraClient } from '@/lib/mastra-client';
export const useTraces = (componentName: string, baseUrl: string, isWorkflow: boolean = false) => {
  const [traces, setTraces] = useState<RefinedTrace[]>([]);

  // Get TraceContext safely, it might not be available if used outside of a TraceProvider
  const traceContext = useContext(TraceContext);
  const setTraceContextTraces = traceContext?.setTraces;

  // Memoize the client instance
  const client = useMemo(() => createMastraClient(baseUrl), [baseUrl]);

  const fetchFn = useCallback(async () => {
    try {
      const res = await client.getTelemetry({
        attribute: {
          componentName,
        },
      });
      if (!res.traces) {
        throw new Error('Error fetching traces');
      }
      const refinedTraces = refineTraces(res?.traces || [], isWorkflow);
      return refinedTraces;
    } catch (error) {
      console.log(`error, fetchFn`, error);
      throw error;
    }
  }, [client, componentName, isWorkflow]);

  const onSuccess = useCallback(
    (newTraces: RefinedTrace[]) => {
      if (newTraces.length > 0) {
        setTraces(() => newTraces);
        // Only call setTraceContextTraces if it's a function
        console.log(`setTraceContextTraces`, setTraceContextTraces);
        if (typeof setTraceContextTraces === 'function') {
          setTraceContextTraces(() => newTraces);
        }
      }
    },
    [setTraceContextTraces],
  );

  const onError = useCallback((error: { message: string }) => {
    console.log(`error, onError`, error);
    toast.error(error.message);
  }, []);

  const shouldContinue = useCallback(() => {
    return true;
  }, []);

  const { firstCallLoading, error } = usePolling<RefinedTrace[], { message: string }>({
    fetchFn,
    interval: 3000,
    onSuccess,
    onError,
    shouldContinue,
    enabled: true,
  });

  return { traces, firstCallLoading, error };
};
