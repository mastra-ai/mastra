import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import usePolling from '@/lib/polls';

import { traces_mock_data, workflow_traces_mock_data } from '@/domains/traces/mock-data';
import type { RefinedTrace, Span } from '@/domains/traces/types';
import { refineTraces } from '@/domains/traces/utils';

export const useTraces = (componentName: string, isWorkflow: boolean = false) => {
  const [traces, setTraces] = useState<RefinedTrace[] | null>(null);

  const fetchFn = useCallback(async () => {
    const refinedTraces = refineTraces(traces_mock_data as unknown as Span[], isWorkflow);
    return refinedTraces;
    // try {
    //   const res = await fetch(`/api/telemetry?attribute=componentName:${componentName}`);
    //   if (!res.ok) {
    //     const error = await res.json();
    //     throw new Error(error?.error || 'Error fetching traces');
    //   }
    //   const traces = await res.json();
    //   const refinedTraces = refineTraces(traces?.traces || [], isWorkflow);
    //   return refinedTraces;
    // } catch (error) {
    //   throw error;
    // }
  }, [componentName]);

  const onSuccess = useCallback((newTraces: RefinedTrace[]) => {
    if (newTraces.length > 0) {
      setTraces(() => newTraces);
    }
  }, []);

  const onError = useCallback((error: { message: string }) => {
    toast.error(error.message);
  }, []);

  const shouldContinue = useCallback((result: RefinedTrace[]) => {
    return result.length > 0;
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
