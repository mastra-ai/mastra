import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetWorkflowResponse, GetLegacyWorkflowResponse } from '@mastra/client-js';
import { client } from '@/lib/client';

export const useWorkflows = () => {
  const [legacyWorkflows, setLegacyWorkflows] = useState<Record<string, GetLegacyWorkflowResponse>>({});
  const [workflows, setWorkflows] = useState<Record<string, GetWorkflowResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLegacyWorkflows = async () => {
      setIsLoading(true);
      try {
        const [legacyWorkflows, workflows] = await Promise.all([client.getLegacyWorkflows(), client.getWorkflows()]);
        setLegacyWorkflows(legacyWorkflows);
        setWorkflows(workflows);
      } catch (error) {
        console.error('Error fetching workflows', error);
        toast.error('Error fetching workflows');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLegacyWorkflows();
  }, []);

  return { legacyWorkflows, workflows, isLoading };
};

export const useLegacyWorkflow = (workflowId: string, enabled = true) => {
  const [legacyWorkflow, setLegacyWorkflow] = useState<GetLegacyWorkflowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setLegacyWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getLegacyWorkflow(workflowId).details();
        setLegacyWorkflow(res);
      } catch (error) {
        setLegacyWorkflow(null);
        console.error('Error fetching legacy workflow', error);
        toast.error('Error fetching legacy workflow');
      } finally {
        setIsLoading(false);
      }
    };

    if (enabled) {
      fetchWorkflow();
    }
  }, [workflowId, enabled]);

  return { legacyWorkflow, isLoading };
};

export const useWorkflow = (workflowId: string, enabled = true) => {
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
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

    if (enabled) {
      fetchWorkflow();
    }
  }, [workflowId, enabled]);

  return { workflow, isLoading };
};
