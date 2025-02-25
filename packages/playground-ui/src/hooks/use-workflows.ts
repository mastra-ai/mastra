import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { mastraClient } from '@/lib/mastra-client';

export const useWorkflow = (workflowId: string, baseUrl: string) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await mastraClient(baseUrl).getWorkflow(workflowId).details();
        if (!res) {
          setWorkflow(null);
          console.error('Error fetching workflow');
          toast.error('Error fetching workflow');
          return;
        }
        setWorkflow(res as Workflow);
      } catch (error) {
        setWorkflow(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  return { workflow, isLoading };
};
