import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Agent } from '@/types';

export const useAgents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/agents');
        if (!res.ok) {
          const error = await res.json();
          setAgents([]);
          console.error('Error fetching agents', error);
          toast.error(error?.error || 'Error fetching agents');
          return;
        }
        const data = await res.json();
        setAgents(data);
      } catch (error) {
        setAgents([]);
        console.error('Error fetching agents', error);
        toast.error('Error fetching agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, []);

  return { agents, isLoading };
};
