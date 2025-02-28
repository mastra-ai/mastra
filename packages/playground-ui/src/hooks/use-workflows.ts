import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MastraClient } from '@mastra/client-js';

export const useWorkflow = (workflowId: string, baseUrl: string) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new MastraClient({
    baseUrl: baseUrl || '',
  });

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getWorkflow(workflowId).details();
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
