import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MastraClient, GetWorkflowResponse, GetWorkflowWatchResponse } from '@mastra/client-js';

const mastra = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<Record<string, GetWorkflowResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      setIsLoading(true);
      try {
        const res = await mastra.getWorkflows();
        setWorkflows(res);
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
      const response = await mastra.getWorkflow(workflowId).execute(input || {});
      return response;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    } finally {
      setIsExecutingWorkflow(false);
    }
  };

  const createWorkflowRun = async ({ workflowId, input }: { workflowId: string; input: any }) => {
    try {
      const response = await mastra.getWorkflow(workflowId).createRun(input || {});
      return response;
    } catch (error) {
      console.error('Error creating workflow run:', error);
      throw error;
    }
  };

  return { executeWorkflow, createWorkflowRun, isExecutingWorkflow };
};

export const useWatchWorkflow = () => {
  const [isWatchingWorkflow, setIsWatchingWorkflow] = useState(false);
  const [watchResult, setWatchResult] = useState<GetWorkflowWatchResponse | null>(null);

  const watchWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingWorkflow(true);
      const client = new MastraClient({
        baseUrl: 'http://localhost:4111',
      });

      const watchSubscription = client.getWorkflow(workflowId).watch({ runId });

      if (!watchSubscription) {
        throw new Error('Error watching workflow');
      }

      for await (const record of watchSubscription) {
        setWatchResult(record);
      }
    } catch (error) {
      console.error('Error watching workflow:', error);

      throw error;
    } finally {
      setIsWatchingWorkflow(false);
    }
  };

  return { watchWorkflow, isWatchingWorkflow, watchResult };
};

export const useResumeWorkflow = () => {
  const [isResumingWorkflow, setIsResumingWorkflow] = useState(false);

  const resumeWorkflow = async ({
    workflowId,
    stepId,
    runId,
    context,
  }: {
    workflowId: string;
    stepId: string;
    runId: string;
    context: any;
  }) => {
    try {
      setIsResumingWorkflow(true);
      const response = await fetch(`/api/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stepId, runId, context }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error?.error || 'Error resuming workflow');
        return;
      }

      return await response.json();
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingWorkflow(false);
    }
  };

  return { resumeWorkflow, isResumingWorkflow };
};
