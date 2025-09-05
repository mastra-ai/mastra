import { useMastraClient } from '@/contexts/mastra-client-context';
import { GetWorkflowRunsResponse } from '@mastra/client-js';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useWorkflowRuns = (workflowId: string, { enabled = true }: { enabled?: boolean } = {}) => {
  const [runs, setRuns] = useState<GetWorkflowRunsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = useMastraClient();

  useEffect(() => {
    if (!enabled) return;

    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setRuns(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getWorkflow(workflowId).runs({ limit: 50 });
        setRuns(res);
      } catch (error) {
        setRuns(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId, enabled]);

  return { runs, isLoading };
};
