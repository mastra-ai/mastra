import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import usePolling from '@/lib/polls';
import { MastraClient } from '@mastra/client-js';

import type { RefinedTrace } from '@/domains/traces/types';
import { refineTraces } from '@/domains/traces/utils';

export const useTraces = (componentName: string, baseUrl: string, isWorkflow: boolean = false) => {
  const [traces, setTraces] = useState<RefinedTrace[] | null>(null);

  const client = new MastraClient({
    baseUrl: baseUrl || '',
  });

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
      throw error;
    }
  }, [componentName]);

  const onSuccess = useCallback((newTraces: RefinedTrace[]) => {
    if (newTraces.length > 0) {
      setTraces(() => newTraces);
    }
  }, []);

  const onError = useCallback((error: { message: string }) => {
    toast.error(error.message);
  }, []);

  const shouldContinue = useCallback(() => {
    //this prevents too many frequent calls in the usePolling
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
