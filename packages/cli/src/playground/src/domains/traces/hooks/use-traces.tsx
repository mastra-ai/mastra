import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { client } from '@/lib/client';

import usePolling from '@/lib/polls';

import { RefinedTrace } from '@mastra/playground-ui';
import { refineTraces } from '../utils/refine-traces';

export const useTraces = (componentName: string, isWorkflow: boolean = false) => {
  const [traces, setTraces] = useState<RefinedTrace[]>([]);

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
  }, [client, componentName, isWorkflow]);

  const onSuccess = useCallback((newTraces: RefinedTrace[]) => {
    if (newTraces.length > 0) {
      setTraces(() => newTraces);
    }
  }, []);

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
