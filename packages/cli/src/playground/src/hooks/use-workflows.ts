import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<Record<string, Workflow>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/workflows');
        if (!res.ok) {
          const error = await res.json();
          setWorkflows({});
          console.error('Error fetching workflows', error);
          toast.error(error?.error || 'Error fetching workflows');
          return;
        }
        const data = await res.json();
        setWorkflows(data);
      } catch (error) {
        setWorkflows({});
        console.error('Error fetching workflows', error);
        toast.error('Error fetching workflows');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  return { workflows, isLoading };
};

export const useWorkflow = (workflowId: string) => {
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
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) {
          const error = await res.json();
          setWorkflow(null);
          console.error('Error fetching workflow', error);
          toast.error(error?.error || 'Error fetching workflow');
          return;
        }
        const workflow = await res.json();
        setWorkflow(workflow);
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

export const useExecuteWorkflow = () => {
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false);

  const executeWorkflow = async ({ workflowId, input }: { workflowId: string; input: any }) => {
    try {
      setIsExecutingWorkflow(true);
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input || {}),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error?.error || 'Error executing workflow');
        return;
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    } finally {
      setIsExecutingWorkflow(false);
    }
  };

  return { executeWorkflow, isExecutingWorkflow };
};
