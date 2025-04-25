import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetWorkflowResponse, GetVNextWorkflowResponse } from '@mastra/client-js';
import { client } from '@/lib/client';

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<Record<string, GetWorkflowResponse>>({});
  const [vNextWorkflows, setVNextWorkflows] = useState<Record<string, GetVNextWorkflowResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        const [workflows, vNextWorkflows] = await Promise.all([client.getWorkflows(), client.getVNextWorkflows()]);
        setWorkflows(workflows);
        setVNextWorkflows(vNextWorkflows);
      } catch (error) {
        console.error('Error fetching workflows', error);
        toast.error('Error fetching workflows');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  return { workflows, vNextWorkflows, isLoading };
};

export const useWorkflow = (workflowId: string, enabled: boolean = true) => {
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        if (!workflowId) {
          setWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getWorkflow(workflowId).details();
        setWorkflow(res);
      } catch (error) {
        setWorkflow(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId, enabled]);

  return { workflow, isLoading };
};

export const useVNextWorkflow = (workflowId: string, enabled: boolean = true) => {
  const [vNextWorkflow, setVNextWorkflow] = useState<GetVNextWorkflowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        if (!workflowId) {
          setVNextWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getVNextWorkflow(workflowId).details();
        setVNextWorkflow(res);
      } catch (error) {
        setVNextWorkflow(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId, enabled]);

  return { vNextWorkflow, isLoading };
};
