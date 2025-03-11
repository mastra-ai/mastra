import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { GetWorkflowWatchResponse, MastraClient } from '@mastra/client-js';

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

export const useExecuteWorkflow = (baseUrl: string) => {
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false);

  const executeWorkflow = async ({ workflowId, input }: { workflowId: string; input: any }) => {
    try {
      setIsExecutingWorkflow(true);
      const client = new MastraClient({
        baseUrl: baseUrl || '',
      });

      const response = await client.getWorkflow(workflowId).execute(input || {});
      return response;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    } finally {
      setIsExecutingWorkflow(false);
    }
  };

  return { executeWorkflow, isExecutingWorkflow };
};

export const useWatchWorkflow = (baseUrl: string) => {
  const [isWatchingWorkflow, setIsWatchingWorkflow] = useState(false);
  const [watchResult, setWatchResult] = useState<GetWorkflowWatchResponse | null>(null);

  const watchWorkflow = async ({ workflowId }: { workflowId: string }) => {
    try {
      setIsWatchingWorkflow(true);
      const client = new MastraClient({
        baseUrl,
      });

      const watchSubscription = client.getWorkflow(workflowId).watch();

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

export const useResumeWorkflow = (baseUrl: string) => {
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
      const client = new MastraClient({
        baseUrl: baseUrl || '',
      });

      const response = await client.getWorkflow(workflowId).resume({ stepId, runId, context });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingWorkflow(false);
    }
  };

  return { resumeWorkflow, isResumingWorkflow };
};
