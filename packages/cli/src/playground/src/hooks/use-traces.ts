import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Span } from '@/domains/traces/types';

export const useTraces = (componentName: string) => {
  const [traces, setTraces] = useState<Span[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTraces = async () => {
      setIsLoading(true);
      try {
        if (!componentName) {
          setTraces(null);
          setIsLoading(false);
          return;
        }
        const res = await fetch(`/api/telemetry?attribute=componentName:${componentName}`);
        if (!res.ok) {
          const error = await res.json();
          setTraces(null);
          console.error('Error fetching traces', error);
          toast.error(error?.error || 'Error fetching traces');
          return;
        }
        const traces = await res.json();
        setTraces(traces?.traces || []);
      } catch (error) {
        setTraces(null);
        console.error('Error fetching traces', error);
        toast.error('Error fetching traces');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTraces();
  }, [componentName]);

  return { traces, isLoading };
};
