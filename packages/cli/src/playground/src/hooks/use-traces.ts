import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import usePolling from '@/lib/polls';

import { RefinedTrace } from '@/domains/traces/types';
import { refineTraces } from '@/domains/traces/utils';

export const useTraces = (componentName: string) => {
  const [traces, setTraces] = useState<RefinedTrace[] | null>(null);

  const fetchFn = useCallback(async () => {
    try {
      const res = await fetch(`/api/telemetry?attribute=componentName:${componentName}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || 'Error fetching traces');
      }
      const traces = await res.json();
      const refinedTraces = refineTraces(traces?.traces || []);
      return refinedTraces;
    } catch (error) {
      throw error;
    }
  }, [componentName]);

  const onSuccess = useCallback((newTraces: RefinedTrace[]) => {
    if (newTraces.length > 0) {
      setTraces(() => newTraces);
    }
  }, []);

  const onError = useCallback((error: { msg: string }) => {
    toast.error(error.msg);
  }, []);

  const shouldContinue = useCallback((result: RefinedTrace[]) => {
    return result.length > 0;
  }, []);

  const { firstCallLoading, error } = usePolling<RefinedTrace[], { msg: string }>({
    fetchFn,
    interval: 3000,
    onSuccess,
    onError,
    shouldContinue,
    enabled: true,
  });

  return { traces, firstCallLoading, error };
};
